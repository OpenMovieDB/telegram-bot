import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import {
  Action,
  Ctx,
  Hears,
  InjectBot,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
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

    if (!['private'].includes(message.chat.type)) return;

    try {
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
        await ctx.scene.enter(CommandEnum.HOME);
      } else {
        await ctx.scene.enter(CommandEnum.START);
      }
    } catch (e) {
      this.logger.log(e);
    }
  }

  @Hears(BUTTONS[CommandEnum.GET_REQUEST_STATS].text)
  async onStatsHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('stats', ctx.message);
    await ctx.scene.enter(CommandEnum.GET_REQUEST_STATS);
  }

  @Hears(BUTTONS[CommandEnum.QUESTION].text)
  async onQuestionHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('question', ctx.message);
    await ctx.scene.enter(CommandEnum.QUESTION);
  }

  @Hears(BUTTONS[CommandEnum.UPDATE_TARIFF].text)
  async onTariffHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('tariff', ctx.message);
    await ctx.scene.enter(CommandEnum.UPDATE_TARIFF);
  }

  @Hears(BUTTONS[CommandEnum.GET_ACCESS].text)
  async onApiHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('api', ctx.message);
    await ctx.scene.enter(CommandEnum.GET_ACCESS);
  }

  @Hears(BUTTONS[CommandEnum.I_HAVE_TOKEN].text)
  async onTokenHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('token', ctx.message);
    await ctx.scene.enter(CommandEnum.I_HAVE_TOKEN);
  }

  @Hears(BUTTONS[CommandEnum.GET_MY_TOKEN].text)
  async onGetMyTokenHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('token', ctx.message);
    await ctx.scene.enter(CommandEnum.GET_MY_TOKEN);
  }

  @Hears(BUTTONS[CommandEnum.CHANGE_TOKEN].text)
  async onChangeTokenHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('token', ctx.message);
    await ctx.scene.enter(CommandEnum.CHANGE_TOKEN);
  }

  @Hears(BUTTONS[CommandEnum.UPDATE_MOVIE].text)
  async onUpdateMovieHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('update-movie', ctx.message);
    await ctx.scene.enter(CommandEnum.UPDATE_MOVIE);
  }

  @Hears(BUTTONS[CommandEnum.SET_IMDB_RELATION].text)
  async onUSetImdbRelationHears(@Ctx() ctx: Context & { update: any }) {
    const message = ctx.update.message;

    if (!['private'].includes(message.chat.type)) return;

    this.logger.log('set-imdb-relation', ctx.message);
    await ctx.scene.enter(CommandEnum.SET_IMDB_RELATION);
  }

  @On('new_chat_members')
  async onNewChatMembers(@Ctx() ctx: Context & { update: any }) {
    await this.botService.createInvitedUser(ctx);
  }

  @On('left_chat_member')
  async onLeftChatMember(@Ctx() ctx: Context & { update: any }) {
    this.logger.log('left_chat_member', ctx);
    await this.botService.leftTheChat(ctx);
  }
}
