import { Action, Ctx, Hears, Scene, SceneEnter, SceneLeave } from 'nestjs-telegraf';

import { AbstractScene } from '../abstract/abstract.scene';
import { CommandEnum } from '../enum/command.enum';
import { PaymentService } from '../payment/payment.service';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { Context } from 'src/interfaces/context.interface';
import { Markup } from 'telegraf';
import { replyOrEdit } from 'src/utils/reply-or-edit.util';
import { SCENES } from 'src/constants/scenes.const';
import { DateTime } from 'luxon';
import { UserService } from 'src/user/user.service';
import { TariffService } from 'src/tariff/tariff.service';

@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
    private readonly tariffService: TariffService,
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];

    // Reset payment flags when entering the scene
    ctx.session.paymentInProgress = false;
    ctx.session.waitingForEmail = false;

    await replyOrEdit(ctx, scene.text, Markup.inlineKeyboard(scene.buttons));
  }

  @SceneLeave()
  async onSceneLeave(@Ctx() ctx: Context) {
    this.logger.log(`Leaving payment scene`);
    // Clear payment flags when leaving the scene
    if (ctx.session) {
      ctx.session.paymentInProgress = false;
      ctx.session.waitingForEmail = false;
    }
  }

  @Action(CommandEnum.PAY_WITH_CRYPTOMUS)
  async payWithCriptomus(@Ctx() ctx: Context) {
    ctx.session.waitingForEmail = false;
    ctx.session.paymentInProgress = true;
    await this.createPaymentAndReply(ctx, PaymentSystemEnum.CYPTOMUS);
  }

  @Action(CommandEnum.PAY_WITH_TBANK)
  async payWithTBank(@Ctx() ctx: Context) {
    ctx.session.waitingForEmail = true;
    ctx.session.paymentInProgress = false;
    await replyOrEdit(
      ctx,
      'Отлично! Чтобы отправить вам чек, мне нужен ваш email! Пришлите его!',
      Markup.inlineKeyboard([]),
    );
  }

  @Hears(/[\w-]+@[\w-]+\.\w+/)
  async email(@Ctx() ctx: Context) {
    const email = ctx.message?.['text'];
    this.logger.debug(`user email ${email}`);

    // Check if we're waiting for email
    if (!ctx.session.waitingForEmail) {
      await ctx.reply('Платеж уже в процессе обработки. Пожалуйста, используйте ссылку выше для оплаты.');
      return;
    }

    ctx.session.waitingForEmail = false;
    return await this.createPaymentAndReply(ctx, PaymentSystemEnum.TBANK, email);
  }

  // Handle navigation commands (like "📊 статистика", "🆘 поддержка", etc.)
  @Hears(['📊 статистика', '🆘 поддержка', '🏠 главное меню', '🔄️ тариф', '🫣 токен', '⬅ назад'])
  async handleNavigationCommand(@Ctx() ctx: Context) {
    this.logger.debug('Navigation command received in payment scene, leaving scene');
    
    // Clear payment flags before navigation
    ctx.session.paymentInProgress = false;
    ctx.session.waitingForEmail = false;
    
    // Simply leave the scene - the main bot handler will process the command
    await ctx.scene.leave();
  }

  @Hears(/^(?!.*[\w-]+@[\w-]+\.\w+).*$/)
  async notAnEmail(@Ctx() ctx: Context) {
    // Check if we're waiting for email
    if (!ctx.session.waitingForEmail) {
      // If payment is already in progress, don't interrupt
      if (ctx.session.paymentInProgress) {
        await ctx.reply(
          'Платеж уже в процессе обработки. Пожалуйста, используйте ссылку выше для оплаты или выберите другое действие из меню.',
        );
        return;
      }
      // Otherwise, just ignore the message
      return;
    }

    await ctx.reply('Пожалуйста, введите корректный email адрес для получения чека.');
  }

  private async createPaymentAndReply(ctx: Context, paymentSystem: PaymentSystemEnum, email?: string) {
    this.logger.debug(`create payment with ${paymentSystem}`);
    try {
      const { paymentMonths, tariffId } = ctx.session;

      this.logger.debug(`paymentMonths ${paymentMonths}, tariffId ${tariffId}, email ${email}`);

      const payment = await this.paymentService.createPayment(
        ctx.from.id,
        ctx.chat.id,
        tariffId,
        paymentSystem,
        paymentMonths,
        email,
      );
      this.logger.debug(`payment ${JSON.stringify(payment)}`);
      // Set payment in progress flag
      ctx.session.paymentInProgress = true;

      let message = `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\n`;

      if (payment.discount && payment.discount > 0) {
        const user = await this.userService.findOneByUserId(ctx.from.id);
        const currentTariff = user.tariffId; // Already populated as Tariff object
        const newTariff = await this.tariffService.getOneById(tariffId);
        const daysRemaining = Math.floor(
          DateTime.fromJSDate(user.subscriptionEndDate).diff(DateTime.now(), 'days').days,
        );

        message += `💰 <b>Применена скидка за остаток текущей подписки!</b>\n`;
        message += `├ Переход с тарифа: ${currentTariff.name} → ${newTariff.name}\n`;
        message += `├ Осталось дней: ${daysRemaining}\n`;
        message += `├ Полная стоимость: ${payment.originalPrice} ₽\n`;
        message += `├ Скидка: -${payment.discount} ₽\n`;
        message += `└ <b>К оплате: ${payment.amount} ₽</b>\n\n`;
      } else {
        message += `💰 К оплате: ${payment.amount} ₽\n\n`;
      }

      message += `После того как вы оплатите, я автоматически вам поменяю тариф.\n\n⏱ Ссылка действительна 20 минут.`;

      const sentMessage = await ctx.sendMessage(message, {
        ...Markup.inlineKeyboard([
          [Markup.button.url(paymentSystem === 'WALLET' ? '👛 Pay via Wallet' : '👉 перейти к оплате', payment.url)],
        ]),
        parse_mode: 'HTML',
      });
      this.logger.debug(`sentMessage ${JSON.stringify(sentMessage)}`);

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

          // Reset payment flags for this user
          if (ctx.session) {
            ctx.session.paymentInProgress = false;
            ctx.session.waitingForEmail = false;
          }
        } catch (error) {
          this.logger.error(`Failed to edit expired payment message: ${error.message}`);
        }
      }, 1200000);
    } catch (error) {
      console.log(error);

      // Check if it's a downgrade attempt error
      if (error.message && error.message.startsWith('DOWNGRADE_NOT_ALLOWED:')) {
        const errorMessage = error.message.replace('DOWNGRADE_NOT_ALLOWED:', '');
        await ctx.reply(`⚠️ <b>Невозможно понизить тариф</b>\n\n${errorMessage}`, { parse_mode: 'HTML' });
        await ctx.scene.enter(CommandEnum.HOME);
      } else {
        await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.');
      }
    }
  }
}
