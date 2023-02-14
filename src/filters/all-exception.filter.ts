import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';

import { Context } from '../interfaces/context.interface';
import { Markup } from 'telegraf';
import { SCENES } from '../constants/scenes.const';
import { TelegrafArgumentsHost } from 'nestjs-telegraf';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  async catch(exception: Error, host: ArgumentsHost): Promise<void> {
    const telegrafHost = TelegrafArgumentsHost.create(host);
    const ctx = telegrafHost.getContext<Context>();
    const scene = SCENES.ERROR(exception.message);
    if (!['private'].includes(ctx?.message?.chat?.type)) return;

    Logger.error(exception.message, exception.stack, AllExceptionFilter.name);
    await ctx.replyWithHTML(scene.navigateText, Markup.keyboard(scene.navigateButtons).resize());
  }
}
