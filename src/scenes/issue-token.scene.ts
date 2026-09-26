import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { AccountClient } from '../account/account.client';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';
import { MembershipService } from '../membership/membership.service';

@Scene(CommandEnum.ISSUE_TOKEN)
export class IssueTokenScene extends AbstractScene {
  constructor(private readonly accountClient: AccountClient, private readonly membershipService: MembershipService) {
    super();
  }

  @SceneEnter()
  async onSceneEnter(@Ctx() ctx: Context) {
    const scene = SCENES[CommandEnum.ISSUE_TOKEN];
    try {
      const account = await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
      ctx.session.accountId = account.id;

      // A new account holds the free key only after the chat and the channel.
      if (account.key_state && account.key_state !== 'active') {
        await this.membershipService.startSteps(ctx, account.id);
        return;
      }

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
