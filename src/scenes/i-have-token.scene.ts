import { Ctx, Next, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Context } from '../interfaces/context.interface';
import { SCENES } from '../constants/scenes.const';
import { leaveSceneIfNavigation } from '../utils/scene-navigation.util';
import { AccountApiError, AccountClient } from '../account/account.client';

@Scene(CommandEnum.I_HAVE_TOKEN)
export class IHaveTokenScene extends AbstractScene {
  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    this.logger.log(CommandEnum.I_HAVE_TOKEN);
    const existing = await this.accountClient.getByTelegramId(ctx.from.id);
    if (existing) {
      await ctx.scene.enter(CommandEnum.HOME);
      return;
    }
    const scene = SCENES[CommandEnum.I_HAVE_TOKEN];
    await ctx.replyWithHTML(scene.text);
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context, @Next() next: () => Promise<void>) {
    if (!('text' in ctx.message)) return;
    if (await leaveSceneIfNavigation(ctx, next)) return;

    const token = ctx.message.text.trim();
    const scene = SCENES[CommandEnum.I_HAVE_TOKEN];
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
