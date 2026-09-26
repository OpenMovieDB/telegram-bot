import { CommandEnum } from '../enum/command.enum';
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../constants/scenes.const';
import { Markup } from 'telegraf';
import { AccountClient } from '../account/account.client';
import { AccountResponseDto } from '../account/dto/account-response.dto';
import { Logger } from '@nestjs/common';
import { MembershipService } from '../membership/membership.service';
import { accountTariffName } from '../utils/tariff-display.util';

@Scene(CommandEnum.GET_MY_TOKEN)
export class GetMyTokenScene extends AbstractScene {
  public logger = new Logger(GetMyTokenScene.name);

  constructor(private readonly accountClient: AccountClient, private readonly membershipService: MembershipService) {
    super();
  }

  @SceneEnter()
  async enterScene(ctx) {
    const scene = SCENES[CommandEnum.GET_MY_TOKEN];

    let account: AccountResponseDto | null = null;
    try {
      account = ctx.session?.accountId
        ? await this.accountClient.getById(ctx.session.accountId)
        : await this.accountClient.upsertByTelegramId(ctx.from.id, ctx.from.username);
      ctx.session.accountId = account.id;
    } catch (error) {
      this.logger.error(`Failed to get account for user ${ctx.from.id}:`, error);
    }

    // A stopped key is not shown: the owner left the chat or the channel. The
    // check may find them back, and then the same key is shown.
    if (account?.key_state === 'stopped') {
      const check = await this.accountClient.checkMembership(account.id);
      if (check.key_state !== 'active') {
        const screen = this.membershipService.stoppedScreen(accountTariffName(account.tariff), check);
        await ctx.replyWithHTML(screen.text, screen.keyboard);
        return;
      }
      account = await this.accountClient.getById(account.id);
    }

    const token = account?.api_key;
    if (token) {
      await ctx.replyWithHTML(scene.success(token).text, Markup.inlineKeyboard(scene.success(token).buttons));
    } else {
      await ctx.replyWithHTML(scene.error().text, Markup.inlineKeyboard(scene.error().buttons));
    }
  }
}
