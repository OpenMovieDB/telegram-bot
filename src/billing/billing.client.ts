import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AxiosError, AxiosResponse } from 'axios';
import { Observable, lastValueFrom } from 'rxjs';

// billing-service supports two real providers. The bot's historical payment
// systems map onto these: TBANK→tbank, CYPTOMUS→heleket (Cryptomus is now
// branded Heleket — same provider). YooKassa/YooMoney/Wallet are retired.
export type BillingPaymentProvider = 'tbank' | 'heleket';

export type BillingPaymentStatusValue = 'initializing' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface BillingCreatePaymentInput {
  tariff_id: string;
  payment_provider: BillingPaymentProvider;
  payment_months: number;
  email?: string;
  source?: 'dashboard' | 'bot' | 'admin';
}

// Admin cash sale — records a manually-collected payment and grants the tariff.
// amount (rubles) is optional: omitted ⇒ tariff price for the period; > 0 ⇒
// overrides (negotiated/partial cash). end_date overrides the computed expiry.
export interface BillingAdminCashInput {
  user_id: string;
  tariff_id: string;
  payment_months: number;
  amount?: number;
  email?: string;
  end_date?: string;
}

// Admin grant — a manual subscription change/extension with no payment record
// (gift, correction, external client). Exactly one of months / end_date /
// perpetual. months extends from the current active end when it is in the
// future, otherwise from now; perpetual stores a NULL end.
export interface BillingAdminGrantInput {
  user_id: string;
  tariff_id: string;
  months?: number;
  end_date?: string;
  perpetual?: boolean;
}

// Subscription as billing returns it from admin grant/extend. `expires_at` is
// omitted for a perpetual subscription.
export interface BillingSubscription {
  status: string;
  tariff_id: string;
  tariff_name?: string;
  started_at?: string;
  expires_at?: string;
  auto_extend?: boolean;
}

export interface BillingExpiringSubscription {
  subscription_id: string;
  user_id: string;
  tariff_id: string;
  expires_at: string;
  days_left: number;
}

// Admin invoice — an off-tariff charge of an arbitrary amount (rubles). Grants
// nothing; exists only to put money on billing's books.
export interface BillingAdminInvoiceInput {
  user_id: string;
  amount: number;
  description: string;
  payment_provider: BillingPaymentProvider;
  email?: string;
}

export interface BillingPayment {
  payment_id: string;
  external_id: string;
  status: BillingPaymentStatusValue;
  is_final: boolean;
  amount: number;
  original_amount: number;
  discount: number;
  currency: string;
  provider: string;
  payment_url: string | null;
  tariff_id: string;
  payment_months: number;
  email: string | null;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface BillingTariffPrice {
  id: string;
  months: number;
  price_kopecks: number;
  discount_kopecks: number;
  currency: string;
}

export interface BillingTariff {
  id: string;
  code: string;
  display_name: string;
  description: string;
  requests_limit: number;
  is_default: boolean;
  is_hidden: boolean;
  is_popular: boolean;
  features: { text: string; included: boolean }[];
  sort_order: number;
  status: string;
  version: number;
  prices: BillingTariffPrice[];
}

// BillingApiError surfaces billing-service's machine-readable error code (the
// `error` field of its `{error, message}` JSON envelope) so callers can branch
// on it — e.g. `downgrade_not_allowed`, `payment_pending`, `email_required` —
// instead of parsing HTTP status or message text.
export class BillingApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = 'BillingApiError';
  }
}

function toBillingError(error: unknown): unknown {
  const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
  const response = axiosErr?.response;
  if (response) {
    const data = response.data ?? {};
    return new BillingApiError(data.error ?? 'billing_error', response.status, data.message ?? axiosErr.message);
  }
  return error;
}

@Injectable()
export class BillingClient {
  private readonly logger = new Logger(BillingClient.name);
  private readonly baseUrl: string;
  private readonly serviceToken: string;

  constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('BILLING_SERVICE_URL') ?? '';
    this.serviceToken = this.configService.get<string>('BILLING_SERVICE_TOKEN') ?? '';
  }

  private headers(requestId?: string): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', 'X-Request-ID': requestId ?? randomUUID() };
    if (this.serviceToken) h['X-Service-Token'] = this.serviceToken;
    return h;
  }

  // user-scoped calls (create/read/cancel a payment on behalf of a user) carry
  // the account UUID in X-User-ID; billing scopes ownership by it.
  private userHeaders(accountId: string, requestId?: string): Record<string, string> {
    return { ...this.headers(requestId), 'X-User-ID': accountId };
  }

  private async send<T>(obs: Observable<AxiosResponse<T>>): Promise<T> {
    try {
      const { data } = await lastValueFrom(obs);
      return data;
    } catch (error) {
      throw toBillingError(error);
    }
  }

  async listTariffs(): Promise<BillingTariff[]> {
    return this.send(
      this.httpService.get<BillingTariff[]>(`${this.baseUrl}/v1/tariffs`, { headers: this.headers(), timeout: 5000 }),
    );
  }

  // Full catalog including hidden (staff/partner) tariffs — admin flows only.
  async adminListTariffs(): Promise<BillingTariff[]> {
    return this.send(
      this.httpService.get<BillingTariff[]>(`${this.baseUrl}/v1/admin/tariffs`, {
        headers: this.headers(),
        timeout: 5000,
      }),
    );
  }

  // createPayment initiates a payment in billing on behalf of `accountId`.
  // billing computes price/discount, calls the provider, and returns the
  // redirect URL. billing's scheduler later closes the payment and grants the
  // subscription via account — the bot never writes the subscription itself.
  // idempotencyKey makes retries of the same purchase attempt return the same
  // payment instead of creating a second provider invoice.
  async createPayment(
    accountId: string,
    input: BillingCreatePaymentInput,
    idempotencyKey?: string,
    requestId?: string,
  ): Promise<BillingPayment> {
    const headers = this.userHeaders(accountId, requestId);
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return this.send(
      this.httpService.post<BillingPayment>(`${this.baseUrl}/v1/payments`, input, {
        headers,
        timeout: 8000,
      }),
    );
  }

  // Cancels a still-pending payment (atomic, owner-scoped in billing). Used when
  // the user abandons one pending payment to start another.
  async cancelPayment(accountId: string, paymentId: string, requestId?: string): Promise<BillingPayment> {
    return this.send(
      this.httpService.post<BillingPayment>(
        `${this.baseUrl}/v1/payments/${paymentId}/cancel`,
        {},
        { headers: this.userHeaders(accountId, requestId), timeout: 5000 },
      ),
    );
  }

  // recentPayments returns the user's last few payments; the bot uses it as the
  // "do you already have a pending payment?" guard now that billing is the
  // system of record (the bot no longer stores payments in Mongo).
  async recentPayments(accountId: string, requestId?: string): Promise<BillingPayment[]> {
    return this.send(
      this.httpService.get<BillingPayment[]>(`${this.baseUrl}/v1/payments/recent`, {
        headers: this.userHeaders(accountId, requestId),
        timeout: 5000,
      }),
    );
  }

  // Admin: record a manually-collected cash sale (grants the tariff in billing).
  async createAdminCash(input: BillingAdminCashInput, requestId?: string): Promise<BillingPayment> {
    return this.send(
      this.httpService.post<BillingPayment>(`${this.baseUrl}/v1/admin/payments/cash`, input, {
        headers: this.headers(requestId),
        timeout: 8000,
      }),
    );
  }

  // Admin: issue an off-tariff invoice (arbitrary amount, grants nothing).
  async createAdminInvoice(input: BillingAdminInvoiceInput, requestId?: string): Promise<BillingPayment> {
    return this.send(
      this.httpService.post<BillingPayment>(`${this.baseUrl}/v1/admin/invoices`, input, {
        headers: this.headers(requestId),
        timeout: 8000,
      }),
    );
  }

  // Admin: manual subscription grant (no payment record) — billing owns the
  // subscription and propagates the tariff to account itself.
  async adminGrantSubscription(input: BillingAdminGrantInput, requestId?: string): Promise<BillingSubscription> {
    return this.send(
      this.httpService.post<BillingSubscription>(`${this.baseUrl}/v1/admin/subscriptions/grant`, input, {
        headers: this.headers(requestId),
        timeout: 8000,
      }),
    );
  }

  // Admin: active subscriptions ending within `days` (perpetual ones excluded).
  async expiringSubscriptions(days: number, requestId?: string): Promise<BillingExpiringSubscription[]> {
    return this.send(
      this.httpService.get<BillingExpiringSubscription[]>(`${this.baseUrl}/v1/admin/subscriptions/expiring`, {
        headers: this.headers(requestId),
        params: { days },
        timeout: 8000,
      }),
    );
  }

  // Admin: force a pending payment to paid (billing runs the same atomic claim +
  // grant as the scheduler would). Used by the operator /confirm command.
  async confirmAdminPayment(paymentId: string, requestId?: string): Promise<BillingPayment> {
    return this.send(
      this.httpService.post<BillingPayment>(
        `${this.baseUrl}/v1/admin/payments/${paymentId}/confirm`,
        {},
        { headers: this.headers(requestId), timeout: 8000 },
      ),
    );
  }
}
