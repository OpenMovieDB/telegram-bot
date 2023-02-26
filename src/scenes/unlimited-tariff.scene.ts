import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Logger } from '@nestjs/common';
import { TariffService } from 'src/tariff/tariff.service';
import { Context } from 'src/interfaces/context.interface';

@Scene(CommandEnum.UNLIMITED_TARIFF)
export class UnlimitedTariffScene extends AbstractScene {
  public logger = new Logger(AbstractScene.name);

  constructor(private readonly tariffService: TariffService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const tariff = await this.tariffService.getOneByName(ctx.scene.session.current.split('_')[0]);
    ctx.session.tariffId = tariff._id.toString();
    ctx.scene.enter(CommandEnum.SELECT_MONTHS);
  }
}
