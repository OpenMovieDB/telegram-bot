import { Action, Ctx, Hears, Scene, SceneEnter, SceneLeave } from 'nestjs-telegraf';

import { AbstractScene } from '../abstract/abstract.scene';
import { CommandEnum } from '../enum/command.enum';
import { PaymentService } from '../payment/payment.service';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { Context } from 'src/interfaces/context.interface';
import { Markup } from 'telegraf';
import { safeReply } from 'src/utils/safe-reply.util';
import { SCENES } from 'src/constants/scenes.const';
import { TariffService } from 'src/tariff/tariff.service';
import { SessionStateService } from 'src/session/session-state.service';

@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
  private processingPayments = new Set<number>(); // Track users currently creating payments

  constructor(
    private readonly paymentService: PaymentService,
    private readonly tariffService: TariffService,
    private readonly sessionStateService: SessionStateService,
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);

    // Check if user should exit payment scene due to successful payment
    try {
      const paymentFlags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
      if (paymentFlags?.shouldExitPaymentScene) {
        this.logger.debug(`User ${ctx.from.id} should exit payment scene, redirecting to home`);
        await this.sessionStateService.removePaymentFlags(ctx.from.id);
        await ctx.scene.enter(CommandEnum.HOME);
        return;
      }
    } catch (error) {
      this.logger.error(`Failed to check payment flags for user ${ctx.from.id}:`, error);
    }

    const scene = SCENES[ctx.scene.session.current];

    // Reset only payment processing flags, keep tariffId and paymentMonths
    await this.sessionStateService.setPaymentInProgress(ctx.from.id, false);
    await this.sessionStateService.setWaitingForEmail(ctx.from.id, false);

    await safeReply(ctx, scene.text, Markup.inlineKeyboard(scene.buttons), this.sessionStateService);
  }

  @SceneLeave()
  async onSceneLeave(@Ctx() ctx: Context) {
    this.logger.log(`Leaving payment scene`);
    // Clear payment flags when leaving the scene (now in Redis)
    await this.sessionStateService.clearAllPaymentFlags(ctx.from.id);
  }

  @Action(CommandEnum.PAY_WITH_CRYPTOMUS)
  async payWithCriptomus(@Ctx() ctx: Context) {
    // Debounce check
    if (this.processingPayments.has(ctx.from.id)) {
      await ctx.reply('⏳ Платеж уже создается, пожалуйста подождите...');
      return;
    }

    await this.sessionStateService.setWaitingForEmail(ctx.from.id, false);
    await this.sessionStateService.setPaymentInProgress(ctx.from.id, true);
    await this.createPaymentAndReply(ctx, PaymentSystemEnum.CYPTOMUS);
  }

  @Action(CommandEnum.PAY_WITH_TBANK)
  async payWithTBank(@Ctx() ctx: Context) {
    // Debounce check
    if (this.processingPayments.has(ctx.from.id)) {
      await ctx.reply('⏳ Платеж уже создается, пожалуйста подождите...');
      return;
    }

    this.logger.debug(`Setting waitingForEmail=true for user ${ctx.from.id}`);
    await this.sessionStateService.setWaitingForEmail(ctx.from.id, true);
    await this.sessionStateService.setPaymentInProgress(ctx.from.id, false);

    // Verify flags were set
    const verifyFlags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    this.logger.debug(`Flags after setting for user ${ctx.from.id}:`, verifyFlags);

    await safeReply(
      ctx,
      'Отлично! Чтобы отправить вам чек, мне нужен ваш email! Пришлите его!',
      Markup.inlineKeyboard([]),
      this.sessionStateService,
    );
  }

  @Action('home_menu')
  async handleHomeMenuButton(@Ctx() ctx: Context) {
    this.logger.debug('Home menu button clicked in payment scene');
    // Clear payment flags and redirect to home
    await this.sessionStateService.clearAllPaymentFlags(ctx.from.id);
    await ctx.scene.enter(CommandEnum.HOME);
  }

  @Action('cancel_pending_payment')
  async handleCancelPendingPayment(@Ctx() ctx: Context) {
    this.logger.debug('Cancel pending payment button clicked');

    const cancelled = await this.paymentService.cancelUserPendingPayment(ctx.from.id);

    if (cancelled) {
      // The old Idempotency-Key now points at a cancelled payment — rotate it
      // so the next create starts fresh.
      await this.sessionStateService.rotatePaymentAttemptId(ctx.from.id);
      await ctx.answerCbQuery('✅ Платеж отменен');
      await ctx.editMessageText(
        '✅ Активный платеж успешно отменен.\n\n' + 'Теперь вы можете создать новый платеж с правильными параметрами.',
      );

      // Re-enter payment scene to show options again
      await ctx.scene.reenter();
    } else {
      await ctx.answerCbQuery('Активный платеж не найден');
      await ctx.editMessageText('Активный платеж не найден. Возможно, он уже был отменен или оплачен.');
    }
  }

  @Action('back_to_menu')
  async handleBackToMenu(@Ctx() ctx: Context) {
    this.logger.debug('Back to menu button clicked');
    await ctx.answerCbQuery();
    await ctx.scene.enter(CommandEnum.HOME);
  }

  @Hears(/[\w-]+@[\w-]+\.\w+/)
  async email(@Ctx() ctx: Context) {
    // Check if payment was successful and user should exit scene
    try {
      const paymentFlags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
      if (paymentFlags?.shouldExitPaymentScene) {
        this.logger.debug(`User ${ctx.from.id} payment successful, redirecting to home`);
        await this.sessionStateService.removePaymentFlags(ctx.from.id);
        await ctx.scene.enter(CommandEnum.HOME);
        return;
      }
    } catch (error) {
      this.logger.error(`Failed to check payment flags: ${error.message}`);
    }

    // Take the matched address, not the whole message — the user may have
    // typed words around it ("мой email x@y.z").
    const email = ctx.match?.[0] ?? ctx.message?.['text'];
    this.logger.debug(`user email ${email}`);

    // Check if we're waiting for email
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    if (!flags?.waitingForEmail) {
      // Don't block - just ignore if not waiting for email
      return;
    }

    await this.sessionStateService.setWaitingForEmail(ctx.from.id, false);
    return await this.createPaymentAndReply(ctx, PaymentSystemEnum.TBANK, email);
  }

  // Handle navigation commands (like "📊 статистика", "🆘 поддержка", etc.)
  @Hears(['📊 статистика', '🆘 поддержка', '🏠 главное меню', '🔄️ тариф', '🫣 токен', '⬅ назад'])
  async handleNavigationCommand(@Ctx() ctx: Context) {
    this.logger.debug('Navigation command received in payment scene, leaving scene');

    // Clear only processing flags, keep user selection (tariffId and paymentMonths)
    await this.sessionStateService.clearProcessingFlags(ctx.from.id);

    // Simply leave the scene - the main bot handler will process the command
    await ctx.scene.leave();
  }

  @Hears(/^(?!.*[\w-]+@[\w-]+\.\w+).*$/)
  async notAnEmail(@Ctx() ctx: Context) {
    // Check if payment was successful and user should exit scene
    try {
      const paymentFlags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
      if (paymentFlags?.shouldExitPaymentScene) {
        this.logger.debug(`User ${ctx.from.id} payment successful, redirecting to home`);
        await this.sessionStateService.removePaymentFlags(ctx.from.id);
        await ctx.scene.enter(CommandEnum.HOME);
        return;
      }
    } catch (error) {
      this.logger.error(`Failed to check payment flags: ${error.message}`);
    }

    // Check if we're waiting for email
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    if (flags?.waitingForEmail) {
      // Check if user is trying to navigate away (commands like /start, /help, etc.)
      const messageText = ctx.message?.['text']?.toLowerCase() || '';
      const isCommand =
        messageText.startsWith('/') ||
        ['📊 статистика', '🆘 поддержка', '🏠 главное меню', '🔄️ тариф', '🫣 токен', '⬅ назад'].includes(messageText);

      if (isCommand) {
        this.logger.debug(
          `User ${ctx.from.id} trying to navigate while waiting for email, clearing flags and leaving scene`,
        );
        await this.sessionStateService.clearProcessingFlags(ctx.from.id);
        await ctx.scene.leave();
        return;
      }

      await ctx.reply('Пожалуйста, введите корректный email адрес для получения чека.');
      return;
    }

    // Don't block user after payment creation - they can navigate freely
    // The payment scene will be exited automatically when payment succeeds
  }

  private async createPaymentAndReply(ctx: Context, paymentSystem: PaymentSystemEnum, email?: string) {
    this.logger.debug(`create payment with ${paymentSystem}`);

    // Add user to processing set
    this.processingPayments.add(ctx.from.id);

    try {
      const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);

      // First try to get data from existing pending payment
      const existingPayment = await this.paymentService.getUserPendingPayment(ctx.from.id);
      let paymentMonths: number;
      let tariffId: string;

      if (existingPayment) {
        // Use data from existing payment
        paymentMonths = existingPayment.payment_months;
        tariffId = existingPayment.tariff_id;
        this.logger.debug(`Using existing payment data: paymentMonths ${paymentMonths}, tariffId ${tariffId}`);
      } else {
        // Fallback to Redis flags for new payments
        paymentMonths = flags?.paymentMonths;
        tariffId = flags?.tariffId;

        if (!paymentMonths || !tariffId) {
          throw new Error('Отсутствуют данные о выбранном тарифе или сроке подписки');
        }
        this.logger.debug(`Using Redis flags: paymentMonths ${paymentMonths}, tariffId ${tariffId}`);
      }

      this.logger.debug(`Final values: paymentMonths ${paymentMonths}, tariffId ${tariffId}, email ${email}`);

      const payment = await this.paymentService.createPayment(
        ctx.from.id,
        ctx.from.username,
        tariffId,
        paymentSystem,
        paymentMonths,
        email,
        flags?.attemptId,
      );
      this.logger.debug(`payment ${JSON.stringify(payment)}`);

      if (!payment.payment_url) {
        // Telegram rejects url-buttons with an empty URL; without a link the
        // message is useless anyway.
        this.logger.error(`Payment ${payment.payment_id} has no payment_url (provider ${payment.provider})`);
        await ctx.reply('Произошла ошибка при создании ссылки на оплату. Пожалуйста, попробуйте снова.');
        return;
      }

      let message = `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\n`;

      // billing computes price + upgrade credit; amounts in the response are rubles.
      const tariff = await this.tariffService.getOneById(tariffId);
      const tariffName = tariff?.display_name ?? '—';

      if (payment.discount && payment.discount > 0) {
        message += `💰 <b>Применена скидка за остаток текущей подписки!</b>\n`;
        message += `├ Тариф: ${tariffName}\n`;
        message += `├ Период подписки: <b>${paymentMonths} мес</b>\n`;
        message += `├ Полная стоимость: ${payment.original_amount} ₽\n`;
        message += `├ Скидка: -${payment.discount} ₽\n`;
        message += `└ <b>Финальная стоимость: ${payment.amount} ₽</b>\n\n`;
      } else {
        message += `💰 Тариф: ${tariffName}\n`;
        message += `├ Подписка на: <b>${paymentMonths} мес</b>\n`;
        message += `└ <b>Финальная стоимость: ${payment.amount} ₽</b>\n\n`;
      }

      message += `После того как вы оплатите, я автоматически вам поменяю тариф.\n\n⏱ Ссылка действительна 24 часа.`;

      // Send payment message asynchronously to avoid blocking payment creation
      let sentMessage;
      try {
        sentMessage = await ctx.sendMessage(message, {
          ...Markup.inlineKeyboard([[Markup.button.url('👉 перейти к оплате', payment.payment_url)]]),
          parse_mode: 'HTML',
        });
        this.logger.debug(`sentMessage ${JSON.stringify(sentMessage)}`);
      } catch (messageError) {
        this.logger.error(
          `Failed to send payment message, but payment ${payment.payment_id} is created: ${messageError.message}`,
        );
        // Payment is created - user can still pay via other means, so continue
        return;
      }

      // Remove from processing set after successful payment creation
      this.processingPayments.delete(ctx.from.id);

      // Удаление кнопки через 20 минут
      setTimeout(async () => {
        const chatId = ctx.chat.id;
        const messageId = sentMessage.message_id;

        try {
          await ctx.telegram.editMessageText(
            chatId,
            messageId,
            undefined,
            `Ссылка на оплату истекла. Пожалуйста, попробуйте снова, если вы хотите оплатить подписку.`,
            { parse_mode: 'HTML' },
          );

          // Reset payment flags for this user (now in Redis)
          await this.sessionStateService.clearAllPaymentFlags(ctx.from.id);
        } catch (error) {
          this.logger.error(`Failed to edit expired payment message: ${error.message}`);
        }
      }, 1200000);
    } catch (error) {
      this.logger.error(`Failed to create payment for user ${ctx.from.id}: ${error.message}`, error.stack);

      // Remove user from processing set on error
      this.processingPayments.delete(ctx.from.id);

      // Check if there's already a pending payment
      if (error.message === 'PENDING_PAYMENT_EXISTS') {
        await ctx.reply(
          '⚠️ У вас уже есть активный платеж в обработке.\n\n' +
            'Вы можете:\n' +
            '• Оплатить по ранее отправленной ссылке\n' +
            '• Дождаться завершения платежа\n' +
            '• Отменить текущий платеж и создать новый',
          Markup.inlineKeyboard([
            [Markup.button.callback('❌ Отменить текущий платеж', 'cancel_pending_payment')],
            [Markup.button.callback('⬅️ Назад', 'back_to_menu')],
          ]),
        );
        return;
      }

      // Check if it's a downgrade attempt error
      if (error.message && error.message.startsWith('DOWNGRADE_NOT_ALLOWED:')) {
        const errorMessage = error.message.replace('DOWNGRADE_NOT_ALLOWED:', '');
        // Send error message asynchronously to avoid blocking scene navigation
        ctx.reply(`⚠️ <b>Невозможно понизить тариф</b>\n\n${errorMessage}`, { parse_mode: 'HTML' }).catch((err) => {
          this.logger.error(`Failed to send downgrade error message: ${err.message}`);
        });
        await ctx.scene.enter(CommandEnum.HOME);
      } else {
        // Send generic error message asynchronously
        ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.').catch((err) => {
          this.logger.error(`Failed to send generic error message: ${err.message}`);
        });
      }
    } finally {
      // Always remove user from processing set after operation completes
      this.processingPayments.delete(ctx.from.id);
    }
  }
}
