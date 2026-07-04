import { Logger } from '@nestjs/common';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { SCENES } from '../constants/scenes.const';
import { Context } from '../interfaces/context.interface';
import { AccountClient } from '../account/account.client';

@Scene(CommandEnum.START)
export class StartScene extends AbstractScene {
  public logger = new Logger(StartScene.name);

  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const account = await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
    ctx.session.accountId = account.id;

    const scene = SCENES[CommandEnum.START];
    await ctx.replyWithHTML(scene.text(account.api_key), Markup.inlineKeyboard(scene.buttons));
  }
}
