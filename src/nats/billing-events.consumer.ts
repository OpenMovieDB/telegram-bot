import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AckPolicy, DeliverPolicy, JsMsg, NatsConnection, connect, nanos } from 'nats';

import { BotService } from '../bot.service';
import { AccountClient } from '../account/account.client';
import { TariffService } from '../tariff/tariff.service';
import { SessionStateService } from '../session/session-state.service';
import { accountTariffName } from '../utils/tariff-display.util';

const STREAM = 'BILLING_EVENTS';
const DURABLE = 'telegram-bot-events';
const SUBJECT_PAYMENT_PAID = 'billing.payment.paid';
const SUBJECT_PAYMENT_FAILED = 'billing.payment.failed';
const SUBJECT_EXPIRING = 'billing.subscription.expiring';
const SUBJECT_EXPIRED = 'billing.subscription.expired';
const SUBJECT_TARIFF_CATALOG = 'billing.tariff.catalog.updated';

interface SubscriptionEvent {
  subscription_id: string;
  user_id: string; // account-service UUID
  tariff_id: string;
  expires_at?: string;
  expired_at?: string;
  days_left?: number;
}

interface PaymentPaidEvent {
  payment_id: string;
  user_id: string; // account-service UUID
  tariff_id?: string;
  amount_kopecks: number;
  currency: string;
  source: string;
  months: number;
  paid_at: string;
  is_invoice: boolean;
  description?: string;
  provider?: string;
  discount_kopecks?: number;
  original_amount_kopecks?: number;
}

interface PaymentFailedEvent {
  payment_id: string;
  user_id: string;
  source: string;
  reason: string;
  amount_kopecks: number;
  currency: string;
}

// BillingEventsConsumer is the bot's only payment/subscription signal path.
// billing-service owns both lifecycles and publishes domain events through its
// transactional outbox; this durable consumer turns them into Telegram
// messages. There is no bot-side payment poller and no local payment state —
// payment.paid is emitted inside billing's atomic-claim transaction, so
// exactly-one notification per payment is billing's guarantee, not ours.
// Durable + explicit-ack so it survives restarts and load-balances across bot
// replicas. Private Telegram chats have chat_id == telegram user id, so the
// account's telegram_id is the only address we need.
@Injectable()
export class BillingEventsConsumer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BillingEventsConsumer.name);
  private nc?: NatsConnection;
  private stopped = false;

  constructor(
    private readonly config: ConfigService,
    private readonly botService: BotService,
    private readonly accountClient: AccountClient,
    private readonly tariffService: TariffService,
    private readonly sessionStateService: SessionStateService,
  ) {}

  onModuleInit() {
    const url = this.config.get<string>('NATS_URL');
    if (!url) {
      this.logger.warn('NATS_URL not set — billing payment/subscription notifications are DISABLED');
      return;
    }
    // Fire-and-forget: never block bot startup on NATS/billing availability.
    void this.runForever(url);
  }

  async onApplicationShutdown() {
    this.stopped = true;
    await this.nc?.drain().catch(() => undefined);
  }

  private async runForever(url: string) {
    while (!this.stopped) {
      try {
        await this.connectAndConsume(url);
      } catch (error) {
        this.logger.error(`Billing events consumer error: ${(error as Error).message} — retrying in 10s`);
      }
      if (!this.stopped) await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  private async connectAndConsume(url: string) {
    this.nc = await connect({
      servers: url,
      name: 'telegram-bot-billing-events',
      reconnect: true,
      maxReconnectAttempts: -1,
    });
    this.logger.log(`Connected to NATS for billing events (${url})`);

    const jsm = await this.nc.jetstreamManager();
    try {
      await jsm.consumers.info(STREAM, DURABLE);
    } catch {
      await jsm.consumers.add(STREAM, {
        durable_name: DURABLE,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.New, // don't replay history on first deploy
        filter_subjects: [SUBJECT_PAYMENT_PAID, SUBJECT_PAYMENT_FAILED, SUBJECT_EXPIRING, SUBJECT_EXPIRED],
        ack_wait: nanos(30_000),
        max_deliver: 5,
      });
      this.logger.log(`Created durable consumer ${DURABLE} on ${STREAM}`);
    }

    // Catalog invalidation is fan-out, not work distribution: EVERY replica
    // must drop its cache, and a missed event only means waiting out the TTL —
    // so a plain core subscription (no durable, no ack) is the right tool.
    const catalogSub = this.nc.subscribe(SUBJECT_TARIFF_CATALOG);
    void (async () => {
      for await (const message of catalogSub) {
        this.tariffService.invalidate();
        this.logger.log(`Tariff catalog updated in billing (${message.subject}) — bot cache invalidated`);
      }
    })();

    const consumer = await this.nc.jetstream().consumers.get(STREAM, DURABLE);
    const messages = await consumer.consume();
    for await (const message of messages) {
      try {
        await this.handle(message);
        message.ack();
      } catch (error) {
        this.logger.error(`Failed to handle ${message.subject}: ${(error as Error).message}`);
        message.nak();
      }
    }
  }

  private async handle(message: JsMsg) {
    switch (message.subject) {
      case SUBJECT_PAYMENT_PAID:
        return this.handlePaymentPaid(message.json<PaymentPaidEvent>());
      case SUBJECT_PAYMENT_FAILED:
        return this.handlePaymentFailed(message.json<PaymentFailedEvent>());
      case SUBJECT_EXPIRING:
      case SUBJECT_EXPIRED:
        return this.handleSubscription(message.subject, message.json<SubscriptionEvent>());
      default:
        return;
    }
  }

  private async handlePaymentPaid(event: PaymentPaidEvent) {
    if (!event?.user_id) return;

    // A paid admin invoice has no subscription effect — report to the operator
    // chat only.
    if (event.is_invoice) {
      await this.botService.sendInvoicePaidMessageToAdmin(
        event.description ?? '',
        event.amount_kopecks / 100,
        event.provider ?? '',
      );
      return;
    }

    // Dashboard payments are notified by the dashboard channel; the bot speaks
    // only for its own sales.
    if (event.source !== 'bot') return;

    const account = await this.accountClient.getById(event.user_id);
    const telegramId = account.telegram_id;
    if (!telegramId) {
      this.logger.warn(`Paid payment ${event.payment_id}: account ${event.user_id} has no telegram — skipping notify`);
      return;
    }

    const tariff = event.tariff_id ? await this.tariffService.getOneById(event.tariff_id) : null;
    const tariffName = tariff?.display_name ?? accountTariffName(account.tariff);
    const subscriptionEnd = account.subscription_end ? new Date(account.subscription_end) : undefined;

    await this.sessionStateService.setExitPaymentScene(telegramId);
    await this.botService.sendPaymentSuccessMessage(telegramId, tariffName, subscriptionEnd);
    await this.botService.sendPaymentSuccessMessageToAdmin(
      account.telegram_username || account.username || String(telegramId),
      tariffName,
      event.months,
      event.amount_kopecks / 100,
      event.provider ?? '',
      (event.discount_kopecks ?? 0) / 100,
      (event.original_amount_kopecks ?? 0) / 100,
    );
  }

  private async handlePaymentFailed(event: PaymentFailedEvent) {
    if (!event?.user_id || event.source !== 'bot') return;

    const account = await this.accountClient.getById(event.user_id);
    if (!account.telegram_id) return;

    await this.botService.sendMessage(
      account.telegram_id,
      '⏰ Платеж не прошел или время оплаты истекло. Если вы хотите оформить подписку, пожалуйста, создайте новый платеж.',
    );
  }

  private async handleSubscription(subject: string, event: SubscriptionEvent) {
    if (!event?.user_id) return;

    // billing identifies the user by account UUID; resolve the Telegram chat.
    const account = await this.accountClient.getById(event.user_id);
    if (!account.telegram_id) return; // dashboard-only or external account — not ours to notify

    if (subject === SUBJECT_EXPIRING && event.expires_at) {
      await this.botService.sendSubscriptionExpirationWarningMessage(account.telegram_id, new Date(event.expires_at));
    } else if (subject === SUBJECT_EXPIRED) {
      await this.botService.sendSubscriptionExpiredMessage(account.telegram_id);
    }
  }
}
