import { Action, Ctx } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { AbstractScene } from './abstract.scene';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { TariffService, isFreeTariff } from '../tariff/tariff.service';
import { SessionStateService } from '../session/session-state.service';

// Shared handler for catalog-driven tariff buttons (`tariff_<id>`). The screen
// is universal: ANY free tariff goes through the token-issue flow, ANY paid one
// through period selection — there is no per-tariff scene binding.
export abstract class TariffPickScene extends AbstractScene {
  constructor(
    protected readonly tariffService: TariffService,
    protected readonly sessionStateService: SessionStateService,
  ) {
    super();
  }

  @Action(/^tariff_(.+)$/)
  async onTariffPick(@Ctx() ctx: Context) {
    const tariff = await this.tariffService.getOneById(ctx.match[1]);
    if (!tariff || tariff.is_hidden) {
      await ctx.answerCbQuery('Этот тариф больше недоступен');
      await ctx.scene.reenter();
      return;
    }

    await ctx.answerCbQuery();
    if (isFreeTariff(tariff)) {
      await ctx.scene.enter(CommandEnum.ISSUE_TOKEN);
      return;
    }

    await this.sessionStateService.setTariffId(ctx.from.id, tariff.id);
    const state: TariffsReturn = { tariffsScene: this.sceneId };
    await ctx.scene.enter(CommandEnum.SELECT_MONTHS, state);
  }
}

// The scene that listed the tariffs, carried through the period and payment
// screens so the user can go back and pick another tariff, the free one too.
export interface TariffsReturn {
  tariffsScene?: string;
}

// «⬅ назад» to that list. The callback data is the scene id, which the global
// action in bot.update.ts enters, so the press works after a pod restart too.
export function backToTariffs(ctx: Context) {
  const { tariffsScene } = ctx.scene.state as TariffsReturn;
  return tariffsScene ? [[Markup.button.callback('⬅ назад', tariffsScene)]] : [];
}
