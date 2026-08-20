import { Ctx, SCENE_METADATA, SceneEnter } from 'nestjs-telegraf';
import { Context } from '../interfaces/context.interface';
import { Logger } from '@nestjs/common';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';

export class AbstractScene {
  public logger = new Logger(AbstractScene.name);

  // Concurrent updates share one Telegraf session, so ctx.scene.session.current
  // may already point at ANOTHER scene by the time this handler runs (double
  // tap + slow upstream) — the @Scene() decorator is the only race-free source
  // of this scene's id.
  protected get sceneId(): string {
    return Reflect.getMetadata(SCENE_METADATA, this.constructor)?.sceneId;
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(this.sceneId);
    const scene = SCENES[this.sceneId];

    if (scene.navigateButtons && scene.navigateText) {
      await ctx.replyWithHTML(scene.navigateText, Markup.keyboard(scene.navigateButtons).resize());
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
