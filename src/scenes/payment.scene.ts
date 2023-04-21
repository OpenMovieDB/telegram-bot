import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';

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

  @Action(CommandEnum.PAY_WITH_YOOMONEY)
  async payWithYooMoney(@Ctx() ctx: Context) {
    await this.createPaymentAndReply(ctx, PaymentSystemEnum.YOOMONEY);
  }

  private async createPaymentAndReply(ctx: Context, paymentSystem: PaymentSystemEnum) {
    const { paymentMonths, tariffId } = ctx.session;

    const payment = await this.paymentService.createPayment(
      ctx.from.id,
      ctx.chat.id,
      tariffId,
      paymentSystem,
      paymentMonths,
    );
    const sentMessage = await replyOrEdit(
      ctx,
      `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
      Markup.inlineKeyboard([[Markup.button.url('👉 перейти к оплате', payment.url)]]),
    );

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
  }
}
