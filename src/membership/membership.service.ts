import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { ChatMemberUpdated } from 'typegram/manage';
import { BOT_NAME } from '../constants/bot-name.const';
import { BUTTONS, MEMBERSHIP_BUTTONS } from '../constants/buttons.const';
import { MEMBERSHIP } from '../constants/scenes.const';
import { CommandEnum } from '../enum/command.enum';
import { Context } from '../interfaces/context.interface';
import { AccountClient } from '../account/account.client';
import { MembershipCheckWire } from '../account/dto/account-response.dto';
import { SafeTelegramHelper } from '../helpers/safe-telegram.helper';
import { accountTariffName } from '../utils/tariff-display.util';

export interface MembershipScreen {
  text: string;
  keyboard: ReturnType<typeof Markup.inlineKeyboard>;
}

// The free key is held by the community chat and the developer channel. account
// decides (key_state and the membership check); this service only renders the
// answer: the steps in the message the user is looking at, and a notice when
// the key stops or works again.
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectBot(BOT_NAME) private readonly bot: Telegraf<Context>,
    private readonly accountClient: AccountClient,
  ) {}

  // The free tariff was picked: the first unmet step, or the key right away when
  // the user is already in the chat and on the channel.
  async startSteps(ctx: Context, accountId: string): Promise<void> {
    const check = await this.accountClient.checkMembership(accountId);
    await this.show(ctx, await this.stepScreen(accountId, check));
  }

  // «проверить» under a step. The check covers both conditions, so a user who
  // left the chat between the steps is sent back to step 1.
  async onStepCheck(ctx: Context): Promise<void> {
    const account = await this.accountClient.getByTelegramId(ctx.from.id);
    if (!account) {
      await ctx.answerCbQuery();
      await ctx.scene.enter(CommandEnum.START);
      return;
    }
    ctx.session.accountId = account.id;

    const check = await this.accountClient.checkMembership(account.id);
    if (check.key_state === 'active') {
      await ctx.answerCbQuery();
    } else {
      await ctx.answerCbQuery(unmetAlert(check), { show_alert: true });
    }
    await this.show(ctx, await this.stepScreen(account.id, check));
  }

  // «проверить» under the stopped notice.
  async onResumeCheck(ctx: Context): Promise<void> {
    const account = await this.accountClient.getByTelegramId(ctx.from.id);
    if (!account) {
      await ctx.answerCbQuery();
      await ctx.scene.enter(CommandEnum.START);
      return;
    }
    ctx.session.accountId = account.id;

    const check = await this.accountClient.checkMembership(account.id);
    if (check.key_state === 'active') {
      await ctx.answerCbQuery();
      await this.show(ctx, { text: MEMBERSHIP.resumed, keyboard: Markup.inlineKeyboard([]) });
      return;
    }
    await ctx.answerCbQuery(unmetAlert(check), { show_alert: true });
    await this.show(ctx, this.stoppedScreen(accountTariffName(account.tariff), check));
  }

  // A member joined or left the chat or the channel. Only the two transitions
  // the user must know about produce a message: the key stopped, the key works
  // again. account locks the row, so a concurrent «проверить» and this event
  // report the transition once.
  async onChatMember(update: ChatMemberUpdated): Promise<void> {
    const user = update.new_chat_member.user;
    if (user.is_bot) return;

    const account = await this.accountClient.getByTelegramId(user.id);
    if (!account) return;

    const check = await this.accountClient.checkMembership(account.id);
    if (check.key_state_before === 'active' && check.key_state === 'stopped') {
      await this.send(user.id, this.stoppedScreen(accountTariffName(account.tariff), check));
    } else if (check.key_state_before === 'stopped' && check.key_state === 'active') {
      await this.send(user.id, { text: MEMBERSHIP.resumed, keyboard: Markup.inlineKeyboard([]) });
    }
  }

  stoppedScreen(tariffName: string, check: MembershipCheckWire): MembershipScreen {
    const join = [];
    if (!check.in_chat) join.push([BUTTONS[CommandEnum.JOIN_CHAT]]);
    if (!check.in_channel) join.push([MEMBERSHIP_BUTTONS.JOIN_CHANNEL]);
    return {
      text: MEMBERSHIP.stopped(tariffName, check.in_chat, check.in_channel),
      keyboard: Markup.inlineKeyboard([...join, [MEMBERSHIP_BUTTONS.RESUME], [BUTTONS[CommandEnum.UPDATE_TARIFF]]]),
    };
  }

  private async stepScreen(accountId: string, check: MembershipCheckWire): Promise<MembershipScreen> {
    if (check.key_state === 'active') {
      const account = await this.accountClient.getById(accountId);
      const condition = check.membership_required
        ? { tariffName: accountTariffName(account.tariff), requestsLimit: account.tariff.requests_limit }
        : undefined;
      return {
        text: MEMBERSHIP.token(account.api_key, condition),
        keyboard: Markup.inlineKeyboard([[BUTTONS[CommandEnum.DOCUMENTATION]], [BUTTONS[CommandEnum.HOME]]]),
      };
    }
    if (!check.in_chat) {
      return {
        text: MEMBERSHIP.chatStep,
        keyboard: Markup.inlineKeyboard([
          [BUTTONS[CommandEnum.JOIN_CHAT]],
          [MEMBERSHIP_BUTTONS.CHECK],
          [MEMBERSHIP_BUTTONS.BACK],
        ]),
      };
    }
    if (!check.in_channel) {
      return {
        text: MEMBERSHIP.channelStep,
        keyboard: Markup.inlineKeyboard([
          [MEMBERSHIP_BUTTONS.JOIN_CHANNEL],
          [MEMBERSHIP_BUTTONS.CHECK],
          [MEMBERSHIP_BUTTONS.BACK],
        ]),
      };
    }
    throw new Error(`account ${accountId}: chat and channel joined, key is ${check.key_state}`);
  }

  // Inside a button press the screen replaces the pressed message; otherwise it
  // is a new message.
  private async show(ctx: Context, screen: MembershipScreen): Promise<void> {
    if (ctx.callbackQuery) {
      await SafeTelegramHelper.safeSend(
        () => ctx.editMessageText(screen.text, { parse_mode: 'HTML', ...screen.keyboard }),
        `Membership screen to ${ctx.from.id}`,
      );
      return;
    }
    await ctx.replyWithHTML(screen.text, screen.keyboard);
  }

  private async send(telegramId: number, screen: MembershipScreen): Promise<void> {
    await SafeTelegramHelper.safeSend(
      () => this.bot.telegram.sendMessage(telegramId, screen.text, { parse_mode: 'HTML', ...screen.keyboard }),
      `Membership notice to ${telegramId}`,
    );
  }
}

function unmetAlert(check: MembershipCheckWire): string {
  return check.in_chat ? MEMBERSHIP.notInChannel : MEMBERSHIP.notInChat;
}
