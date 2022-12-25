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
  async onStart(@Ctx() ctx: Context) {
    ctx.session.messageId = undefined;
    await ctx.scene.enter(CommandEnum.START);
  }

  @Action(/.*/)
  async onAnswer(@Ctx() ctx: SceneContext & { update: any }) {
    const cbQuery = ctx.update.callback_query;
    const nextStep = 'data' in cbQuery ? cbQuery.data : null;
    await ctx.scene.enter(nextStep);
  }

  @Hears('🏠 в меню')
  async onMenuHears(@Ctx() ctx: Context) {
    this.logger.log('hears', ctx.message);
    const existUser = await this.userService.findOneByUserId(ctx.from.id);
    if (existUser) {
      await ctx.scene.enter(CommandEnum.HOME);
    } else {
      await ctx.scene.enter(CommandEnum.START);
    }
  }

  @Hears('📊 статистика запросов')
  async onStatsHears(@Ctx() ctx: Context) {
    this.logger.log('stats', ctx.message);
    await ctx.scene.enter(CommandEnum.GET_REQUEST_STATS);
  }

  @Hears('у меня есть вопрос 🥹')
  async onQuestionHears(@Ctx() ctx: Context) {
    this.logger.log('question', ctx.message);
    await ctx.scene.enter(CommandEnum.QUESTION);
  }

  @Hears('🔥 обновить тариф')
  async onTariffHears(@Ctx() ctx: Context) {
    this.logger.log('tariff', ctx.message);
    await ctx.scene.enter(CommandEnum.UPDATE_TARIFF);
  }

  @Hears('хочу доступ к API 🚀')
  async onApiHears(@Ctx() ctx: Context) {
    this.logger.log('api', ctx.message);
    await ctx.scene.enter(CommandEnum.GET_ACCESS);
  }

  @Hears('у меня уже есть токен 🤓')
  async onTokenHears(@Ctx() ctx: Context) {
    this.logger.log('token', ctx.message);
    await ctx.scene.enter(CommandEnum.I_HAVE_TOKEN);
  }

  @On('new_chat_members')
  async onNewChatMembers(@Ctx() ctx: Context) {
    await this.botService.createInvitedUser(ctx);
  }

  @On('left_chat_member')
  async onLeftChatMember(@Ctx() ctx: Context) {
    this.logger.log('left_chat_member', ctx);
    await this.botService.leftTheChat(ctx);
  }
}
