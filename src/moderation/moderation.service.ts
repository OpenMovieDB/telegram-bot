import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';

import { User } from '../user/schemas/user.schema';
import { UserService } from '../user/user.service';
import { Context } from '../interfaces/context.interface';
import { BOT_NAME } from '../constants/bot-name.const';
import { SafeTelegramHelper } from '../helpers/safe-telegram.helper';
import { createUnbanKeyboard } from './keyboards/moderation.keyboards';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly redis: Redis;
  private readonly chatId: number;
  private readonly adminChatId: number;

  private readonly SPAM_USER_PREFIX = 'spam:user:';
  private readonly SPAM_CHECK_PREFIX = 'spam:checked:';
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CHECK_COOLDOWN = 600; // 10 minutes

  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly userService: UserService,
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
        await this.moderateMessage(ctx, { userId, username, messageText: message.text });
        return;
      }

      // Проверка в базе данных
      let user: User | null = null;
      try {
        user = await this.checkUserInDatabase(userId);
      } catch (dbError) {
        // Ошибка БД - НЕ модерируем пользователя, только логируем
        this.logger.error(`Database error when checking user ${userId} (@${username}), skipping moderation:`, dbError);
        return;
      }

      if (user) {
        // Пользователь найден - кэшируем положительный результат
        await this.cacheUserCheck(userId, true);
        this.logger.log(`User ${userId} (@${username}) verified from database`);
      } else {
        // Пользователь действительно не найден - кэшируем отрицательный результат и модерируем
        await this.cacheUserCheck(userId, false);
        await this.moderateMessage(ctx, { userId, username, messageText: message.text });
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

  private async checkUserInDatabase(userId: number): Promise<User | null> {
    // Пробрасываем ошибки БД наружу для правильной обработки
    // null означает "пользователь не найден", ошибка означает "проблема с БД"
    const user = await this.userService.findOneByUserId(userId);
    return user || null;
  }

  private async cacheUserCheck(userId: number, exists: boolean): Promise<void> {
    try {
      const cacheKey = `${this.SPAM_USER_PREFIX}${userId}`;
      const value = exists ? 'exists' : 'not_exists';
      await this.redis.setex(cacheKey, this.CACHE_TTL, value);

      this.logger.debug(`Cached user check for ${userId}: ${value}`);
    } catch (error) {
      this.logger.error(`Error caching user check for ${userId}:`, error);
    }
  }

  private async moderateMessage(
    ctx: Context & { update: any },
    userInfo: { userId: number; username: string; messageText: string },
  ): Promise<void> {
    try {
      const { userId, username, messageText } = userInfo;
      const messageId = ctx.update.message.message_id;

      this.logger.warn(`Moderating spam message from user ${userId} (@${username})`);

      // Удаляем сообщение
      await SafeTelegramHelper.safeSend(
        () => ctx.deleteMessage(messageId),
        `Delete spam message ${messageId} from user ${userId}`,
      );

      // Баним пользователя
      await SafeTelegramHelper.safeSend(() => ctx.banChatMember(userId), `Ban spam user ${userId}`);

      // Отправляем уведомление админу
      await this.sendAdminNotification(userId, username, messageText);

      this.logger.log(`Successfully moderated spam from user ${userId} (@${username})`);
    } catch (error) {
      this.logger.error(`Error moderating message from user ${userInfo.userId}:`, error);
    }
  }

  private async sendAdminNotification(userId: number, username: string, messageText: string): Promise<void> {
    try {
      const truncatedText = messageText?.slice(0, 200) || 'No text';
      const notificationText =
        `🚫 Заблокирован спам от неизвестного пользователя\n\n` +
        `👤 User ID: ${userId}\n` +
        `📝 Username: @${username}\n` +
        `💬 Сообщение: "${truncatedText}"\n\n` +
        `Если это ошибка, нажмите кнопку разбана ниже:`;

      await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.sendMessage(this.adminChatId, notificationText, createUnbanKeyboard(userId, username)),
        `Admin notification about spam user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Error sending admin notification for user ${userId}:`, error);
    }
  }

  async unbanUser(userId: number, username: string): Promise<User | null> {
    try {
      this.logger.log(`Unbanning user ${userId} (@${username}) by admin request`);

      // Разбаниваем в чате
      await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.unbanChatMember(this.chatId, userId),
        `Unban user ${userId}`,
      );

      // Создаем пользователя в базе данных
      const newUser = await this.userService.create({
        userId,
        username,
        inChat: true,
      } as User);

      // Обновляем кэш
      await this.cacheUserCheck(userId, true);

      // Очищаем кулдаун для проверок
      const cooldownKey = `${this.SPAM_CHECK_PREFIX}${userId}`;
      await this.redis.del(cooldownKey);

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

      await Promise.all([this.redis.del(cacheKey), this.redis.del(cooldownKey)]);

      this.logger.log(`Cleared cache for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error clearing cache for user ${userId}:`, error);
    }
  }
}
