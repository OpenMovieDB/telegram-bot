import { Injectable, Logger } from '@nestjs/common';
import { Markup, Telegraf } from 'telegraf';
import { Context } from './interfaces/context.interface';

import { InjectBot } from 'nestjs-telegraf';
import { SCENES } from './constants/scenes.const';
import { CommandEnum } from './enum/command.enum';
import { replyOrEdit } from './utils/reply-or-edit.util';
import { BOT_NAME } from './constants/bot-name.const';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  constructor(
    @InjectBot(BOT_NAME)
    private readonly bot: Telegraf<Context>,
  ) {}

  async start(ctx: Context) {
    await replyOrEdit(
      ctx,
      SCENES[CommandEnum.START].text,
      Markup.inlineKeyboard(SCENES[CommandEnum.START].buttons),
    );
  }
}
