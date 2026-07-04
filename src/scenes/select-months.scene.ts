import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Action, Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { Context } from 'src/interfaces/context.interface';
import { TariffService, offeredPeriods } from 'src/tariff/tariff.service';
import { SessionStateService } from 'src/session/session-state.service';
import { Markup } from 'telegraf';
import { splitArrayIntoPairs } from 'src/utils/split-array-into-pairs';

// billing sells only the exact (tariff, months) rows from the catalog — the
// period buttons are built from tariff.prices, not from a hardcoded list.
// Offering a period without a price row would show a price billing refuses to
// charge (price_not_available).
@Scene(CommandEnum.SELECT_MONTHS)
export class SelectMonthsScene extends AbstractScene {
  public logger = new Logger(SelectMonthsScene.name);

  constructor(
    private readonly tariffService: TariffService,
    private readonly sessionStateService: SessionStateService,
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    const tariff = flags?.tariffId ? await this.tariffService.getOneById(flags.tariffId) : null;
    if (!tariff) {
      this.logger.error(`Missing or unknown tariffId in Redis for ${ctx.from.id}`);
      await ctx.replyWithHTML('Не удалось определить выбранный тариф. Пожалуйста, выберите его ещё раз.');
      await ctx.scene.enter(CommandEnum.GET_ACCESS);
      return;
    }

    const periods = offeredPeriods(tariff);
    if (!periods.length) {
      this.logger.error(`Tariff ${tariff.id} (${tariff.code}) has no price rows — cannot be sold`);
      await ctx.replyWithHTML('Этот тариф сейчас недоступен для покупки. Пожалуйста, выберите другой.');
      await ctx.scene.enter(CommandEnum.GET_ACCESS);
      return;
    }

    const buttons = splitArrayIntoPairs(
      periods.map((period) =>
        Markup.button.callback(`${period.months} мес — ${period.priceRub} ₽`, `months_${period.months}`),
      ),
    );

    await ctx.replyWithHTML(
      `Тариф: <b>${tariff.display_name}</b>\n\nВыберите срок подписки 🔢`,
      Markup.inlineKeyboard(buttons),
    );
  }

  @Action(/^months_(\d+)$/)
  async onPeriodPick(@Ctx() ctx: Context) {
    const months = parseInt(ctx.match[1], 10);
    const flags = await this.sessionStateService.getPaymentFlags(ctx.from.id);
    const tariff = flags?.tariffId ? await this.tariffService.getOneById(flags.tariffId) : null;
    const period = tariff ? offeredPeriods(tariff).find((p) => p.months === months) : null;

    if (!period) {
      await ctx.answerCbQuery('Этот период больше недоступен');
      await ctx.scene.reenter();
      return;
    }

    await ctx.answerCbQuery();
    await this.sessionStateService.setPaymentMonths(ctx.from.id, months);
    await ctx.scene.enter(CommandEnum.PAYMENT);
  }
}
