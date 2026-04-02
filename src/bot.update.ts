import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import { Action, Command, Ctx, Hears, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotService } from './bot.service';
import { BOT_NAME } from './constants/bot-name.const';
import { ResponseTimeInterceptor } from './interceptors/response-time-interceptor.service';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { Context } from './interfaces/context.interface';
import { SceneContext } from 'telegraf/typings/scenes';
import { CommandEnum } from './enum/command.enum';
import { UserService } from './user/user.service';
import { BUTTONS } from './constants/buttons.const';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment/payment.service';
import { TariffService } from './tariff/tariff.service';
import { PaymentSystemEnum } from './payment/enum/payment-system.enum';
import { DateTime } from 'luxon';
import { PaymentStatusEnum } from './payment/enum/payment-status.enum';
import { SafeTelegramHelper } from './helpers/safe-telegram.helper';
import { ModerationService } from './moderation/moderation.service';
import { createUnbanConfirmationKeyboard } from './moderation/keyboards/moderation.keyboards';
import { SessionStateService } from './session/session-state.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Update()
@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
export class BotUpdate {
  private readonly adminChatId: number;
  private readonly redis: Redis;

  private readonly logger = new Logger(BotUpdate.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
    private readonly moderationService: ModerationService,
    private readonly sessionStateService: SessionStateService,
    private readonly redisService: RedisService,
  ) {
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
    this.redis = this.redisService.getOrThrow();
  }

  @Start()
  async onStart(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) {
      await SafeTelegramHelper.safeSend(
        () =>
          ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
            reply_markup: {
              remove_keyboard: true,
            },
          }),
        `Group chat instruction to ${ctx.chat.id}`,
      );
      return;
    }

    const args = ctx.state?.command?.args;
    if (args && args.length === 1 && /^[0-9a-f]{64}$/i.test(args[0])) {
      const handled = await this.handleDashboardAuth(ctx, args[0]);
      if (handled) return;
    }

    await this.sessionStateService.clearMessageId(ctx.from.id);

    await ctx.scene.enter(CommandEnum.START);
  }

  @Command('admin')
  async onAdminCommand(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) {
      return;
    }

    if (this.isAdmin(ctx)) {
      await ctx.scene.enter(CommandEnum.ADMIN_MENU);
    } else {
      await SafeTelegramHelper.safeSend(
        () => ctx.reply('У вас нет прав для доступа к админ панели'),
        `Unauthorized admin access attempt from ${ctx.from.id}`,
      );
    }
  }

  @Command('pay')
  async onPayCommand(@Ctx() ctx: Context & { update: any }) {
    if (this.isAdmin(ctx)) {
      const [token, tariffName, monthCount, startAt] = ctx.state.command.args;
      if (!(token && tariffName)) throw new Error('Не указан один из обязательных параметров!');
      const paymentMonths = monthCount || 1;
      const paymentAt = startAt ? DateTime.fromFormat(startAt, 'dd.MM.yyyy').toJSDate() : undefined;

      const user = await this.userService.findUserByToken(token.toUpperCase());
      const tariff = await this.tariffService.getOneByName(tariffName.toUpperCase());
      const payment = await this.paymentService.createPayment(
        user.userId,
        user.chatId,
        tariff._id.toString(),
        PaymentSystemEnum.CASH,
        paymentMonths,
        '',
        paymentAt,
      );

      await SafeTelegramHelper.safeSend(
        () => this.bot.telegram.sendMessage(this.adminChatId, `Создан заказ с id: ${payment.paymentId}`),
        'Admin notification: payment created',
      );
    }
  }

  @Command('confirm')
  async onConfirmCommand(@Ctx() ctx: Context & { update: any }) {
    if (this.isAdmin(ctx)) {
      const [paymentId] = ctx.state.command.args;
      if (!paymentId) throw new Error('Не указан один из обязательных параметров!');

      // First mark payment as PAID without final flag to allow validation
      await this.paymentService.updatePaymentStatus(paymentId, PaymentStatusEnum.PAID, false);

      // Trigger validation to process the payment and update user
      const isPaid = await this.paymentService.validatePayment(paymentId);

      if (isPaid) {
        await SafeTelegramHelper.safeSend(
          () => this.bot.telegram.sendMessage(this.adminChatId, `✅ Оплата ${paymentId} подтверждена и обработана`),
          'Admin notification: payment confirmed',
        );

        // Send notification to user
        const payment = await this.paymentService.findPaymentByPaymentId(paymentId);
        if (payment) {
          const tariff = await this.tariffService.getOneById(payment.tariffId);
          await SafeTelegramHelper.safeSend(
            () =>
              this.bot.telegram.sendMessage(
                payment.chatId,
                `✅ Ваша оплата подтверждена!\n\n` +
                  `Тариф: ${tariff.name}\n` +
                  `Период: ${payment.monthCount} мес.\n\n` +
                  `Подписка активирована. Спасибо за оплату!`,
              ),
            `User payment confirmation to ${payment.chatId}`,
          );
        }
      } else {
        await SafeTelegramHelper.safeSend(
          () => this.bot.telegram.sendMessage(this.adminChatId, `⚠️ Оплата ${paymentId} не может быть подтверждена`),
          'Admin notification: payment error',
        );
      }
    }
  }

  @Command('comfirm')
  async onComfirmCommand(@Ctx() ctx: Context & { update: any }) {
    // Redirect to correct command
    return this.onConfirmCommand(ctx);
  }

  @Command('retry')
  async onRetryCommand(@Ctx() ctx: Context & { update: any }) {
    if (this.isAdmin(ctx)) {
      const [paymentId] = ctx.state.command.args;
      if (!paymentId) {
        await SafeTelegramHelper.safeSend(
          () =>
            this.bot.telegram.sendMessage(
              this.adminChatId,
              '❌ Не указан ID платежа!\nИспользование: /retry <paymentId>',
            ),
          'Admin retry command error',
        );
        return;
      }

      try {
        // Find the payment
        const payment = await this.paymentService.findPaymentByPaymentId(paymentId);
        if (!payment) {
          await SafeTelegramHelper.safeSend(
            () => this.bot.telegram.sendMessage(this.adminChatId, `❌ Платеж с ID ${paymentId} не найден`),
            'Admin retry: payment not found',
          );
          return;
        }

        // Reset payment status to PENDING and clear final flag
        await this.paymentService.updatePaymentStatus(paymentId, PaymentStatusEnum.PENDING, false);

        await SafeTelegramHelper.safeSend(
          () =>
            this.bot.telegram.sendMessage(
              this.adminChatId,
              `🔄 Платеж ${paymentId} сброшен в статус PENDING\n` +
                `💳 Система: ${payment.paymentSystem}\n` +
                `💰 Сумма: ${payment.amount} ₽\n` +
                `👤 User ID: ${payment.userId}\n\n` +
                `⏱ Платеж будет проверен в течение 10 секунд`,
            ),
          'Admin retry command success',
        );

        // Try to validate immediately
        this.logger.debug(`Manually retrying payment ${paymentId}`);
        const isPaid = await this.paymentService.validatePayment(paymentId);

        if (isPaid) {
          const user = await this.userService.findOneByUserId(payment.userId);

          await SafeTelegramHelper.safeSend(
            () =>
              this.bot.telegram.sendMessage(
                this.adminChatId,
                `✅ Платеж ${paymentId} успешно оплачен после повторной проверки!`,
              ),
            'Admin retry: payment success',
          );

          // Send success messages to user asynchronously (command execution should not depend on message delivery)
          this.botService
            .sendPaymentSuccessMessage(payment.chatId, user.tariffId.name, user.subscriptionEndDate)
            .catch((error) => {
              this.logger.error(`Failed to send payment success message: ${error.message}`);
            });

          this.botService
            .sendPaymentSuccessMessageToAdmin(
              user.username,
              user.tariffId.name,
              payment.monthCount,
              payment.amount,
              payment.paymentSystem,
              payment.discount,
              payment.originalPrice,
            )
            .catch((error) => {
              this.logger.error(`Failed to send admin notification: ${error.message}`);
            });
        } else {
          await SafeTelegramHelper.safeSend(
            () =>
              this.bot.telegram.sendMessage(
                this.adminChatId,
                `⏳ Платеж ${paymentId} все еще не оплачен. Будет проверяться автоматически.`,
              ),
            'Admin retry: payment still pending',
          );
        }
      } catch (error) {
        this.logger.error(`Error in retry command: ${error.message}`, error.stack);
        await SafeTelegramHelper.safeSend(
          () =>
            this.bot.telegram.sendMessage(
              this.adminChatId,
              `❌ Ошибка при повторной проверке платежа ${paymentId}:\n${error.message}`,
            ),
          'Admin retry command error',
        );
      }
    }
  }

  @Action(/^(?!unban_|ignore_|clear_cache_|tariff_|months_|page_|user_|select_tariff_|new_tariff_months_|extend_|back_user_|show_token_|change_token_|change_tariff_|extend_subscription_|back_to_user_).*$/)
  async onAnswer(@Ctx() ctx: SceneContext & { update: any }) {
    this.logger.log(ctx);
    try {
      const cbQuery = ctx.update.callback_query;
      if (!['private'].includes(cbQuery.message.chat.type)) return;
      const nextStep = 'data' in cbQuery ? cbQuery.data : null;
      await ctx.scene.enter(nextStep);
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears('➕ Создать пользователя')
  async onCreateUserHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('CREATE_USER button pressed');
    await ctx.scene.enter(CommandEnum.CREATE_USER);
  }

  @Hears('🧾 Создать счет')
  async onCreateInvoiceHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('CREATE_INVOICE button pressed');
    await ctx.scene.enter(CommandEnum.CREATE_INVOICE);
  }

  @Hears('📋 Список пользователей')
  async onListUsersHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('LIST_USERS button pressed');
    await ctx.scene.enter(CommandEnum.LIST_USERS);
  }

  @Hears('⏰ Истекающие подписки')
  async onExpiringSubscriptionsHears(@Ctx() ctx: Context & { update: any}) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('EXPIRING_SUBSCRIPTIONS button pressed');
    await ctx.scene.enter(CommandEnum.EXPIRING_SUBSCRIPTIONS);
  }

  @Hears(BUTTONS[CommandEnum.HOME].text)
  async onMenuHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    try {
      this.logger.log('hears', ctx.message);
      // Clear messageId when navigating via text commands
      await this.sessionStateService.clearMessageId(ctx.from.id);
      const existUser = await this.userService.findOneByUserId(ctx.from.id);
      if (existUser) {
        await ctx.scene.enter(CommandEnum.HOME);
      } else {
        await ctx.scene.enter(CommandEnum.START);
      }
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears([
    BUTTONS[CommandEnum.GET_ACCESS].text,
    BUTTONS[CommandEnum.QUESTION].text,
    BUTTONS[CommandEnum.I_HAVE_TOKEN].text,
    BUTTONS[CommandEnum.FREE_TARIFF].text,
    BUTTONS[CommandEnum.DEVELOPER_TARIFF].text,
    BUTTONS[CommandEnum.UNLIMITED_TARIFF].text,
    BUTTONS[CommandEnum.STUDENT_TARIFF].text,
    BUTTONS[CommandEnum.GET_REQUEST_STATS].text,
    BUTTONS[CommandEnum.UPDATE_TARIFF].text,
    BUTTONS[CommandEnum.GET_MY_TOKEN].text,
    BUTTONS[CommandEnum.CHANGE_TOKEN].text,
    BUTTONS[CommandEnum.UPDATE_MOVIE].text,
    BUTTONS[CommandEnum.SET_IMDB_RELATION].text,
    BUTTONS[CommandEnum.CREATE_USER].text,
    BUTTONS[CommandEnum.LIST_USERS].text,
    BUTTONS[CommandEnum.EXPIRING_SUBSCRIPTIONS].text,
    BUTTONS[CommandEnum.DEMO_TARIFF].text,
    BUTTONS[CommandEnum.BASIC_TARIFF].text,
    BUTTONS[CommandEnum.NOLIMIT_TARIFF].text,
  ])
  async onButtonHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    // Обрабатываем только в private чатах
    if (!['private'].includes(message.chat.type)) return;

    const user = await this.userService.findOneByUserId(ctx.from.id);
    if (user && !user.chatId) await this.userService.update(user.userId, { chatId: ctx.chat.id });

    try {
      const buttonEntry = Object.entries(BUTTONS).find(([_, button]) => button.text === message.text);

      if (!buttonEntry) return;

      const [command] = buttonEntry;

      this.logger.log('stats', ctx.message);
      // Clear messageId when navigating via text commands
      await this.sessionStateService.clearMessageId(ctx.from.id);
      ctx.scene.enter(command);
    } catch (e) {
      this.logger.log(e);
    }
  }

  @On('new_chat_members')
  async onNewChatMembers(@Ctx() ctx: Context & { update: any }) {
    await this.botService.createInvitedUser(ctx);
  }

  @On('left_chat_member')
  async onLeftChatMember(@Ctx() ctx: Context & { update: any }) {
    this.logger.log('left_chat_member', ctx);
    this.botService.leftTheChat(ctx);
  }

  @On('text')
  async onGroupText(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    const targetChatId = Number(this.configService.get('CHAT_ID'));

    // Проверяем только сообщения в целевом чате
    if (message.chat.id !== targetChatId) {
      return;
    }

    // Пропускаем private чаты (они обрабатываются отдельно)
    if (message.chat.type === 'private') {
      return;
    }

    // Запускаем проверку пользователя через сервис модерации
    await this.moderationService.checkAndModerateUser(ctx);
  }

  @On('message')
  async onGroupMessage(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    const targetChatId = Number(this.configService.get('CHAT_ID'));

    // Проверяем только сообщения в целевом чате
    if (message.chat.id !== targetChatId) {
      return;
    }

    // Пропускаем private чаты и уже обработанные текстовые сообщения
    if (message.chat.type === 'private' || message.text) {
      return;
    }

    // Проверяем остальные типы сообщений (стикеры, фото, документы и т.д.)
    await this.moderationService.checkAndModerateUser(ctx);
  }

  @Action(/^unban_(\d+)$/)
  async onUnbanUser(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    if (!this.isAdmin(ctx)) {
      await SafeTelegramHelper.safeSend(
        () => ctx.answerCbQuery('У вас нет прав для выполнения этой операции'),
        'Unauthorized unban attempt',
      );
      return;
    }

    try {
      const userId = parseInt(ctx.match[1]);
      const callbackQuery = ctx.update.callback_query;
      const originalMessage =
        'message' in callbackQuery && 'text' in callbackQuery.message ? callbackQuery.message.text : '';

      // Извлекаем username из оригинального сообщения
      const usernameMatch = originalMessage.match(/Username: @([^\n]+)/);
      const username = usernameMatch ? usernameMatch[1] : 'Unknown';

      const user = await this.moderationService.unbanUser(userId, username);

      if (user) {
        await SafeTelegramHelper.safeSend(
          () =>
            ctx.editMessageText(
              `✅ Пользователь ${userId} (@${username}) разбанен и добавлен в базу данных\n\n` +
                `🆔 User ID: ${user.userId}\n` +
                `🏷 Токен: ${user.token?.slice(0, 8)}...\n` +
                `📅 Создан: ${new Date().toLocaleString('ru-RU')}\n\n` +
                `Пользователь теперь может писать в чате.`,
              createUnbanConfirmationKeyboard(userId),
            ),
          `Edit message after unban user ${userId}`,
        );

        await SafeTelegramHelper.safeSend(
          () => ctx.answerCbQuery('✅ Пользователь успешно разбанен!'),
          'Unban success callback',
        );

        this.logger.log(`Admin unbanned user ${userId} (@${username})`);
      } else {
        await SafeTelegramHelper.safeSend(
          () =>
            ctx.editMessageText(
              `❌ Ошибка при разбане пользователя ${userId} (@${username})\n\n` +
                `Проверьте логи приложения для дополнительной информации.`,
            ),
          `Edit message after unban error ${userId}`,
        );

        await SafeTelegramHelper.safeSend(
          () => ctx.answerCbQuery('❌ Ошибка при разбане пользователя'),
          'Unban error callback',
        );
      }
    } catch (error) {
      this.logger.error('Error in onUnbanUser:', error);
      await SafeTelegramHelper.safeSend(() => ctx.answerCbQuery('❌ Произошла ошибка'), 'Unban exception callback');
    }
  }

  @Action(/^ignore_(\d+)$/)
  async onIgnoreUser(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    if (!this.isAdmin(ctx)) {
      await SafeTelegramHelper.safeSend(
        () => ctx.answerCbQuery('У вас нет прав для выполнения этой операции'),
        'Unauthorized ignore attempt',
      );
      return;
    }

    try {
      const userId = parseInt(ctx.match[1]);

      await SafeTelegramHelper.safeSend(
        () => ctx.editMessageText(`❌ Пользователь ${userId} оставлен в бане\n\n` + `Сообщение обработано админом.`),
        `Edit message after ignore user ${userId}`,
      );

      await SafeTelegramHelper.safeSend(
        () => ctx.answerCbQuery('Пользователь оставлен в бане'),
        'Ignore user callback',
      );

      this.logger.log(`Admin ignored unban request for user ${userId}`);
    } catch (error) {
      this.logger.error('Error in onIgnoreUser:', error);
      await SafeTelegramHelper.safeSend(() => ctx.answerCbQuery('❌ Произошла ошибка'), 'Ignore exception callback');
    }
  }

  @Action(/^clear_cache_(\d+)$/)
  async onClearUserCache(@Ctx() ctx: Context & { match: RegExpMatchArray }) {
    if (!this.isAdmin(ctx)) {
      await SafeTelegramHelper.safeSend(
        () => ctx.answerCbQuery('У вас нет прав для выполнения этой операции'),
        'Unauthorized cache clear attempt',
      );
      return;
    }

    try {
      const userId = parseInt(ctx.match[1]);
      await this.moderationService.clearUserCache(userId);

      await SafeTelegramHelper.safeSend(() => ctx.answerCbQuery('✅ Кэш пользователя очищен'), 'Cache clear callback');

      this.logger.log(`Admin cleared cache for user ${userId}`);
    } catch (error) {
      this.logger.error('Error in onClearUserCache:', error);
      await SafeTelegramHelper.safeSend(
        () => ctx.answerCbQuery('❌ Ошибка при очистке кэша'),
        'Cache clear error callback',
      );
    }
  }

  private async handleDashboardAuth(ctx: Context & { update: any }, token: string): Promise<boolean> {
    const authKey = `auth_request:${token}`;
    const linkKey = `auth_link:${token}`;

    let key: string | undefined;
    let data = await this.redis.get(authKey);
    if (data) {
      key = authKey;
    } else {
      data = await this.redis.get(linkKey);
      if (data) key = linkKey;
    }

    if (!key || !data) return false;

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(data);
    } catch {
      return false;
    }

    if (parsed.status !== 'pending') return false;

    const telegramUser = ctx.from;
    const updated: Record<string, any> = {
      ...parsed,
      status: 'confirmed',
      telegram_id: telegramUser.id,
      username: telegramUser.username || '',
      first_name: telegramUser.first_name || '',
    };

    const ttl = await this.redis.ttl(key);
    await this.redis.set(key, JSON.stringify(updated), 'EX', ttl > 0 ? ttl : 300);

    const message =
      key === linkKey
        ? '✅ Telegram успешно привязан к вашему аккаунту!\n\nМожете вернуться в браузер.'
        : '✅ Авторизация в личном кабинете подтверждена!\n\nМожете вернуться в браузер.';

    const { Markup } = await import('telegraf');
    await SafeTelegramHelper.safeSend(
      () =>
        ctx.reply(message, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [BUTTONS[CommandEnum.GET_ACCESS]],
            [BUTTONS[CommandEnum.I_HAVE_TOKEN], BUTTONS[CommandEnum.QUESTION]],
          ]),
        }),
      `Dashboard auth confirmation to ${ctx.chat.id}`,
    );

    this.logger.log(`Dashboard auth confirmed for telegram user ${telegramUser.id} (key: ${key})`);
    return true;
  }

  private isAdmin(ctx: Context): boolean {
    return ctx.chat.id === this.adminChatId;
  }
}
