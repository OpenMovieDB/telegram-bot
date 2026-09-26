import { Context as BaseContext, Scenes } from 'telegraf';

import { Update } from 'telegraf/typings/core/types/typegram';
import type { InvoiceTarget } from '../payment/payment.service';

export interface Context extends BaseContext {
  update: Update.CallbackQueryUpdate;
  session: SessionData;
  scene: Scenes.SceneContextScene<Context, SceneSession>;
  match: any;
}

// Payment flow state (tariff/months/flags) lives in Redis via
// SessionStateService — only navigation helpers remain in the Telegraf session.
interface SessionData extends Scenes.SceneSession<SceneSession> {
  messageId?: number;
  accountId?: string;
  // The dashboard sign-in or link waiting for the person's «Войти»/«Привязать».
  dashboardAuthToken?: string;
}

interface SceneSession extends Scenes.SceneSessionData {
  state: {
    token?: string;
    // Custom invoice: whose account the invoice is recorded on.
    target?: InvoiceTarget;
    username?: string;
    tariffId?: string;
    newTariffId?: string;
    currentTariffId?: string;
    action?: string;
    amount?: number;
    description?: string;
    email?: string;
  };
}
