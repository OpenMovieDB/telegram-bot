import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { UserService } from '../user/user.service';
import { CacheResetService } from '../cache/cache-reset.service';
import * as ApiKey from 'uuid-apikey';

@Scene(CommandEnum.CHANGE_TOKEN)
export class ChangeTokenScene extends AbstractScene {
  constructor(private readonly userService: UserService, private readonly cacheResetService: CacheResetService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const scene = SCENES[ctx.scene.session.current];

    try {
      const user = await this.userService.findOneByUserId(ctx.from.id);
      if (!user) {
        await ctx.replyWithHTML(scene.error().text);
        return;
      }

      const oldToken = user.token;
      const newToken = await this.userService.changeToken(ctx.from.id);

      if (oldToken && newToken) {
        await this.cacheResetService.transferTokenLimits(oldToken, newToken);
      }

      if (newToken) {
        // Convert UUID to API key format for display to user
        // @ts-ignore
        const apiKey = ApiKey.toAPIKey(newToken);
        await ctx.replyWithHTML(scene.success(apiKey).text);
      } else {
        await ctx.replyWithHTML(scene.error().text);
      }
    } catch (error) {
      this.logger.error(`Failed to change token for user ${ctx.from.id}:`, error);
      await ctx.replyWithHTML(scene.error().text);
    }
  }
}
