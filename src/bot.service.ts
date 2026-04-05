import { Injectable, Logger } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';

import { InjectBot } from 'nestjs-telegraf';
import { BOT_NAME } from './constants/bot-name.const';
import { User as TelegramUser } from 'typegram/manage';
import { UserService } from './user/user.service';
import { TariffService } from './tariff/tariff.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { User } from './user/schemas/user.schema';
import { DateTime } from 'luxon';
import { PaymentSystemEnum } from './payment/enum/payment-system.enum';
import { SafeTelegramHelper } from './helpers/safe-telegram.helper';

@Injectable()
export class BotService {
  private readonly chatId: string;
  private readonly adminChatId: string;
  private readonly isProd: boolean;

  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly configService: ConfigService,
  ) {
    this.chatId = configService.get('CHAT_ID');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  async sendMessage(chatId: number, message: string): Promise<void> {
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(chatId, message),
      `Message to chat ${chatId}`,
    );
  }

  async sendPaymentSuccessMessage(chatId: number, tariffName: string, subscriptionEndDate: Date): Promise<void> {
    const message = `Тариф ${tariffName} успешно оплачен 🎉 \n\nПодписка действует до: ${DateTime.fromJSDate(
      subscriptionEndDate,
    ).toFormat('dd MMMM yyyy', { locale: 'ru' })}\n\nВы можете продолжить использование бота.`;

    // Send message with home menu button to trigger scene exit
    await SafeTelegramHelper.safeSend(
      () =>
        this.bot.telegram.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [[{ text: '🏠 В главное меню', callback_data: 'home_menu' }]],
          },
        }),
      `Payment success message to chat ${chatId}`,
    );
  }

  async sendPaymentSuccessMessageToAdmin(
    username: string,
    tariffName: string,
    monthCount: number,
    amount: number,
    paymentSystem: PaymentSystemEnum,
    discount?: number,
    originalPrice?: number,
  ): Promise<void> {
    const totalAmount = amount * monthCount;
    let message = `Пользователь ${username} оплатил тариф ${tariffName} на срок ${monthCount} мес.\n`;

    if (discount && discount > 0) {
      message += `💰 Применена скидка за переход с другого тарифа:\n`;
      message += `├ Полная стоимость: ${originalPrice} ₽\n`;
      message += `├ Скидка: -${discount} ₽\n`;
      message += `└ Оплачено: ${totalAmount} ₽\n`;
    } else {
      message += `💰 Оплаченная сумма: ${totalAmount} ₽\n`;
    }

    message += `Платежная система: ${paymentSystem} 🎉`;

    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(this.adminChatId, message),
      'Admin payment notification',
    );
  }

  async sendPaymentErrorToAdmin(
    username: string,
    userId: number,
    paymentId: string,
    paymentSystem: string,
    amount: number,
    errorMessage: string,
    errorStack?: string,
  ): Promise<void> {
    const message =
      `🚨 ОШИБКА ПЛАТЕЖА\n\n` +
      `👤 Пользователь: @${username} (ID: ${userId})\n` +
      `🔖 ID платежа: ${paymentId}\n` +
      `💳 Платежная система: ${paymentSystem}\n` +
      `💰 Сумма: ${amount} ₽\n\n` +
      `❌ Ошибка: ${errorMessage}\n\n` +
      `📋 Детали:\n\`\`\`\n${errorStack ? errorStack.substring(0, 1000) : 'Нет дополнительной информации'}\n\`\`\``;

    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' }),
      'Admin payment error notification',
    );
  }

  async sendSubscriptionExpiredMessage(chatId: number) {
    const message = 'Срок действия вашей подписки истек. Тариф был изменен на бесплатный 🫣';
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(chatId, message),
      `Subscription expired notification to ${chatId}`,
    );
  }

  async sendSubscriptionExpirationWarningMessage(chatId: number, expirationDate: Date) {
    const message = `Срок действия вашей подписки истекает ${expirationDate.toLocaleDateString()} ⚠️ Пожалуйста, не забудьте продлить свою подписку.`;
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(chatId, message),
      `Subscription warning to ${chatId}`,
    );
  }

  async sendTextMessageToAllUsers(message: string) {
    const usersTgID = await this.userService.getAllUserTgIDs();
    for (const chatId of usersTgID) {
      await SafeTelegramHelper.safeSend(() => this.bot.telegram.sendMessage(chatId, message), `Broadcast to ${chatId}`);
    }
  }

  async createInvitedUser(ctx: Context) {
    const members: TelegramUser[] = ctx.update?.['message']?.['new_chat_members'];
    this.logger.log(`NewChatMembers: ${members.map((member: any) => member.username).join(', ')}`);

    if (members) {
      const freeTariff = await this.tariffService.getFreeTariff();
      for (const member of members) {
        try {
          const user = await this.userService.upsert({
            userId: member.id,
            username: member?.username || null,
            inChat: true,
            tariffId: freeTariff?._id,
          });

          this.logger.log(`User ${user.username} created`);
        } catch (e) {
          this.logger.error(`Failed to create/update user ${member.username} (${member.id}):`, e);
        }
      }
    }
  }

  async leftTheChat(ctx: Context) {
    await this.userService.blockUser(ctx.from.id, false);

    this.logger.log(`User ${ctx.from.username} blocked`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkUsers() {
    this.logger.log('Check users');
    if (!this.isProd) return;
    const users = await this.userService.findUsersInChat();

    const telegramUsers = users.filter((user) => !user.isExternalUser);

    this.logger.log(
      `Users in chat: ${telegramUsers.length} (excluding ${users.length - telegramUsers.length} external users)`,
    );
    const leavedUsers = [];
    for (const user of telegramUsers) {
      try {
        const { status } = await this.bot.telegram.getChatMember(this.chatId, user.userId);
        if (status === 'left') leavedUsers.push(user);
      } catch (e) {
        if (!user.password && user.tariffId?.price === 0) {
          leavedUsers.push(user);
        }
      }
    }

    if (leavedUsers.length) {
      await SafeTelegramHelper.safeSend(
        () =>
          this.bot.telegram.sendMessage(
            this.adminChatId,
            `😵‍💫Пользователи, которые вчера покинули чат: ${leavedUsers
              .map((user) => user.username || user.userId)
              .join(', ')}`,
          ),
        'Admin notification: users left chat',
      );
      await this.blockUsers(leavedUsers);
    } else {
      await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.sendMessage(this.adminChatId, '😎 Никто не покинул чат'),
        'Admin notification: no users left chat',
      );
    }
  }

  private async blockUsers(users: User[]) {
    try {
      await Promise.all(
        users.map((user) => {
          this.logger.log(`User ${user.username} blocked`);
          return this.userService.blockUser(user.userId, false);
        }),
      );

      // await this.bot.telegram.sendMessage(
      //   user.userId,
      //   'Ваш токен был заблокирован, так как вы покинули наш чат 😢',
      // );
    } catch (e) {
      this.logger.error(e);
    }
  }

  async sendAdminSubscriptionExpirationWarning(
    username: string,
    expirationDate: Date,
    tariffName: string,
    daysLeft: number,
  ): Promise<void> {
    const emoji = daysLeft <= 3 ? '🔴' : daysLeft <= 7 ? '⚠️' : '⏰';
    const urgency = daysLeft === 0 ? 'СЕГОДНЯ' : daysLeft <= 3 ? 'СРОЧНО' : 'ВНИМАНИЕ';

    const message =
      `${emoji} ${urgency}: Подписка ${daysLeft === 0 ? 'истекает СЕГОДНЯ' : `истекает через ${daysLeft} дн.`}!\n\n` +
      `👤 Пользователь: ${username}\n` +
      `📅 Дата истечения: ${expirationDate.toLocaleDateString('ru-RU')}\n` +
      `💼 Тариф: ${tariffName}\n\n` +
      `${
        daysLeft === 0
          ? 'Пользователь будет переведен на бесплатный тариф.'
          : 'Рекомендуется связаться с пользователем для продления подписки.'
      }`;

    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(this.adminChatId, message),
      'Admin subscription expiration warning',
    );
  }
}
