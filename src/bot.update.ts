import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import { Action, Ctx, InjectBot, Start, Update } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotService } from './bot.service';
import { BOT_NAME } from './constants/bot-name.const';
import { ResponseTimeInterceptor } from './interceptors/response-time-interceptor.service';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { Context } from './interfaces/context.interface';
import { SceneContext } from 'telegraf/typings/scenes';
import { CommandEnum } from './enum/command.enum';

@Update()
@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
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
}
