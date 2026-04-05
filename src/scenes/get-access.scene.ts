import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Logger } from '@nestjs/common';
import { SCENES } from 'src/constants/scenes.const';
import { Markup } from 'telegraf';
import { Context } from 'src/interfaces/context.interface';
import { TariffService } from 'src/tariff/tariff.service';
import { SessionStateService } from 'src/session/session-state.service';

@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene extends AbstractScene {
  public logger = new Logger(AbstractScene.name);

  constructor(
    private readonly tariffService: TariffService,
    private readonly sessionStateService: SessionStateService,
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const tariffs = await this.tariffService.getAllTariffs();
    const scene = SCENES[ctx.scene.session.current];

    await this.sessionStateService.clearMessageId(ctx.from.id);

    await ctx.replyWithHTML(scene.navigateText, Markup.keyboard(scene.navigateButtons).resize());
    await ctx.replyWithHTML(scene.text(tariffs), Markup.inlineKeyboard(scene.buttons(tariffs)));
  }
}
