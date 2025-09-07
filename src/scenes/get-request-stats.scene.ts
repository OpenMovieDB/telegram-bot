import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { UserService } from '../user/user.service';
import { CacheResetService } from '../cache/cache-reset.service';

@Scene(CommandEnum.GET_REQUEST_STATS)
export class GetRequestStatsScene extends AbstractScene {
  constructor(
    private readonly userService: UserService,
    private readonly cacheResetService: CacheResetService,
  ) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];
    
    const cacheStats = await this.cacheResetService.getUserStats(ctx.from.id);
    
    if (cacheStats) {
      this.logger.log(`Cache stats for user ${ctx.from.id}: used=${cacheStats.requestsUsed}, left=${cacheStats.requestsLeft}`);
      await ctx.replyWithHTML(scene.success(cacheStats.requestsUsed, cacheStats.requestsLeft).text);
    } else {
      this.logger.log(`Cache miss for user ${ctx.from.id}, falling back to MongoDB`);
      const user = await this.userService.findOneByUserId(ctx.from.id);
      if (user) {
        this.logger.log(`MongoDB stats for user ${ctx.from.id}: used=${user.requestsUsed}`);
        await ctx.replyWithHTML(scene.success(user.requestsUsed, user.tariffId.requestsLimit - user.requestsUsed).text);
      } else {
        await ctx.replyWithHTML(scene.error().text);
      }
    }
  }
}
