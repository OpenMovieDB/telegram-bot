import { Injectable, Logger } from '@nestjs/common';
import { accountTariffName } from '../utils/tariff-display.util';
import { DateTime } from 'luxon';

import { PaymentSystemEnum } from './enum/payment-system.enum';
import { TariffService } from 'src/tariff/tariff.service';
import { BillingApiError, BillingClient, BillingPayment } from '../billing/billing.client';
import { AccountClient } from '../account/account.client';
import { toBillingProvider } from './payment-provider.map';

// PaymentService is a stateless façade over billing-service: billing owns the
// payment lifecycle (price, provider, atomic claim, grant via account) and is
// the only system of record. The bot resolves the payer's account UUID, relays
// the call, and translates billing's machine-readable errors into the scene
// contract. Success/failure notifications arrive as billing.payment.* events
// (BillingEventsConsumer) — nothing is persisted bot-side.
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly tariffService: TariffService,
    private readonly billingClient: BillingClient,
    private readonly accountClient: AccountClient,
  ) {}

  async createPayment(
    telegramId: number,
    telegramUsername: string | undefined,
    tariffId: string,
    paymentSystem: PaymentSystemEnum,
    paymentMonths: number,
    email?: string,
    idempotencyKey?: string,
  ): Promise<BillingPayment> {
    const provider = toBillingProvider(paymentSystem);
    // Idempotent upsert by Telegram id — the payment flow may be the user's
    // first touch with the bot.
    const account = await this.accountClient.upsertByTelegramId(telegramId, telegramUsername);

    try {
      return await this.billingClient.createPayment(
        account.id,
        {
          tariff_id: tariffId,
          payment_provider: provider,
          payment_months: paymentMonths,
          email: email ?? account.email ?? undefined,
          source: 'bot',
        },
        idempotencyKey,
      );
    } catch (error) {
      throw await this.translateBillingCreateError(error, account.id, tariffId);
    }
  }

  // Admin cash sale (/pay): the target is identified by API token, billing
  // records the money and grants the tariff.
  async adminCashPaymentByToken(
    targetToken: string,
    tariffId: string,
    paymentMonths: number,
    email?: string,
    endDate?: Date,
  ): Promise<BillingPayment> {
    const owner = await this.accountClient.getByToken(targetToken);
    if (!owner) throw new Error('USER_NOT_FOUND');

    return this.billingClient.createAdminCash({
      user_id: owner.user_id,
      tariff_id: tariffId,
      payment_months: paymentMonths,
      email: email || undefined,
      end_date: endDate ? endDate.toISOString() : undefined,
    });
  }

  // Admin off-tariff invoice (arbitrary amount, grants nothing). Resolves the
  // target user by API token, then bills through T-Bank (receipt → email).
  async createInvoice(
    targetToken: string,
    amount: number,
    description: string,
    email: string,
  ): Promise<{ paymentUrl: string; orderId: string }> {
    const owner = await this.accountClient.getByToken(targetToken);
    if (!owner) throw new Error('USER_NOT_FOUND');

    const invoice = await this.billingClient.createAdminInvoice({
      user_id: owner.user_id,
      amount,
      description,
      payment_provider: 'tbank',
      email,
    });

    return { paymentUrl: invoice.payment_url ?? '', orderId: invoice.external_id || invoice.payment_id };
  }

  // Operator /confirm: force the payment to paid in billing (same atomic claim +
  // grant as the scheduler). The user notification arrives via the
  // billing.payment.paid event — no bot-side follow-up needed.
  async adminConfirmPayment(paymentId: string): Promise<boolean> {
    try {
      await this.billingClient.confirmAdminPayment(paymentId);
      return true;
    } catch (error) {
      if (error instanceof BillingApiError && error.code === 'already_final') {
        return true;
      }
      throw error;
    }
  }

  // The user's open payment, straight from billing (the system of record).
  // Read-only resolve: a user who never touched the bot has no account and
  // therefore no pending payment.
  async getUserPendingPayment(telegramId: number): Promise<BillingPayment | null> {
    const account = await this.accountClient.getByTelegramId(telegramId);
    if (!account) return null;

    const recent = await this.billingClient.recentPayments(account.id);
    return recent.find((payment) => !payment.is_final && ['pending', 'initializing'].includes(payment.status)) ?? null;
  }

  async cancelUserPendingPayment(telegramId: number): Promise<boolean> {
    const account = await this.accountClient.getByTelegramId(telegramId);
    if (!account) return false;

    const recent = await this.billingClient.recentPayments(account.id);
    const pending = recent.find((payment) => !payment.is_final && ['pending', 'initializing'].includes(payment.status));
    if (!pending) return false;

    await this.billingClient.cancelPayment(account.id, pending.payment_id);
    this.logger.debug(`Cancelled pending payment ${pending.payment_id} for telegram user ${telegramId}`);
    return true;
  }

  // Maps billing's machine-readable error codes onto the bot's existing scene
  // contract. billing is the authority on the downgrade rule (409
  // downgrade_not_allowed); we rebuild the friendly RU explanation from account
  // + catalog data so the user sees *why*, not a generic error.
  private async translateBillingCreateError(error: unknown, accountId: string, targetTariffId: string): Promise<Error> {
    if (!(error instanceof BillingApiError)) {
      return error instanceof Error ? error : new Error(String(error));
    }
    if (error.code === 'payment_pending' || error.code === 'idempotency_key_conflict') {
      return new Error('PENDING_PAYMENT_EXISTS');
    }
    if (error.code === 'downgrade_not_allowed') {
      return new Error(`DOWNGRADE_NOT_ALLOWED:${await this.buildDowngradeMessage(accountId, targetTariffId)}`);
    }
    return error;
  }

  private async buildDowngradeMessage(accountId: string, targetTariffId: string): Promise<string> {
    let currentName = '—';
    let endText = '';
    let daysRemaining = 0;
    try {
      const account = await this.accountClient.getById(accountId);
      currentName = accountTariffName(account.tariff);
      if (account.subscription_end) {
        const end = DateTime.fromISO(account.subscription_end);
        daysRemaining = Math.max(0, Math.ceil(end.diff(DateTime.now(), 'days').days));
        endText = ` (до ${end.toFormat('dd.MM.yyyy')})`;
      }
    } catch (error) {
      this.logger.error(`Failed to read account ${accountId} for downgrade message: ${(error as Error).message}`);
    }
    const target = await this.tariffService.getOneById(targetTariffId);
    const targetName = target?.display_name ?? 'выбранный тариф';
    return (
      `Вы не можете перейти на более дешевый тариф пока действует текущая подписка. ` +
      `Ваш тариф "${currentName}" действует еще ${daysRemaining} дней${endText}. ` +
      `Вы сможете сменить тариф на "${targetName}" в день истечения подписки или после.`
    );
  }
}
