import { Logger } from '@nestjs/common';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { CommandEnum } from '../enum/command.enum';
import { TariffPickScene } from '../abstract/tariff-pick.scene';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { AccountClient } from '../account/account.client';
import { TariffService } from '../tariff/tariff.service';
import { SessionStateService } from '../session/session-state.service';
import { SafeTelegramHelper } from '../helpers/safe-telegram.helper';

// The screen of a user without a key: the tariffs, the free one included. The
// key comes after the free tariff's steps or after a payment.
@Scene(CommandEnum.START)
export class StartScene extends TariffPickScene {
  public logger = new Logger(StartScene.name);

  constructor(
    tariffService: TariffService,
    sessionStateService: SessionStateService,
    private readonly accountClient: AccountClient,
  ) {
    super(tariffService, sessionStateService);
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const account = await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
    ctx.session.accountId = account.id;

    const tariffs = await this.tariffService.getAllTariffs();
    const scene = SCENES[CommandEnum.START];
    const text = scene.text(tariffs);
    const keyboard = Markup.inlineKeyboard(scene.buttons(tariffs));

    // «⬅ назад» from a step brings the tariffs back into the same message.
    if (ctx.callbackQuery) {
      await SafeTelegramHelper.safeSend(
        () => ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard }),
        `Start screen to ${ctx.from.id}`,
      );
      return;
    }
    await ctx.replyWithHTML(text, keyboard);
  }
}
