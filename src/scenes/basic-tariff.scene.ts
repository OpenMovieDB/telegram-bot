import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { Context } from 'src/interfaces/context.interface';
import { TariffService } from 'src/tariff/tariff.service';
import { SessionStateService } from 'src/session/session-state.service';

@Scene(CommandEnum.BASIC_TARIFF)
export class BasicTariffScene extends AbstractScene {
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
    const tariff = await this.tariffService.getOneByName(ctx.scene.session.current.split('_')[0]);
    await this.sessionStateService.setTariffId(ctx.from.id, tariff._id.toString());
    ctx.scene.enter(CommandEnum.SELECT_MONTHS);
  }
}
