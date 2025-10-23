import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';

import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from './enum/command.enum';
import { safeReply } from './utils/safe-reply.util';
import { BOT_NAME } from './constants/bot-name.const';
import { User as TelegramUser } from 'typegram/manage';
import { UserService } from './user/user.service';
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
    private readonly configService: ConfigService,
  ) {
    this.chatId = configService.get('CHAT_ID');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
    this.isProd = configService.get('NODE_ENV') === 'production';
  }

  async start(ctx: Context) {
    await safeReply(
      ctx,
      SCENES[CommandEnum.START].navigateText,
      Markup.inlineKeyboard(SCENES[CommandEnum.START].navigateButtons),
    );
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
    let message = `Пользователь ${username} оплатил тариф ${tariffName} на срок ${monthCount} мес.\n`;

    if (discount && discount > 0) {
      message += `💰 Применена скидка за переход с другого тарифа:\n`;
      message += `├ Полная стоимость: ${originalPrice} ₽\n`;
      message += `├ Скидка: -${discount} ₽\n`;
      message += `└ Оплачено: ${amount} ₽\n`;
    } else {
      message += `💰 Оплаченная сумма: ${amount} ₽\n`;
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
      for (const member of members) {
        const user = await this.userService.upsert({
          userId: member.id,
          username: member?.username || null,
          inChat: true,
        });

        this.logger.log(`User ${user.username} created`);
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

    this.logger.log(`Users in chat: ${users.length}`);
    const leavedUsers = [];
    for (const user of users) {
      try {
        const { status } = await this.bot.telegram.getChatMember(this.chatId, user.userId);
        if (status === 'left') leavedUsers.push(user);
      } catch (e) {
        if (!user.password && user.tariffId?.name?.toLowerCase() === 'free') {
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
}
