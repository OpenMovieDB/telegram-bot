import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { Context } from 'src/interfaces/context.interface';
import { TariffService } from 'src/tariff/tariff.service';
import { SessionStateService } from 'src/session/session-state.service';
import { safeReplyOrEdit } from 'src/utils/safe-reply.util';
import { Markup } from 'telegraf';

@Scene(CommandEnum.SELECT_MONTHS)
export class SelectMonthsScene extends AbstractScene {
  public logger = new Logger(AbstractScene.name);
  private maxMonths = 60;

  constructor(
    private readonly tariffService: TariffService,
    private readonly sessionStateService: SessionStateService,
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    await this.sessionStateService.setPaymentMonths(ctx.from.id, 1);

    await this.sendMessage(ctx);
  }

  @Action('plus')
  async plus(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    const currentMonths = flags?.paymentMonths || 1;

    if (currentMonths <= this.maxMonths) {
      await this.sessionStateService.setPaymentMonths(ctx.from.id, currentMonths + 1);
      await this.sendMessage(ctx);
    }
  }

  @Action('tree')
  async tree(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    await this.sessionStateService.setPaymentMonths(ctx.from.id, 3);
    await this.sendMessage(ctx);
  }

  @Action('six')
  async six(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    await this.sessionStateService.setPaymentMonths(ctx.from.id, 6);
    await this.sendMessage(ctx);
  }

  @Action('twelve')
  async twelve(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    await this.sessionStateService.setPaymentMonths(ctx.from.id, 12);
    await this.sendMessage(ctx);
  }

  @Action('minus')
  async minus(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    const currentMonths = flags?.paymentMonths || 1;

    if (currentMonths > 1) {
      await this.sessionStateService.setPaymentMonths(ctx.from.id, currentMonths - 1);
      await this.sendMessage(ctx);
    }
  }

  @Action('ok')
  async ok(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    const paymentMonths = flags?.paymentMonths || 0;

    if (paymentMonths >= 1) {
      await ctx.scene.enter(CommandEnum.PAYMENT);
    } else {
      this.logger.warn('paymentMonths >= 1', paymentMonths >= 1);
    }
  }

  private async sendMessage(ctx) {
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    const { paymentMonths, tariffId } = flags || {};

    if (!tariffId || !paymentMonths) {
      this.logger.error('Missing tariffId or paymentMonths in Redis');
      return;
    }

    const { price } = await this.tariffService.getOneById(tariffId);
    return safeReplyOrEdit(
      ctx,
      `Установите время действия подписки 🔢\n\nПодписка на: <b>${paymentMonths} мес</b>. \n\nФинальная стоимость: <b>${
        price * paymentMonths
      } руб.</b>`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('-', 'minus'),
          Markup.button.callback('3', 'tree'),
          Markup.button.callback('6', 'six'),
          Markup.button.callback('12', 'twelve'),
          Markup.button.callback('+', 'plus'),
        ],
        [Markup.button.callback('✅ подтвердить', 'ok')],
      ]),
    );
  }
}
