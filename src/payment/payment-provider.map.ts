import { BillingPaymentProvider } from '../billing/billing.client';
import { PaymentSystemEnum } from './enum/payment-system.enum';

// Maps the bot's historical payment systems onto billing-service providers.
// Only T-Bank and crypto are still offered: CYPTOMUS is Cryptomus, which is now
// branded Heleket — the same provider billing implements as `heleket`.
// CASH is admin-only (created via billing's /v1/admin/payments/cash, not here).
// YOOKASSA/YOOMONEY/WALLET are retired (no paid traffic since 2024).
const PROVIDER_MAP: Partial<Record<PaymentSystemEnum, BillingPaymentProvider>> = {
  [PaymentSystemEnum.TBANK]: 'tbank',
  [PaymentSystemEnum.CYPTOMUS]: 'heleket',
};

export function toBillingProvider(system: PaymentSystemEnum): BillingPaymentProvider {
  const provider = PROVIDER_MAP[system];
  if (!provider) {
    throw new Error(`UNSUPPORTED_PAYMENT_SYSTEM:${system}`);
  }
  return provider;
}
