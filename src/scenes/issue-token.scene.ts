import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { AccountClient } from '../account/account.client';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';

@Scene(CommandEnum.ISSUE_TOKEN)
export class IssueTokenScene extends AbstractScene {
  constructor(private readonly accountClient: AccountClient) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const scene = SCENES[CommandEnum.ISSUE_TOKEN];
    try {
      // Idempotent: a new account gets the default (free) tariff and a token;
      // an existing one just returns its token.
      const account = await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
      ctx.session.accountId = account.id;

      await ctx.replyWithHTML(scene.text(account.api_key), Markup.keyboard(scene.navigateButtons).resize());
    } catch (e) {
      this.logger.error('IssueTokenScene.onSceneEnter', e);
      await ctx.replyWithHTML(
        'Произошла ошибка при получении токена. Попробуйте позже.',
        Markup.keyboard(scene.navigateButtons).resize(),
      );
    }
  }
}
