<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# payment

## Purpose
Handles the full payment lifecycle: creating payments through any supported gateway, polling pending payments on a schedule, validating and finalizing transactions, updating user subscriptions on success, and receiving webhook callbacks (YooMoney, TBank). Implements the Strategy pattern so all gateways share a common interface.

## Key Files
| File | Description |
|------|-------------|
| `payment.module.ts` | NestJS module — imports all gateway client modules, UserModule, TariffModule, CacheModule, SessionModule |
| `payment.service.ts` | Core service — `createPayment`, `validatePayment`, `cancelUserPendingPayment`, `yooMoneyWebHook`, discount calculation for tariff upgrades |
| `payment.scheduler.ts` | `@Cron` job — polls pending bot payments every N seconds, expires payments older than 24h |
| `payment.controller.ts` | HTTP endpoints — YooMoney webhook (`POST /payment/yoomoney`), TBank webhook |
| `schemas/payment.schema.ts` | Mongoose schema: `paymentId`, `orderId`, `status`, `paymentSystem`, `userId`, `chatId`, `tariffId`, `amount`, `monthCount`, `isFinal`, `discount`, `originalPrice`, gateway-specific fields |
| `strategies/payment-strategy.interface.ts` | `IPaymentStrategy` interface: `createPayment(params)` and `validateTransaction(paymentId)` |
| `strategies/factory/payment-strategy.factory.ts` | Factory that resolves the correct strategy by `PaymentSystemEnum` |
| `strategies/criptomus-payment.strategy.ts` | Cryptomus strategy |
| `strategies/tinkoff-payment.strategy.ts` | TBank/Tinkoff strategy |
| `strategies/yookassa-payment.strategy.ts` | YooKassa strategy |
| `strategies/yoomoney-payment.strategy.ts` | YooMoney strategy (form-based, webhook-confirmed) |
| `strategies/wallet-payment.strategy.ts` | Telegram Wallet Pay strategy |
| `strategies/cash-payment.strategy.ts` | Manual cash payment (admin `/pay` command) |
| `enum/payment-status.enum.ts` | `PaymentStatusEnum`: PENDING, PAID, FAILED, CANCELED |
| `enum/payment-system.enum.ts` | `PaymentSystemEnum`: CRYPTOMUS, TBANK, YOOKASSA, YOOMONEY, WALLET, CASH |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `schemas/` | Mongoose schema and document type for Payment |
| `strategies/` | One strategy file per payment gateway plus the factory |
| `enum/` | Payment status and payment system enumerations |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for any Telegram notifications inside this module.
- Adding a new gateway: (1) create library in `libs/`, (2) add path alias in `tsconfig.json` and `nest-cli.json`, (3) implement `IPaymentStrategy`, (4) register in `PaymentStrategyFactory`, (5) add to `PaymentSystemEnum`, (6) import the client module in `payment.module.ts`.
- `isFinal: true` means a payment will not be re-polled. Only set it when status is PAID, FAILED, or CANCELED.
- After `validatePayment` confirms PAID: clears Redis token cache, updates subscription dates, resets `requestsUsed` (on tariff change), calls `CacheResetService`, sets `shouldExitPaymentScene` flag via `SessionStateService`.
- Downgrade prevention: `createPayment` blocks tariff downgrades while a subscription is active (except on the expiration day). Upgrades apply a pro-rated discount based on days remaining.
- Pending payments older than 24 hours are auto-expired by the scheduler.

### Testing Requirements
```bash
npm test                                              # all tests
npm run test -- --testPathPattern=payment             # payment-specific tests
```

### Common Patterns
```typescript
// Check for existing pending payment before creating a new one
const existing = await this.getUserPendingPayment(userId);
if (existing) throw new Error('PENDING_PAYMENT_EXISTS');

// Validate via strategy
const strategy = this.paymentStrategyFactory.createPaymentStrategy(payment.paymentSystem);
const status = await strategy.validateTransaction(payment.paymentId);

// Clear token cache after subscription update
await this.redis.del(ApiKey.toAPIKey(user.token));
```

## Dependencies

### Internal
- `UserModule` — fetch and update user subscription data
- `TariffModule` — fetch tariff price and requestsLimit
- `CacheModule` (`CacheResetService`) — reset API rate-limit counters
- `SessionModule` (`SessionStateService`) — signal payment scene to exit on success

### External
| Package | Path Alias |
|---------|------------|
| `@app/cryptomus-client` | Cryptomus API |
| `@app/tbank-client` | TBank (Tinkoff) API |
| `@app/yookassa-client` | YooKassa API |
| `@app/yoomoney-client` | YooMoney SDK |
| `@app/wallet-client` | Telegram Wallet Pay |
| `luxon` | Subscription date arithmetic |

<!-- MANUAL: -->
