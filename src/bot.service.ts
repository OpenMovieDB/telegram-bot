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
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BotService {
  private readonly chatId: string;
  private readonly adminChatId: string;

  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    this.chatId = configService.get('CHAT_ID');
    this.adminChatId = configService.get('ADMIN_CHAT_ID');
  }

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
          username: member?.username || null,
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

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async checkUsers() {
    const users = await this.userService.findUsersInChat();

    this.logger.log(`Users in chat: ${users.length}`);
    const leavedUsers = [];
    for (const user of users) {
      try {
        await this.bot.telegram.getChatMember(this.chatId, user.userId);
      } catch (e) {
        if (!user.password && user.tariffId?.name?.toLowerCase() === 'free') {
          try {
            await this.userService.blockUser(user.userId, false);

            leavedUsers.push(user.username || user.userId);

            this.logger.log(`User ${user.username} blocked`);
            await this.bot.telegram.sendMessage(
              user.userId,
              'Ваш токен был заблокирован, так как вы покинули наш чат 😢',
            );
          } catch (e) {
            this.logger.error(e);
          }
        }
      }
    }

    if (leavedUsers.length) {
      await this.bot.telegram.sendMessage(
        this.adminChatId,
        `😵‍💫Пользователи, которые вчера покинули чат: ${leavedUsers.join(', ')}`,
      );
    } else {
      await this.bot.telegram.sendMessage(
        this.adminChatId,
        '😎 Никто не покинул чат',
      );
    }
  }
}
