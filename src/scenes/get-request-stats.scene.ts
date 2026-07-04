import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { AccountClient } from '../account/account.client';

@Scene(CommandEnum.GET_REQUEST_STATS)
export class GetRequestStatsScene extends AbstractScene {
  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];

    const accountId = ctx.session?.accountId;
    if (!accountId) {
      this.logger.warn(`No accountId in session for user ${ctx.from.id}`);
      await ctx.replyWithHTML(scene.error().text);
      return;
    }

    try {
      const usage = await this.accountClient.getUsage(accountId);
      const left = Math.max(0, usage.limit - usage.used);
      this.logger.log(`Usage for user ${ctx.from.id}: used=${usage.used}, left=${left}, limit=${usage.limit}`);
      await ctx.replyWithHTML(scene.success(usage.used, left).text);
    } catch (error) {
      this.logger.error(`Failed to get usage for user ${ctx.from.id}:`, error);
      await ctx.replyWithHTML(scene.error().text);
    }
  }
}
