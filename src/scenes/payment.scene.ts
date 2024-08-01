import { Action, Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf';

import { AbstractScene } from '../abstract/abstract.scene';
import { CommandEnum } from '../enum/command.enum';
import { PaymentService } from '../payment/payment.service';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { Context } from 'src/interfaces/context.interface';
import { Markup } from 'telegraf';
import { replyOrEdit } from 'src/utils/reply-or-edit.util';
import { SCENES } from 'src/constants/scenes.const';

@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
  constructor(private readonly paymentService: PaymentService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];

    await replyOrEdit(ctx, scene.text, Markup.inlineKeyboard(scene.buttons));
  }

  @Action(CommandEnum.PAY_WITH_CRYPTOMUS)
  async payWithCriptomus(@Ctx() ctx: Context) {
    await this.createPaymentAndReply(ctx, PaymentSystemEnum.CYPTOMUS);
  }

  @Action(CommandEnum.PAY_WITH_TBANK)
  async payWithTBank(@Ctx() ctx: Context) {
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
    return await this.createPaymentAndReply(ctx, PaymentSystemEnum.TBANK, email);
  }

  @Hears(/^(?!.*[\w-]+@[\w-]+\.\w+).*$/)
  async notAnEmail(@Ctx() ctx: Context) {
    await ctx.reply(
      'Кажется, возникли проблемы с выставлением счета. Пожалуйста, напишите администратору, или попробуйте снова.',
      Markup.inlineKeyboard([[Markup.button.url('🚨Связаться с администратором', 'https://t.me/mdwit')]]),
    );
    return ctx.scene.leave();
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
      const sentMessage = await ctx.sendMessage(
        `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
        Markup.inlineKeyboard([
          [Markup.button.url(paymentSystem === 'WALLET' ? '👛 Pay via Wallet' : '👉 перейти к оплате', payment.url)],
        ]),
      );
      this.logger.debug(`sentMessage ${JSON.stringify(sentMessage)}`);

      // Удаление кнопки через 10 минут
      setTimeout(async () => {
        const chatId = ctx.chat.id;
        const messageId = sentMessage.message_id;

        await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          `Ссылка на оплату истекла. Пожалуйста, попробуйте снова, если вы хотите оплатить подписку.`,
          { parse_mode: 'HTML' },
        );
      }, 600000);
    } catch (error) {
      console.log(error);
      await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте снова.');
    }
  }
}
