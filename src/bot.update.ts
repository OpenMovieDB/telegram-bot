import { UseFilters, UseInterceptors } from '@nestjs/common';
import { Ctx, InjectBot, Start, Update } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { BotService } from './bot.service';
import { BOT_NAME } from './constants/bot-name.const';
import { ResponseTimeInterceptor } from './interceptors/response-time-interceptor.service';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { Context } from './interfaces/context.interface';

@Update()
@UseInterceptors(ResponseTimeInterceptor)
@UseFilters(AllExceptionFilter)
export class BotUpdate {
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
    private readonly botService: BotService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    ctx.session.messageId = undefined;
    await this.botService.start(ctx);
    return;
  }
}
