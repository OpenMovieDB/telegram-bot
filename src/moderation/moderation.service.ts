import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';

import { AccountClient } from '../account/account.client';
import { AccountResponseDto } from '../account/dto/account-response.dto';
import { Context } from '../interfaces/context.interface';
import { BOT_NAME } from '../constants/bot-name.const';
import { SafeTelegramHelper } from '../helpers/safe-telegram.helper';
import { createReviewKeyboard } from './keyboards/moderation.keyboards';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly redis: Redis;
  private readonly chatId: number;
  private readonly adminChatId: number;

  private readonly SPAM_USER_PREFIX = 'spam:user:';
  private readonly SPAM_CHECK_PREFIX = 'spam:checked:';
  private readonly SPAM_PENDING_PREFIX = 'spam:pending:';
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CHECK_COOLDOWN = 600; // 10 minutes
  private readonly PENDING_TTL = 86400; // 24 hours — ждём решения владельца, не дёргая его повторно
  private readonly PENDING_MESSAGES_LIMIT = 50; // сколько сообщений копим на удаление по одному решению
  private readonly APPROVED_TTL = 2592000; // 30 days — владелец решил не блокировать

  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly accountClient: AccountClient,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.redis = this.redisService.getOrThrow();
    this.chatId = Number(configService.get('CHAT_ID'));
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
  }

  async checkAndModerateUser(ctx: Context & { update: any }): Promise<void> {
    try {
      const message = ctx.update.message;
      const userId = message.from.id;
      const username = message.from.username || message.from.first_name || 'Unknown';

      // Пользователь уже ждёт решения владельца: сообщение не трогаем, только копим
      // его id, чтобы удалить всё разом, если владелец решит блокировать.
      if (await this.redis.exists(`${this.SPAM_PENDING_PREFIX}${userId}`)) {
        await this.trackPendingMessage(userId, message.message_id);
        return;
      }

      // Проверяем кулдаун для избежания спама проверок
      const cooldownKey = `${this.SPAM_CHECK_PREFIX}${userId}`;
      const lastCheck = await this.redis.get(cooldownKey);
      if (lastCheck) {
        this.logger.debug(`User ${userId} check on cooldown, skipping`);
        return;
      }

      // Быстрая проверка в кэше
      const isUserAllowed = await this.checkUserInCache(userId);
      if (isUserAllowed === true) {
        this.logger.debug(`User ${userId} found in cache as allowed`);
        return;
      }

      if (isUserAllowed === false) {
        // Пользователь уже проверен и не найден в базе
        await this.requestAdminReview(ctx, { userId, username, messageText: message.text });
        return;
      }

      // Проверка в account-service
      let user: AccountResponseDto | null = null;
      try {
        user = await this.checkUserInAccount(userId);
      } catch (accountError) {
        // account недоступен — НЕ модерируем пользователя, только логируем
        this.logger.error(
          `account-service error when checking user ${userId} (@${username}), skipping moderation:`,
          accountError,
        );
        return;
      }

      if (user) {
        // Пользователь найден - кэшируем положительный результат
        await this.cacheUserCheck(userId, true);
        this.logger.log(`User ${userId} (@${username}) verified from database`);
      } else {
        // Пользователь не найден — сообщение не трогаем, отправляем владельцу на проверку
        await this.cacheUserCheck(userId, false);
        await this.requestAdminReview(ctx, { userId, username, messageText: message.text });
      }

      // Устанавливаем кулдаун для проверок
      await this.redis.setex(cooldownKey, this.CHECK_COOLDOWN, Date.now().toString());
    } catch (error) {
      this.logger.error(`Error in checkAndModerateUser for userId ${ctx.from?.id}:`, error);
    }
  }

  private async checkUserInCache(userId: number): Promise<boolean | null> {
    try {
      const cacheKey = `${this.SPAM_USER_PREFIX}${userId}`;
      const result = await this.redis.get(cacheKey);

      if (result === null) return null; // Не в кэше
      return result === 'exists';
    } catch (error) {
      this.logger.error(`Error checking user cache for ${userId}:`, error);
      return null;
    }
  }

  private async checkUserInAccount(userId: number): Promise<AccountResponseDto | null> {
    // Read-only резолв: модерация не должна создавать аккаунты.
    // null означает "пользователь не найден", ошибка означает "account недоступен".
    return this.accountClient.getByTelegramId(userId);
  }

  private async cacheUserCheck(userId: number, exists: boolean, ttl: number = this.CACHE_TTL): Promise<void> {
    try {
      const cacheKey = `${this.SPAM_USER_PREFIX}${userId}`;
      const value = exists ? 'exists' : 'not_exists';
      await this.redis.setex(cacheKey, ttl, value);

      this.logger.debug(`Cached user check for ${userId}: ${value}`);
    } catch (error) {
      this.logger.error(`Error caching user check for ${userId}:`, error);
    }
  }

  // Сообщение остаётся в чате, пользователь не блокируется: решение принимает владелец
  // кнопками в админ-чате. До его ответа повторные сообщения того же пользователя
  // уведомление не дублируют.
  private async requestAdminReview(
    ctx: Context & { update: any },
    userInfo: { userId: number; username: string; messageText: string },
  ): Promise<void> {
    try {
      const { userId, username, messageText } = userInfo;
      const messageId = ctx.update.message.message_id;

      const pendingCount = await this.trackPendingMessage(userId, messageId);
      if (pendingCount > 1) {
        this.logger.debug(`Review for user ${userId} already pending, not notifying admin again`);
        return;
      }

      this.logger.warn(`Suspicious message ${messageId} from user ${userId} (@${username}) sent to admin review`);

      await this.sendAdminReviewRequest(userId, username, messageText, messageId);
    } catch (error) {
      this.logger.error(`Error requesting admin review for user ${userInfo.userId}:`, error);
    }
  }

  // Копим id сообщений пользователя, ожидающего решения владельца. Возвращает,
  // сколько сообщений уже накоплено (1 — это первое, по нему шлётся уведомление).
  private async trackPendingMessage(userId: number, messageId: number): Promise<number> {
    const pendingKey = `${this.SPAM_PENDING_PREFIX}${userId}`;
    const count = await this.redis.lpush(pendingKey, String(messageId));
    await this.redis.ltrim(pendingKey, 0, this.PENDING_MESSAGES_LIMIT - 1);
    await this.redis.expire(pendingKey, this.PENDING_TTL);
    return count;
  }

  private async sendAdminReviewRequest(
    userId: number,
    username: string,
    messageText: string,
    messageId: number,
  ): Promise<void> {
    try {
      const truncatedText = messageText?.slice(0, 200) || 'Без текста (медиа или другой тип сообщения)';
      const messageLink = this.buildMessageLink(messageId);
      const notificationText =
        `⚠️ Сообщение от незарегистрированного пользователя\n\n` +
        `👤 User ID: ${userId}\n` +
        `📝 Username: @${username}\n` +
        `💬 Сообщение: "${truncatedText}"\n` +
        (messageLink ? `🔗 ${messageLink}\n` : '') +
        `\nСообщение оставлено в чате. Заблокировать — сообщения этого пользователя будут удалены.`;

      await SafeTelegramHelper.safeSend(
        () =>
          this.bot.telegram.sendMessage(this.adminChatId, notificationText, createReviewKeyboard(userId, messageId)),
        `Admin review request about user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Error sending admin review request for user ${userId}:`, error);
    }
  }

  private buildMessageLink(messageId: number): string | null {
    const raw = String(this.chatId);
    if (!raw.startsWith('-100')) return null;
    return `https://t.me/c/${raw.slice(4)}/${messageId}`;
  }

  // Решение владельца «заблокировать»: бан в чате + удаление всех его сообщений,
  // накопленных за время проверки.
  async banUser(userId: number, messageId: number): Promise<boolean> {
    try {
      this.logger.log(`Banning user ${userId} by admin decision, deleting messages pending review`);

      const banned = await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.banChatMember(this.chatId, userId),
        `Ban user ${userId} by admin decision`,
      );

      const pendingKey = `${this.SPAM_PENDING_PREFIX}${userId}`;
      const collected = await this.redis.lrange(pendingKey, 0, -1);
      const messageIds = new Set<number>([messageId, ...collected.map(Number).filter((id) => Number.isFinite(id))]);

      for (const id of messageIds) {
        await SafeTelegramHelper.safeSend(
          () => this.bot.telegram.deleteMessage(this.chatId, id),
          `Delete message ${id} from user ${userId}`,
        );
      }

      await this.cacheUserCheck(userId, false);
      await this.redis.del(pendingKey);

      this.logger.log(`Deleted ${messageIds.size} message(s) from banned user ${userId}`);

      return banned !== undefined;
    } catch (error) {
      this.logger.error(`Error banning user ${userId}:`, error);
      return false;
    }
  }

  // Решение владельца «не блокировать»: сообщение остаётся, пользователь регистрируется
  // и больше не попадает на проверку. Ключ в Dragonfly решение не хранит: он вытесняется.
  async approveUser(userId: number, username?: string): Promise<void> {
    try {
      const user = await this.accountClient.upsertByTelegramId(userId, username);
      await this.accountClient.updateTelegramProfile(user.id, { inChat: true });
      await this.cacheUserCheck(userId, true, this.APPROVED_TTL);
      await this.redis.del(`${this.SPAM_PENDING_PREFIX}${userId}`, `${this.SPAM_CHECK_PREFIX}${userId}`);

      this.logger.log(`Admin approved user ${userId}, message kept in chat`);
    } catch (error) {
      this.logger.error(`Error approving user ${userId}:`, error);
    }
  }

  async unbanUser(userId: number, username: string): Promise<AccountResponseDto | null> {
    try {
      this.logger.log(`Unbanning user ${userId} (@${username}) by admin request`);

      // Разбаниваем в чате
      await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.unbanChatMember(this.chatId, userId),
        `Unban user ${userId}`,
      );

      // Регистрируем в account-service (дефолтный бесплатный тариф + токен)
      const newUser = await this.accountClient.upsertByTelegramId(userId, username);
      await this.accountClient.updateTelegramProfile(newUser.id, { inChat: true });

      // Обновляем кэш
      await this.cacheUserCheck(userId, true);

      // Очищаем кулдаун для проверок и ожидание решения
      await this.redis.del(`${this.SPAM_CHECK_PREFIX}${userId}`, `${this.SPAM_PENDING_PREFIX}${userId}`);

      this.logger.log(`Successfully unbanned and registered user ${userId} (@${username})`);

      return newUser;
    } catch (error) {
      this.logger.error(`Error unbanning user ${userId}:`, error);
      return null;
    }
  }

  async clearUserCache(userId: number): Promise<void> {
    try {
      const cacheKey = `${this.SPAM_USER_PREFIX}${userId}`;
      const cooldownKey = `${this.SPAM_CHECK_PREFIX}${userId}`;
      const pendingKey = `${this.SPAM_PENDING_PREFIX}${userId}`;

      await this.redis.del(cacheKey, cooldownKey, pendingKey);

      this.logger.log(`Cleared cache for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error clearing cache for user ${userId}:`, error);
    }
  }
}
