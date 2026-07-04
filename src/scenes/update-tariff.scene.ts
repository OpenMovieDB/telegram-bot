import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { TariffPickScene } from '../abstract/tariff-pick.scene';
import { Logger } from '@nestjs/common';
import { SCENES } from 'src/constants/scenes.const';
import { Markup } from 'telegraf';
import { Context } from 'src/interfaces/context.interface';
import { TariffService, isFreeTariff } from 'src/tariff/tariff.service';
import { SessionStateService } from 'src/session/session-state.service';
import { AccountClient } from 'src/account/account.client';
import { accountTariffName } from 'src/utils/tariff-display.util';

@Scene(CommandEnum.UPDATE_TARIFF)
export class UpdateTariffScene extends TariffPickScene {
  public logger = new Logger(UpdateTariffScene.name);

  constructor(
    tariffService: TariffService,
    sessionStateService: SessionStateService,
    private readonly accountClient: AccountClient,
  ) {
    super(tariffService, sessionStateService);
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const account = await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
    ctx.session.accountId = account.id;

    // Paid tariffs only, in the admin's catalog order (sort_order).
    const tariffs = (await this.tariffService.getAllTariffs()).filter((tariff) => !isFreeTariff(tariff));
    const scene = SCENES[ctx.scene.session.current];

    const subscriptionEnd = account.subscription_end ? new Date(account.subscription_end) : undefined;
    await ctx.replyWithHTML(
      scene.text(tariffs, accountTariffName(account.tariff), subscriptionEnd),
      Markup.inlineKeyboard(scene.buttons(tariffs)),
    );
  }
}
