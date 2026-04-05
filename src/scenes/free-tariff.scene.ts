import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Context } from 'src/interfaces/context.interface';

@Scene(CommandEnum.FREE_TARIFF)
export class FreeTariffScene extends AbstractScene {
  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    await ctx.scene.enter(CommandEnum.DEMO_TARIFF);
  }
}
