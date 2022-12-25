import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';

import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from './enum/command.enum';
import { replyOrEdit } from './utils/reply-or-edit.util';
import { BOT_NAME } from './constants/bot-name.const';
import { User as TelegramUser } from 'typegram/manage';
import { UserService } from './user/user.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly userService: UserService,
  ) {}

  async start(ctx: Context) {
    await replyOrEdit(
      ctx,
      SCENES[CommandEnum.START].navigateText,
      Markup.inlineKeyboard(SCENES[CommandEnum.START].navigateButtons),
    );
  }

  async createInvitedUser(ctx: Context) {
    const members: TelegramUser[] =
      ctx.update?.['message']?.['new_chat_members'];
    this.logger.log(
      `NewChatMembers: ${members
        .map((member: any) => member.username)
        .join(', ')}`,
    );

    if (members) {
      for (const member of members) {
        const user = await this.userService.upsert({
          userId: member.id,
          username: member.username,
          inChat: true,
        });

        this.logger.log(`User ${user.username} created`);
      }
    }
  }

  async leftTheChat(ctx: Context) {
    await this.userService.blockUser(ctx.from.id, false);

    this.logger.log(`User ${ctx.from.username} blocked`);
  }
}
