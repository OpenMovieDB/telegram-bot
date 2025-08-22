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

  constructor(@InjectBot(BOT_NAME) private readonly bot: Telegraf, private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeBot();
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

      this.logger.log('Bot initialized successfully');
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
          throw new Error(`Failed to connect to Telegram API after ${this.maxRetries} attempts`);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }
  }
}
