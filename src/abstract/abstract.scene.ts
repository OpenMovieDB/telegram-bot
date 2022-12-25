import { Ctx, SceneEnter } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { Logger } from '@nestjs/common';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';

export class AbstractScene {
  public logger = new Logger(AbstractScene.name);
  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const scene = SCENES[ctx.scene.session.current];

    if (scene.navigateButtons && scene.navigateText) {
      await ctx.replyWithHTML(
        scene.navigateText,
        Markup.keyboard(scene.navigateButtons).resize(),
      );
    }
    if (!scene.navigateButtons && !scene.buttons) {
      if (scene.text) {
        await ctx.replyWithHTML(scene.text);
      } else {
        await ctx.replyWithHTML(scene.navigateText);
      }
    }
    if (scene.buttons && scene.text) {
      await ctx.replyWithHTML(scene.text, Markup.inlineKeyboard(scene.buttons));
    }
  }
}
