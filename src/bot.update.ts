import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import { Action, Ctx, Hears, InjectBot, On, Start, Update } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotService } from './bot.service';
import { BOT_NAME } from './constants/bot-name.const';
import { ResponseTimeInterceptor } from './interceptors/response-time-interceptor.service';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { Context } from './interfaces/context.interface';
import { SceneContext } from 'telegraf/typings/scenes';
import { CommandEnum } from './enum/command.enum';
import { UserService } from './user/user.service';
import { BUTTONS } from './constants/buttons.const';

@Update()
@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
    private readonly userService: UserService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;
    if (!['private'].includes(message.chat.type)) {
      await ctx.reply('Для работы с ботом, нужно писать ему в личные сообщения', {
        reply_markup: {
          remove_keyboard: true,
        },
      });
      return;
    }

    try {
      const user = await this.userService.findOneByUserId(ctx.from.id);
      if (!user)
        await this.userService.create({
          userId: ctx.from.id,
          username: ctx.from.username,
        });
      ctx.session.messageId = undefined;
      await ctx.scene.enter(CommandEnum.START);
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Action(/.*/)
  async onAnswer(@Ctx() ctx: SceneContext & { update: any }) {
    this.logger.log(ctx);
    try {
      const cbQuery = ctx.update.callback_query;
      if (!['private'].includes(cbQuery.message.chat.type)) return;
      const nextStep = 'data' in cbQuery ? cbQuery.data : null;
      await ctx.scene.enter(nextStep);
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears(BUTTONS[CommandEnum.HOME].text)
  async onMenuHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    try {
      this.logger.log('hears', ctx.message);
      const existUser = await this.userService.findOneByUserId(ctx.from.id);
      if (existUser) {
        ctx.scene.enter(CommandEnum.HOME);
      } else {
        ctx.scene.enter(CommandEnum.START);
      }
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears(/.*/)
  async onStatsHears(@Ctx() ctx: Context & { update: any }) {
    try {
      const message = ctx.update.message;
      const [command] = Object.entries(BUTTONS).find(([_, button]) => button.text === message.text);

      if (!['private'].includes(message.chat.type)) return;

      this.logger.log('stats', ctx.message);
      ctx.scene.enter(command);
    } catch (e) {
      this.logger.log(e);
    }
  }

  @On('new_chat_members')
  async onNewChatMembers(@Ctx() ctx: Context & { update: any }) {
    await this.botService.createInvitedUser(ctx);
  }

  @On('left_chat_member')
  async onLeftChatMember(@Ctx() ctx: Context & { update: any }) {
    this.logger.log('left_chat_member', ctx);
    this.botService.leftTheChat(ctx);
  }
}
