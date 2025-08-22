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

      // Set timeout for bot operations
      this.bot.telegram.options.apiRoot = 'https://api.telegram.org';
      this.bot.telegram.options.agent = undefined;
      this.bot.telegram.options.attachmentAgent = undefined;

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
