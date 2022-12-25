import { Ctx, SceneEnter } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { Logger } from '@nestjs/common';
import { SCENES } from '../constants/scenes.const';
import { replyOrEdit } from '../utils/reply-or-edit.util';
import { Markup } from 'telegraf';

export class AbstractScene {
  public logger = new Logger(AbstractScene.name);
  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];
    if (scene.buttons) {
      await replyOrEdit(
        ctx,
        scene.text || null,
        Markup.inlineKeyboard(scene.buttons),
      );
    } else if (scene.navigateButtons) {
      await ctx.reply(scene.text, Markup.keyboard(scene.navigateButtons));
    } else {
      await ctx.reply(scene.text);
    }
  }
}
