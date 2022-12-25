import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { UserService } from '../user/user.service';

@Scene(CommandEnum.GET_REQUEST_STATS)
export class GetRequestStatsScene extends AbstractScene {
  constructor(private readonly userService: UserService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];
    const user = await this.userService.findOneByUserId(ctx.from.id);
    if (user) {
      await ctx.replyWithHTML(
        scene.success(
          user.requestUsed,
          user.tariffId.requestsLimit - user.requestUsed,
        ).text,
      );
    } else {
      await ctx.replyWithHTML(scene.error().text);
    }
  }
}
