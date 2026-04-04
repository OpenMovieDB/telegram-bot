<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# libs

## Purpose
Independent NestJS library modules, each encapsulating one external payment gateway or API client. Each library is a self-contained NestJS module imported by `PaymentModule` (or `BotModule` for `update-client`). Libraries are registered in `tsconfig.json` and `nest-cli.json` with `@app/<name>-client` path aliases.

## Key Files
| File | Description |
|------|-------------|
| `cryptomus-client/src/cryptomus-client.service.ts` | `CryptomusClient` — `createPayment(amount, orderId)`, `checkPaymentStatus(paymentId)`. Signs requests with MD5 hash of base64-encoded payload + API key. Env: `CRYPTOMUS_API_KEY`, `CRYPTOMUS_MERCHANT_ID` |
| `cryptomus-client/src/cryptomus-client.module.ts` | NestJS module exporting `CryptomusClient` |
| `tbank-client/src/tbank-client.service.ts` | `TBankClient` — `createPayment(...)`, `createSimplePayment(...)`, `getPaymentInfo(paymentId)`. Signs with SHA256 token. Amounts in kopecks (×100). Env: `TINKOFF_TERMINAL_KEY`, `TINKOFF_PASSWORD` |
| `tbank-client/src/tbank-client.module.ts` | NestJS module exporting `TBankClient` |
| `tbank-client/src/tbank-client.service.spec.ts` | Unit tests for TBankClient |
| `yookassa-client/src/yookassa-client.service.ts` | `YookassaClient` — `createPayment(sum, quantity, orderId, email, comment)`, `getPaymentInfo(paymentId)`. Uses `@a2seven/yoo-checkout`. Env: `YOOKASSA_SECRET`, `YOOKASSA_SHOP_ID`, `BOT_URL` (return URL) |
| `yookassa-client/src/yookassa-client.module.ts` | NestJS module exporting `YookassaClient` |
| `yoomoney-client/src/yoomoney-client.service.ts` | `YooMoneyClient` — `generatePaymentForm(amount, paymentId, comment)` (HTML form), `getOperationDetails(operationId)`, `getOperationHistory()`. Form-based flow confirmed by webhook. Env: `YOOMONEY_API_KEY`, `YOOMONEY_WALLET`, `DOMAIN` |
| `yoomoney-client/src/yoomoney-client.module.ts` | NestJS module exporting `YooMoneyClient` |
| `wallet-client/src/wallet-client.service.ts` | `WalletClient` — `createPayment(price, quantity, orderId, userId, comment)`, `getPaymentInfo(walletPaymentId)`. Uses `wallet-pay` npm package. Env: `WALLET_API_KEY` |
| `wallet-client/src/wallet-client.module.ts` | NestJS module exporting `WalletClient` |
| `update-client/src/update-client.service.ts` | `UpdateClientService` — `update(ids[])` triggers full movie data sync (14 data types), `setImdbRelation(id, imdbId)`. HTTP PUT/PATCH to internal API. Used by admin movie update scenes |
| `update-client/src/update-client.module.ts` | NestJS module exporting `UpdateClientService` |
| `update-client/src/update-client.service.spec.ts` | Unit tests for UpdateClientService |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `cryptomus-client/` | Cryptomus crypto payment gateway client (`@app/cryptomus-client`) |
| `tbank-client/` | TBank (Tinkoff) payment gateway client (`@app/tbank-client`) |
| `yookassa-client/` | YooKassa payment gateway client (`@app/yookassa-client`) |
| `yoomoney-client/` | YooMoney payment gateway client (`@app/yoomoney-client`) |
| `wallet-client/` | Telegram Wallet Pay client (`@app/wallet-client`) |
| `update-client/` | Internal movie data sync API client (`@app/update-client`) |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for any Telegram API calls — though these libraries themselves do not call the Telegram API directly.
- When adding a new payment gateway library: (1) create `libs/<name>-client/src/` with module, service, and `index.ts`, (2) add path alias to `tsconfig.json` `paths` and `nest-cli.json` `projects`, (3) import the module in `src/payment/payment.module.ts`, (4) implement `IPaymentStrategy` in `src/payment/strategies/`.
- Each library's `index.ts` re-exports the module, service, and types for clean imports.
- `TBankClient` amounts are in kopecks (multiply by 100). All other clients use rubles directly.
- `YooMoneyClient.generatePaymentForm()` returns an HTML string (form) — it is stored in `Payment.form` and served to users. Payment confirmation comes via webhook, not polling.
- `update-client` is not a payment gateway — it talks to the internal Kinopoisk data sync API for admin movie management features.

### Testing Requirements
```bash
npm test                                              # all tests including libs/
npm run test -- --testPathPattern=tbank-client        # TBankClient tests
npm run test -- --testPathPattern=update-client       # UpdateClient tests
```

### Common Patterns
```typescript
// Import via path alias (configured in tsconfig.json)
import { CryptomusClientModule, CryptomusClient } from '@app/cryptomus-client';
import { TBankClientModule, TBankClient } from '@app/tbank-client';

// Each library follows the same NestJS module pattern
@Module({
  imports: [HttpModule.register({ baseURL: '...' })],
  providers: [MyGatewayClient],
  exports: [MyGatewayClient],
})
export class MyGatewayClientModule {}
```

## Dependencies

### Internal
None — libraries have no dependencies on `src/` code.

### External
| Library | External Package |
|---------|-----------------|
| `cryptomus-client` | `@nestjs/axios` (HTTP) |
| `tbank-client` | `@nestjs/axios` (HTTP) |
| `yookassa-client` | `@a2seven/yoo-checkout` |
| `yoomoney-client` | `yoomoney-sdk` |
| `wallet-client` | `wallet-pay` |
| `update-client` | `@nestjs/axios` (HTTP) |

<!-- MANUAL: -->
