import { Logger } from '@nestjs/common';

export class SafeTelegramHelper {
  private static logger = new Logger('SafeTelegramHelper');

  /**
   * Safely send a message to Telegram
   * @param sendFn The function to send the message
   * @param fallbackMessage Optional fallback message for logging
   * @returns Promise that resolves to undefined on error
   */
  static async safeSend<T>(sendFn: () => Promise<T>, fallbackMessage?: string): Promise<T | undefined> {
    try {
      return await sendFn();
    } catch (error) {
      if (error.code === 'ETIMEDOUT' || error.errno === 'ETIMEDOUT') {
        this.logger.warn(`Telegram API timeout: ${fallbackMessage || 'Message send failed'}`);
      } else if (error.message?.includes('bot was blocked')) {
        this.logger.warn(`Bot was blocked by user: ${fallbackMessage || ''}`);
      } else if (error.message?.includes('chat not found')) {
        this.logger.warn(`Chat not found: ${fallbackMessage || ''}`);
      } else {
        this.logger.error(`Failed to send telegram message: ${error.message}`, error.stack);
      }
      return undefined;
    }
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
