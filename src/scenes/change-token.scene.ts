import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { UserService } from '../user/user.service';
import { CacheResetService } from '../cache/cache-reset.service';

@Scene(CommandEnum.CHANGE_TOKEN)
export class ChangeTokenScene extends AbstractScene {
  constructor(
    private readonly userService: UserService,
    private readonly cacheResetService: CacheResetService,
  ) {
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

      // Получаем старый токен для переноса лимитов
      const oldToken = user.token;
      let transferredRequests = 0;

      // Создаем новый токен
      const newToken = await this.userService.changeToken(ctx.from.id);
      
      if (oldToken && newToken) {
        // Переносим лимиты со старого токена на новый
        transferredRequests = await this.cacheResetService.transferTokenLimits(oldToken, newToken);
        
        // Очищаем кэш пользователя
        await this.cacheResetService.resetUserCacheByUserId(ctx.from.id);
        
        this.logger.log(`Token changed for user ${ctx.from.id}, transferred ${transferredRequests} requests`);
      }

      if (newToken) {
        await ctx.replyWithHTML(scene.success(newToken, transferredRequests).text);
      } else {
        await ctx.replyWithHTML(scene.error().text);
      }

    } catch (error) {
      this.logger.error(`Failed to change token for user ${ctx.from.id}:`, error);
      await ctx.replyWithHTML(scene.error().text);
    }
  }
}