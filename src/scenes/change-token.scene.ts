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

    let user;
    try {
      user = await this.userService.findOneByUserId(ctx.from.id);
    } catch (error) {
      this.logger.error(`Failed to load user ${ctx.from.id} for token change:`, error);
      await ctx.replyWithHTML(scene.error().text);
      return;
    }

    if (!user) {
      await ctx.replyWithHTML(scene.error().text);
      return;
    }

    const oldToken = user.token;

    let newToken: string | null = null;
    let apiKey: string | null = null;
    try {
      newToken = await this.userService.changeToken(ctx.from.id);
      if (newToken) {
        // @ts-ignore
        apiKey = ApiKey.toAPIKey(newToken);
      }
    } catch (error) {
      this.logger.error(`Failed to change token for user ${ctx.from.id}:`, error);
    }

    if (!newToken || !apiKey) {
      await ctx.replyWithHTML(scene.error().text);
      return;
    }

    // Show the new token to the user BEFORE any cache side effects, so even
    // if cache invalidation fails the user never ends up with a token they
    // cannot see.
    try {
      await ctx.replyWithHTML(scene.success(apiKey).text);
    } catch (error) {
      this.logger.error(`Failed to send new token to user ${ctx.from.id}:`, error);
    }

    try {
      await this.cacheResetService.transferTokenLimits(oldToken, newToken);
    } catch (error) {
      this.logger.error(`Failed to invalidate caches after token change for user ${ctx.from.id}:`, error);
    }
  }
}
