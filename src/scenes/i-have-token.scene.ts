import { Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Context } from '../interfaces/context.interface';
import { SCENES } from '../constants/scenes.const';
import { AccountApiError, AccountClient } from '../account/account.client';

@Scene(CommandEnum.I_HAVE_TOKEN)
export class IHaveTokenScene extends AbstractScene {
  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(ctx.scene.session.current);
    const existing = await this.accountClient.getByTelegramId(ctx.from.id);
    if (existing) {
      await ctx.scene.enter(CommandEnum.HOME);
      return;
    }
    const scene = SCENES[ctx.scene.session.current];
    await ctx.replyWithHTML(scene.text);
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    if (!('text' in ctx.message)) return;

    const token = ctx.message.text.trim();
    const scene = SCENES[ctx.scene.session.current];
    const action = scene.actions[CommandEnum.BIND_TOKEN];

    try {
      const account = await this.accountClient.linkTelegram(token, ctx.from.id, ctx.from.username);
      ctx.session.accountId = account.id;
      await ctx.replyWithHTML(action.success.text);
      await ctx.scene.enter(CommandEnum.HOME);
    } catch (error) {
      if (error instanceof AccountApiError && ['token_not_found', 'telegram_already_linked'].includes(error.code)) {
        await ctx.replyWithHTML(action.error.text);
        await ctx.scene.enter(CommandEnum.START);
        return;
      }
      throw error;
    }
  }
}
