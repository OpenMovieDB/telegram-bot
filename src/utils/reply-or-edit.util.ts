import { ExtraEditMessageText } from 'telegraf/typings/telegram-types';
import { Context } from '../interfaces/context.interface';
import { FmtString } from 'telegraf/src/format';

export const replyOrEdit = async (ctx: Context, text: string, extra: ExtraEditMessageText) => {
  const messageId = ctx.update.callback_query?.message.message_id
    ? ctx.update.callback_query?.message.message_id
    : ctx.session.messageId;
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
  ctx.session.messageId = reply.message_id;
  return;
};
