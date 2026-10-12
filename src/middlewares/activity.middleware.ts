import { Logger } from '@nestjs/common';
import { Context as TelegrafContext } from 'telegraf';
import { AccountClient } from '../account/account.client';

const logger = new Logger('ActivityMiddleware');

// Every message or button press of a person in a private chat with the bot is
// activity that keeps the account from removal (offer 4.4). The call does not
// hold the update: a failure is logged and the bot answers as usual.
export function recordActivity(accountClient: AccountClient) {
  return (ctx: TelegrafContext, next: () => Promise<void>) => {
    if (ctx.chat?.type === 'private' && ctx.from && !ctx.from.is_bot) {
      accountClient.recordActivity(ctx.from.id).catch((error: Error) => {
        logger.warn(`recordActivity(${ctx.from?.id}) failed: ${error.message}`);
      });
    }
    return next();
  };
}
