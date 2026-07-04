<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-21 -->

# payment

## Purpose
Thin, **stateless** bot-side façade over **billing-service**, which owns all money.
The bot talks to no payment gateway and persists nothing: it creates/cancels
payments in billing (`src/billing/billing.client.ts`), resolves the payer's
account-service UUID (`src/account/account.client.ts`), relays the call, and
translates billing's machine-readable error codes into the scene contract.
billing runs the atomic claim and grants the subscription through account-service
— **the bot never writes a payment or subscription**. Success/failure reach the
user as `billing.payment.*` / `billing.subscription.*` events handled by
`src/nats/billing-events.consumer.ts`; there is **no bot-side poller**.

> The legacy Strategy-pattern stack (6 gateway strategies, `PaymentStrategyFactory`,
> the YooMoney/TBank webhook controller, the `USE_BILLING_PAYMENTS` flag, the
> local Mongo `Payment` pointer + `payment.scheduler.ts` poller, and the
> `libs/{cryptomus,tbank,yookassa,yoomoney,wallet}-client` libs) was **removed**.
> Do not reintroduce any of it. The bot has no Mongo and no payment cron.

## Key Files
| File | Description |
|------|-------------|
| `payment.module.ts` | NestJS module — imports `TariffModule`, `BillingModule`, `AccountModule` |
| `payment.service.ts` | Façade — `createPayment` / `cancelUserPendingPayment` / `getUserPendingPayment` → billing (payer UUID via account); `adminCashPaymentByToken` / `adminConfirmPayment` / `createInvoice` → billing admin endpoints; rebuilds billing's `downgrade_not_allowed` into the RU message |
| `payment-provider.map.ts` | Maps `PaymentSystemEnum` → billing provider (`TBANK→tbank`, `CYPTOMUS→heleket`); throws `UNSUPPORTED_PAYMENT_SYSTEM` for anything else |
| `enum/payment-system.enum.ts` | `PaymentSystemEnum`: `TBANK`, `CYPTOMUS`, `CASH` (YooKassa/YooMoney/Wallet retired) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `enum/` | Payment-system enumeration |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for any Telegram notifications inside this module.
- **No gateways here.** A new provider is added in billing-service, then exposed via `payment-provider.map.ts` + `PaymentSystemEnum` + a scene button. Never add a `libs/*-client` gateway or a strategy class.
- **No local state.** The bot stores no payment/subscription record. Do not add a Mongo pointer, a `@Cron` poller, or any "sync billing status" loop — outcomes arrive via `src/nats/billing-events.consumer.ts` (billing emits the event inside its atomic-claim transaction, so it is exactly-once).
- billing is the authority on price, discount, and the **downgrade rule** (returns 409 `downgrade_not_allowed`); `payment.service.ts` rebuilds the friendly RU message from account + catalog data. Never recompute pricing/discounts in the bot.
- `BillingApiError` (`src/billing/billing.client.ts`) exposes billing's `{error:code}` envelope — branch on `.code`, not HTTP status.
- Subscription state is **never** read bot-side — it lives in billing/account; for display, read `account.subscription_end` via `AccountClient`.
- `createPayment` passes the scene's `attemptId` as billing's `Idempotency-Key`; a stale key returns the old payment, so it must rotate on tariff/months change and after a cancel.

### Testing Requirements
```bash
npm run build
npm test
```

### Common Patterns
```typescript
// Resolve the payer (idempotent upsert by Telegram id), then relay to billing.
const account = await this.accountClient.upsertByTelegramId(telegramId, username);
const billingPayment = await this.billingClient.createPayment(
  account.id,
  { tariff_id, payment_provider, payment_months, email, source: 'bot' },
  idempotencyKey, // == payment_flags.attemptId
);
// No local write. The user is notified later by billing-events.consumer.ts.
```

## Dependencies

### Internal
- `BillingModule` (`BillingClient`) — create/cancel/recent + admin cash/invoice/confirm
- `AccountModule` (`AccountClient`) — resolve the payer's account UUID; read tariff + `subscription_end` for the downgrade message
- `TariffModule` — billing-backed tariff catalog (names/prices for display)

### External
| Package | Purpose |
|---------|---------|
| `luxon` | Date arithmetic (downgrade message) |

<!-- MANUAL: -->
