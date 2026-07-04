import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';

import { Context } from '../interfaces/context.interface';
import { Markup } from 'telegraf';
import { SCENES } from '../constants/scenes.const';
import { TelegrafArgumentsHost } from 'nestjs-telegraf';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  async catch(exception: Error, host: ArgumentsHost): Promise<void> {
    // Log FIRST — group/callback updates return early below, and a swallowed
    // exception without a log line is undebuggable.
    Logger.error(exception.message, exception.stack, AllExceptionFilter.name);

    const telegrafHost = TelegrafArgumentsHost.create(host);
    const ctx = telegrafHost.getContext<Context>();
    // ctx.chat covers both message and callback_query updates.
    if (ctx?.chat?.type !== 'private') return;

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Произошла ошибка').catch(() => undefined);
    }

    const scene = SCENES.ERROR(exception.message);
    await ctx
      .replyWithHTML(scene.navigateText, Markup.keyboard(scene.navigateButtons).resize())
      .catch((replyError: Error) =>
        Logger.error(`Failed to deliver error message: ${replyError.message}`, undefined, AllExceptionFilter.name),
      );
  }
}
