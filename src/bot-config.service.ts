import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BOT_NAME } from './constants/bot-name.const';

@Injectable()
export class BotConfigService implements OnModuleInit {
  private readonly logger = new Logger(BotConfigService.name);
  private retryCount = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 5000; // 5 seconds
  private botConnected = false;

  constructor(@InjectBot(BOT_NAME) private readonly bot: Telegraf, private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Don't await - initialize in background to prevent app crash
    this.initializeBot().catch((error) => {
      this.logger.error(`Bot initialization failed, will retry in background: ${error.message}`);
      this.startBackgroundRetry();
    });
  }

  private async initializeBot() {
    try {
      this.logger.log('Initializing Telegram bot...');

      // Set API root (use proxy if TELEGRAM_API_ROOT is configured)
      const apiRoot = this.configService.get('TELEGRAM_API_ROOT', 'https://api.telegram.org');
      this.bot.telegram.options.apiRoot = apiRoot;
      this.logger.log(`Using Telegram API root: ${apiRoot}`);
      this.bot.telegram.options.agent = undefined;
      this.bot.telegram.options.attachmentAgent = undefined;

      // Retry transient Telegram/proxy gateway errors (502/503/504, resets, timeouts)
      // at the transport level so a blip never surfaces to users as "504: Gateway Time-out".
      // Every ctx.reply*/edit/answerCbQuery in every scene funnels through callApi, so this
      // one wrap covers them all — including AllExceptionFilter's own reply.
      this.installTransientRetry();

      // Configure HTTP timeouts for better reliability
      if (this.bot.telegram.options) {
        // Cast to any since timeout properties are not in TypeScript definitions
        // but are supported by the underlying HTTP client
        (this.bot.telegram.options as any).timeout = 30000; // 30 seconds timeout
        (this.bot.telegram.options as any).handlerTimeout = 60000; // 60 seconds for handlers
      }

      // Try to get bot info with retry logic
      await this.getBotInfoWithRetry();

      this.botConnected = true;
      this.logger.log('Bot initialized successfully');

      // Start polling only after successful connection
      // Since polling is private, we just launch without checking
      this.bot.launch().catch((error) => {
        this.logger.error(`Failed to launch bot polling: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(`Failed to initialize bot: ${error.message}`);
      throw error;
    }
  }

  private isTransientTelegramError(err: any): boolean {
    // Telegraf throws a TelegramError with numeric .code (== error_code) for res.status >= 500.
    const code = typeof err?.code === 'number' ? err.code : err?.response?.error_code;
    if (typeof code === 'number' && code >= 500) return true;
    if (typeof err?.code === 'string') {
      const netCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'EAI_AGAIN', 'EPIPE', 'ENETUNREACH'];
      if (netCodes.includes(err.code)) return true;
    }
    const msg = String(err?.message ?? '');
    // "504: Gateway Time-out" has a hyphen — match both forms and common transport failures.
    return /gateway time-?out|bad gateway|service unavailable|time-?out|socket hang up|network|EAI_AGAIN|ECONNRESET|ETIMEDOUT/i.test(
      msg,
    );
  }

  private installTransientRetry(): void {
    const telegram: any = this.bot.telegram;
    if (telegram.__transientRetryPatched) return;

    const original = telegram.callApi.bind(telegram);
    const isTransient = this.isTransientTelegramError.bind(this);
    const logger = this.logger;
    const maxRetries = 3;
    const baseDelay = 400; // ms; 400/800/1200 backoff — well under the 60s handler timeout

    telegram.callApi = async function (method: string, ...rest: any[]) {
      // Never wrap the long-polling fetch — telegraf's polling loop owns its own backoff.
      if (method === 'getUpdates') return original(method, ...rest);

      let lastErr: any;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await original(method, ...rest);
        } catch (err) {
          lastErr = err;
          if (attempt === maxRetries || !isTransient(err)) throw err;
          logger.warn(`Telegram ${method} transient error "${(err as any)?.message}" — retry ${attempt + 1}/${maxRetries}`);
          await new Promise((resolve) => setTimeout(resolve, baseDelay * (attempt + 1)));
        }
      }
      throw lastErr;
    };

    telegram.__transientRetryPatched = true;
    this.logger.log('Installed transient-error retry on Telegram callApi');
  }

  private async getBotInfoWithRetry(): Promise<void> {
    while (this.retryCount < this.maxRetries) {
      try {
        const botInfo = await Promise.race([
          this.bot.telegram.getMe(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Bot initialization timeout')), 30000)),
        ]);

        this.logger.log(`Bot connected: @${(botInfo as any)?.username}`);
        return;
      } catch (error) {
        this.retryCount++;
        this.logger.warn(
          `Failed to connect to Telegram API (attempt ${this.retryCount}/${this.maxRetries}): ${error.message}`,
        );

        if (this.retryCount >= this.maxRetries) {
          this.logger.error(`Failed to connect to Telegram API after ${this.maxRetries} attempts`);
          throw new Error(`Failed to connect to Telegram API after ${this.maxRetries} attempts`);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  private async startBackgroundRetry() {
    // Reset retry counter for background retries
    this.retryCount = 0;

    const retryInterval = setInterval(async () => {
      if (this.botConnected) {
        clearInterval(retryInterval);
        return;
      }

      this.logger.log('Attempting to reconnect to Telegram API...');

      try {
        await this.initializeBot();
        clearInterval(retryInterval);
      } catch (error) {
        this.logger.warn(`Background reconnection attempt failed: ${error.message}`);
      }
    }, 30000); // Retry every 30 seconds
  }

  isBotConnected(): boolean {
    return this.botConnected;
  }
}
