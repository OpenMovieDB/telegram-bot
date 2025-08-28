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

@Update()
@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
export class BotUpdate {
  private readonly adminChatId: number;

  private readonly logger = new Logger(BotUpdate.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
  ) {
    this.adminChatId = Number(configService.get('ADMIN_CHAT_ID'));
  }

  @Start()
  async onStart(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) {
      await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
        reply_markup: {
          remove_keyboard: true,
        },
      });
      return;
    }

    ctx.session.messageId = undefined;

    await ctx.scene.enter(CommandEnum.START);
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
          () => this.bot.telegram.sendMessage(this.adminChatId, '❌ Не указан ID платежа!\nИспользование: /retry <paymentId>'),
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
          () => this.bot.telegram.sendMessage(
            this.adminChatId, 
            `🔄 Платеж ${paymentId} сброшен в статус PENDING\n` +
            `💳 Система: ${payment.paymentSystem}\n` +
            `💰 Сумма: ${payment.amount} ₽\n` +
            `👤 User ID: ${payment.userId}\n\n` +
            `⏱ Платеж будет проверен в течение 10 секунд`
          ),
          'Admin retry command success',
        );

        // Try to validate immediately
        this.logger.debug(`Manually retrying payment ${paymentId}`);
        const isPaid = await this.paymentService.validatePayment(paymentId);
        
        if (isPaid) {
          const user = await this.userService.findOneByUserId(payment.userId);
          
          await SafeTelegramHelper.safeSend(
            () => this.bot.telegram.sendMessage(this.adminChatId, `✅ Платеж ${paymentId} успешно оплачен после повторной проверки!`),
            'Admin retry: payment success',
          );
          
          // Send success messages to user
          await this.botService.sendPaymentSuccessMessage(
            payment.chatId,
            user.tariffId.name,
            user.subscriptionEndDate,
          );
          
          await this.botService.sendPaymentSuccessMessageToAdmin(
            user.username,
            user.tariffId.name,
            payment.monthCount,
            payment.amount,
            payment.paymentSystem,
            payment.discount,
            payment.originalPrice,
          );
        } else {
          await SafeTelegramHelper.safeSend(
            () => this.bot.telegram.sendMessage(this.adminChatId, `⏳ Платеж ${paymentId} все еще не оплачен. Будет проверяться автоматически.`),
            'Admin retry: payment still pending',
          );
        }
      } catch (error) {
        this.logger.error(`Error in retry command: ${error.message}`, error.stack);
        await SafeTelegramHelper.safeSend(
          () => this.bot.telegram.sendMessage(
            this.adminChatId, 
            `❌ Ошибка при повторной проверке платежа ${paymentId}:\n${error.message}`
          ),
          'Admin retry command error',
        );
      }
    }
  }

  @Action(/.*/)
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

  @Hears(BUTTONS[CommandEnum.HOME].text)
  async onMenuHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    try {
      this.logger.log('hears', ctx.message);
      // Clear messageId when navigating via text commands
      ctx.session.messageId = undefined;
      const existUser = await this.userService.findOneByUserId(ctx.from.id);
      if (existUser) {
        ctx.scene.enter(CommandEnum.HOME);
      } else {
        ctx.scene.enter(CommandEnum.START);
      }
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears(/.*/)
  async onHears(@Ctx() ctx: Context & { update: any }) {
    const user = await this.userService.findOneByUserId(ctx.from.id);
    if (user && !user.chatId) await this.userService.update(user.userId, { chatId: ctx.chat.id });
    try {
      const message = ctx.update.message;
      const [command] = Object.entries(BUTTONS).find(([_, button]) => button.text === message.text);

      if (!['private'].includes(message.chat.type)) return;

      this.logger.log('stats', ctx.message);
      // Clear messageId when navigating via text commands
      ctx.session.messageId = undefined;
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

  private isAdmin(ctx: Context): boolean {
    return ctx.chat.id === this.adminChatId;
  }
}
