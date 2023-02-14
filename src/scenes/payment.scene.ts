import { Action, Ctx, Scene } from 'nestjs-telegraf';

import { AbstractScene } from '../abstract/abstract.scene';
import { CommandEnum } from '../enum/command.enum';
import { PaymentService } from '../payment/payment.service';
import { PaymentSystemEnum } from 'src/payment/enum/payment-system.enum';
import { Context } from 'src/interfaces/context.interface';
import { Markup } from 'telegraf';

@Scene(CommandEnum.PAYMENT)
export class PaymentScene extends AbstractScene {
  constructor(private readonly paymentService: PaymentService) {
    super();
  }

  @Action(CommandEnum.PAY_WITH_CRYPTOMUS)
  async payWithCriptomus(@Ctx() ctx: Context) {
    const { paymentMonths, tariffId } = ctx.session;

    const paymentSystem = PaymentSystemEnum.CYPTOMUS;
    const payment = await this.paymentService.createPayment(
      ctx.from.id,
      ctx.chat.id,
      tariffId,
      paymentSystem,
      paymentMonths,
    );
    await ctx.reply(
      `Чтобы оплатить подписку для выбранного вами тарифа, вам нужно перейти к оплате, нажав на кнопку ниже.\n\nПосле того как вы оплатите, я автоматически вам поменяю тариф.`,
      Markup.inlineKeyboard([[Markup.button.url('👉 перейти к оплате', payment.url)]]),
    );
  }
}
