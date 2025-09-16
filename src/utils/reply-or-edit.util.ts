import { ExtraEditMessageText } from 'telegraf/typings/telegram-types';
import { Context } from '../interfaces/context.interface';
import { FmtString } from 'telegraf/src/format';
import { SessionStateService } from '../session/session-state.service';

export const replyOrEdit = async (
  ctx: Context,
  text: string,
  extra: ExtraEditMessageText,
  sessionService?: SessionStateService,
): Promise<any> => {
  const savedMessageId = sessionService && ctx.from?.id
    ? await sessionService.getMessageId(ctx.from.id)
    : ctx.session?.messageId;
  const messageId = ctx.update.callback_query?.message.message_id
    ? ctx.update.callback_query?.message.message_id
    : savedMessageId;
  const chatId = ctx.from.id;
  if (messageId) {
    return await ctx.telegram.editMessageText(
      chatId,
      messageId,
      undefined,
      { text, parse_mode: 'HTML' } as FmtString,
      extra,
    );
  }
  const reply = await ctx.replyWithHTML(text, extra);
  if (sessionService && ctx.from?.id) {
    await sessionService.setMessageId(ctx.from.id, reply.message_id);
  } else if (ctx.session) {
    ctx.session.messageId = reply.message_id;
  }
  return reply;
};
