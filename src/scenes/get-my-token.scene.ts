import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { AccountClient } from '../account/account.client';
import { Logger } from '@nestjs/common';

@Scene(CommandEnum.GET_MY_TOKEN)
export class GetMyTokenScene extends AbstractScene {
  public logger = new Logger(GetMyTokenScene.name);

  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async enterScene(ctx) {
    const scene = SCENES[ctx.scene.session.current];

    let token: string | null = null;

    const accountId = ctx.session?.accountId;
    if (accountId) {
      try {
        const account = await this.accountClient.getById(accountId);
        token = account.api_key;
      } catch (error) {
        this.logger.error(`Failed to get account ${accountId} for user ${ctx.from.id}:`, error);
      }
    } else {
      try {
        const account = await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
        ctx.session.accountId = account.id;
        token = account.api_key;
      } catch (error) {
        this.logger.error(`Failed to upsert account for user ${ctx.from.id}:`, error);
      }
    }

    if (token) {
      await ctx.replyWithHTML(scene.success(token).text, Markup.inlineKeyboard(scene.success(token).buttons));
    } else {
      await ctx.replyWithHTML(scene.error().text, Markup.inlineKeyboard(scene.error().buttons));
    }
  }
}
