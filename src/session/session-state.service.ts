import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Injectable()
export class SessionStateService {
  private readonly logger = new Logger(SessionStateService.name);
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  /**
   * Устанавливает флаг paymentInProgress
   */
  async setPaymentInProgress(userId: number, value: boolean): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      const existingData = await this.redis.get(key);
      let flags = existingData ? JSON.parse(existingData) : {};

      flags = {
        ...flags,
        paymentInProgress: value,
        updatedAt: Date.now()
      };

      await this.redis.set(key, JSON.stringify(flags), 'EX', 3600);
      this.logger.debug(`Set paymentInProgress=${value} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to set paymentInProgress for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Устанавливает флаг waitingForEmail
   */
  async setWaitingForEmail(userId: number, value: boolean): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      const existingData = await this.redis.get(key);
      let flags = existingData ? JSON.parse(existingData) : {};

      flags = {
        ...flags,
        waitingForEmail: value,
        updatedAt: Date.now()
      };

      await this.redis.set(key, JSON.stringify(flags), 'EX', 3600);
      this.logger.debug(`Set waitingForEmail=${value} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to set waitingForEmail for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Устанавливает выбранный тариф
   */
  async setTariffId(userId: number, tariffId: string): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      const existingData = await this.redis.get(key);
      let flags = existingData ? JSON.parse(existingData) : {};

      flags = {
        ...flags,
        tariffId,
        updatedAt: Date.now()
      };

      await this.redis.set(key, JSON.stringify(flags), 'EX', 3600);
      this.logger.debug(`Set tariffId=${tariffId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to set tariffId for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Устанавливает количество месяцев для оплаты
   */
  async setPaymentMonths(userId: number, months: number): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      const existingData = await this.redis.get(key);
      let flags = existingData ? JSON.parse(existingData) : {};

      flags = {
        ...flags,
        paymentMonths: months,
        updatedAt: Date.now()
      };

      await this.redis.set(key, JSON.stringify(flags), 'EX', 3600);
      this.logger.debug(`Set paymentMonths=${months} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to set paymentMonths for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Сбрасывает все флаги платежа для пользователя
   */
  async clearAllPaymentFlags(userId: number): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      await this.redis.del(key);
      this.logger.debug(`All payment flags cleared for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to clear payment flags for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Очищает только процессинговые флаги, сохраняя выбор пользователя (tariffId и paymentMonths)
   */
  async clearProcessingFlags(userId: number): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      const existingData = await this.redis.get(key);
      if (!existingData) return;

      const flags = JSON.parse(existingData);

      // Сохраняем только пользовательский выбор
      const cleanFlags = {
        tariffId: flags.tariffId,
        paymentMonths: flags.paymentMonths,
        updatedAt: Date.now()
      };

      await this.redis.set(key, JSON.stringify(cleanFlags), 'EX', 3600);
      this.logger.debug(`Processing flags cleared for user ${userId}, keeping user selection`);
    } catch (error) {
      this.logger.error(`Failed to clear processing flags for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Получает флаги платежа для пользователя
   */
  async getPaymentFlags(userId: number): Promise<{
    paymentInProgress?: boolean;
    waitingForEmail?: boolean;
    shouldExitPaymentScene?: boolean;
    tariffId?: string;
    paymentMonths?: number;
  } | null> {
    const key = `payment_flags:${userId}`;

    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      this.logger.debug(`Retrieved payment flags for user ${userId}:`, parsed);

      return parsed;
    } catch (error) {
      this.logger.error(`Failed to get payment flags for user ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Удаляет флаги платежа после их применения
   */
  async removePaymentFlags(userId: number): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      await this.redis.del(key);
      this.logger.debug(`Payment flags removed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove payment flags for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Устанавливает флаг что пользователь должен выйти из сцены платежа и перейти в главное меню
   */
  async setExitPaymentScene(userId: number): Promise<void> {
    const key = `payment_flags:${userId}`;

    try {
      const existingData = await this.redis.get(key);
      let flags = {};

      if (existingData) {
        flags = JSON.parse(existingData);
      }

      flags = {
        ...flags,
        shouldExitPaymentScene: true,
        paymentInProgress: false,
        waitingForEmail: false,
        updatedAt: Date.now()
      };

      await this.redis.set(key, JSON.stringify(flags), 'EX', 3600); // Expire in 1 hour

      this.logger.debug(`Set exit payment scene flag for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to set exit payment scene flag for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Сохраняет ID последнего сообщения для возможности его редактирования
   */
  async setMessageId(userId: number, messageId: number): Promise<void> {
    const key = `message:${userId}`;

    try {
      await this.redis.set(key, messageId.toString(), 'EX', 86400); // 24 hours TTL
      this.logger.debug(`Set message ID ${messageId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to set message ID for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Получает ID последнего сообщения
   */
  async getMessageId(userId: number): Promise<number | undefined> {
    const key = `message:${userId}`;

    try {
      const messageId = await this.redis.get(key);
      return messageId ? parseInt(messageId, 10) : undefined;
    } catch (error) {
      this.logger.error(`Failed to get message ID for user ${userId}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Очищает ID последнего сообщения
   */
  async clearMessageId(userId: number): Promise<void> {
    const key = `message:${userId}`;

    try {
      await this.redis.del(key);
      this.logger.debug(`Cleared message ID for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to clear message ID for user ${userId}: ${error.message}`);
    }
  }
}