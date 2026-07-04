import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { AccountClient } from '../account/account.client';
import { Logger } from '@nestjs/common';

@Scene(CommandEnum.CHANGE_TOKEN)
export class ChangeTokenScene extends AbstractScene {
  public logger = new Logger(ChangeTokenScene.name);

  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const scene = SCENES[ctx.scene.session.current];

    const accountId = ctx.session?.accountId;
    if (!accountId) {
      this.logger.warn(`No accountId in session for user ${ctx.from.id}`);
      await ctx.replyWithHTML(scene.error().text);
      return;
    }

    // account carries the remaining daily limit over to the new key itself —
    // rotation is a single call, nothing to clean up on our side.
    let newApiKey: string;
    try {
      const result = await this.accountClient.rotateToken(accountId);
      newApiKey = result.api_key;
    } catch (error) {
      this.logger.error(`Failed to rotate token for account ${accountId}:`, error);
      await ctx.replyWithHTML(scene.error().text);
      return;
    }

    await ctx.replyWithHTML(scene.success(newApiKey).text);
  }
}
