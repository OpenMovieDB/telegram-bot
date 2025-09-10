import { Logger } from '@nestjs/common';

export class SafeTelegramHelper {
  private static logger = new Logger('SafeTelegramHelper');
  private static readonly DEFAULT_RETRY_COUNT = 3;
  private static readonly DEFAULT_RETRY_DELAY = 2000; // 2 seconds
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Safely send a message to Telegram with retry logic
   * @param sendFn The function to send the message
   * @param fallbackMessage Optional fallback message for logging
   * @param retryCount Number of retry attempts (default: 3)
   * @param retryDelay Delay between retries in ms (default: 2000)
   * @returns Promise that resolves to undefined on error
   */
  static async safeSend<T>(
    sendFn: () => Promise<T>,
    fallbackMessage?: string,
    retryCount: number = this.DEFAULT_RETRY_COUNT,
    retryDelay: number = this.DEFAULT_RETRY_DELAY,
  ): Promise<T | undefined> {
    let attempt = 0;

    while (attempt <= retryCount) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Telegram API timeout')), this.DEFAULT_TIMEOUT),
        );

        return await Promise.race([sendFn(), timeoutPromise]);
      } catch (error) {
        attempt++;

        if (this.isRecoverableError(error) && attempt <= retryCount) {
          this.logger.warn(
            `Telegram API ${error.code || error.message} (attempt ${attempt}/${retryCount + 1}): ${
              fallbackMessage || 'Message send failed'
            }`,
          );

          if (attempt <= retryCount) {
            await this.delay(retryDelay * attempt); // Exponential backoff
            continue;
          }
        }

        if (error.message?.includes('bot was blocked')) {
          this.logger.warn(`Bot was blocked by user: ${fallbackMessage || ''}`);
        } else if (error.message?.includes('chat not found')) {
          this.logger.warn(`Chat not found: ${fallbackMessage || ''}`);
        } else if (error.message?.includes('message is not modified')) {
          this.logger.debug(`Message not modified: ${fallbackMessage || ''}`);
        } else {
          this.logger.error(`Failed to send telegram message after ${attempt} attempts: ${error.message}`, error.stack);
        }
        return undefined;
      }
    }

    return undefined;
  }

  private static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a network timeout
   */
  static isTimeoutError(error: any): boolean {
    return error?.code === 'ETIMEDOUT' || error?.errno === 'ETIMEDOUT' || error?.message?.includes('timeout');
  }

  /**
   * Check if error is recoverable (network issues, timeouts)
   */
  static isRecoverableError(error: any): boolean {
    return (
      this.isTimeoutError(error) ||
      error?.code === 'ECONNRESET' ||
      error?.code === 'ECONNREFUSED' ||
      error?.message?.includes('ETELEGRAM')
    );
  }
}
