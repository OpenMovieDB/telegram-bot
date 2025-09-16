import { ExtraEditMessageText } from 'telegraf/typings/telegram-types';
import { Context } from '../interfaces/context.interface';
import { FmtString } from 'telegraf/src/format';
import { Logger } from '@nestjs/common';
import { SessionStateService } from '../session/session-state.service';

const logger = new Logger('SafeReply');

/**
 * Safely reply to user with fallback to simple reply if edit fails
 * This prevents crashes when trying to edit messages that can't be edited
 * @param sessionService Optional SessionStateService for message tracking. If not provided, falls back to ctx.session
 */
export const safeReplyOrEdit = async (
  ctx: Context,
  text: string,
  extra: ExtraEditMessageText,
  sessionService?: SessionStateService,
): Promise<any> => {
  try {
    // For text messages from user, always use reply
    if (ctx.message && !ctx.callbackQuery) {
      const reply = await ctx.replyWithHTML(text, extra);
      if (sessionService && ctx.from?.id) {
        await sessionService.setMessageId(ctx.from.id, reply.message_id);
      } else if (ctx.session) {
        ctx.session.messageId = reply.message_id;
      }
      return reply;
    }

    // For callback queries, try to edit the original message
    const savedMessageId = sessionService && ctx.from?.id
      ? await sessionService.getMessageId(ctx.from.id)
      : ctx.session?.messageId;
    const messageId = ctx.update.callback_query?.message?.message_id || savedMessageId;
    const chatId = ctx.from?.id;

    if (messageId && chatId) {
      try {
        return await ctx.telegram.editMessageText(
          chatId,
          messageId,
          undefined,
          { text, parse_mode: 'HTML' } as FmtString,
          extra,
        );
      } catch (editError) {
        // If edit fails (message too old, already edited, etc.), send new message
        logger.debug(`Failed to edit message ${messageId}, sending new message instead: ${editError.message}`);
        const reply = await ctx.replyWithHTML(text, extra);
        if (sessionService && ctx.from?.id) {
          await sessionService.setMessageId(ctx.from.id, reply.message_id);
        } else if (ctx.session) {
          ctx.session.messageId = reply.message_id;
        }
        return reply;
      }
    }

    // Default to sending a new message
    const reply = await ctx.replyWithHTML(text, extra);
    if (sessionService && ctx.from?.id) {
      await sessionService.setMessageId(ctx.from.id, reply.message_id);
    } else if (ctx.session) {
      ctx.session.messageId = reply.message_id;
    }
    return reply;
  } catch (error) {
    logger.error(`Failed to send message: ${error.message}`);

    // Try simple text reply as last resort
    try {
      return await ctx.reply(text.replace(/<[^>]*>/g, '')); // Strip HTML tags
    } catch (finalError) {
      logger.error(`Final attempt to send message failed: ${finalError.message}`);
      throw finalError;
    }
  }
};

/**
 * Always send a new message, never try to edit
 * Use this for important notifications that must be visible
 * @param sessionService Optional SessionStateService for message tracking
 */
export const safeReply = async (
  ctx: Context,
  text: string,
  extra?: any,
  sessionService?: SessionStateService,
): Promise<any> => {
  try {
    const reply = await ctx.replyWithHTML(text, extra);
    if (sessionService && ctx.from?.id) {
      await sessionService.setMessageId(ctx.from.id, reply.message_id);
    } else if (ctx.session) {
      ctx.session.messageId = reply.message_id;
    }
    return reply;
  } catch (error) {
    logger.error(`Failed to send HTML message: ${error.message}`);

    // Fallback to plain text
    try {
      return await ctx.reply(text.replace(/<[^>]*>/g, ''), extra);
    } catch (finalError) {
      logger.error(`Failed to send plain text message: ${finalError.message}`);
      throw finalError;
    }
  }
};
