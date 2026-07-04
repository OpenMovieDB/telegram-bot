# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PoiskKino API Telegram bot (@poiskkinodev_bot) — a **stateless Telegram façade** over three Go services (v3 split): **auth-service** (identity: users, telegram linkage, telegram-auth confirm — the identity source-of-truth), **account-service** (entitlement: API tokens, usage, tariff/subscription read-model), and **billing-service** (payments, subscriptions, tariff catalog). The bot owns NO domain data: its only storage is Redis for scene/session state and the moderation spam-cache. Built with NestJS 11 + Telegraf.

> ⛔ This working tree is part of the **unmerged v2 migration** — account/billing are NOT deployed; prod runs the old Mongo-based bot from `HEAD`. Do not commit/push. See `../docs/services-refactoring/AGENT-GUARDRAILS.md`.

## Development Commands

```bash
npm run start:dev              # Start with hot reload
npm run build                  # Build for production
npm test                       # Run Jest tests
npm run test -- --testPathPattern=<pattern>  # Single test file
npm run lint                   # ESLint with auto-fix
npm run format                 # Prettier format
```

Local stack (account :8091, billing :8092, NATS, Redis): `docker compose -f docker-compose.local.yml -f docker-compose.smoke.yml up -d` from the workspace root; bot env in `.env`.

## Architecture

### Request flow

Telegram message → **Middleware stack** (rebrandBlocker → session → commandArgs) → **BotUpdate** handler → **Scene** → **AccountClient / BillingClient (HTTP)**. `AccountClient` is a **composition facade**: it calls **auth-service** for identity and **account-service** for entitlement via the low-level `AuthClient` (`src/auth/auth.client.ts`) it injects, then composes the stable `AccountResponseDto`. Scenes/services inject only `AccountClient`.

Payment/subscription outcomes flow the other way: billing's transactional outbox → JetStream `billing.>` → **BillingEventsConsumer** (durable `telegram-bot-events`) → Telegram message. There is no bot-side payment poller and no local payment state.

### Ownership (one owner per entity)

- **auth-service** (`src/auth/auth.client.ts`, `/svc/*` + `X-Service-Token`, service-token label `bot`): identity source-of-truth — users (create telegram-only / username-only "external"), telegram linkage (`in_chat`, `telegram_username`, `link-telegram`), telegram-auth confirm (`POST /svc/telegram/confirm`), user lookup (by id / telegram / username / list). The bot's `account id` (`ctx.session.accountId`, `AccountResponseDto.id`) is the **auth `user_id` (uuid)**. `AuthClient` is low-level — only `AccountClient` injects it.
- **account-service** (`src/account/account.client.ts`, `/svc/*` + `X-Service-Token`, label `bot`): entitlement read-model — API tokens (issue/rotate — rotation carries the remaining daily limit inside account; `GET /svc/accounts/:id` lazy-provisions the account+token), usage stats (`GET /svc/accounts/:id/usage`), token→owner resolve (`GET /svc/accounts/by-token`). The bot never reads rate-limit counter keys from Redis. `AccountClient` is the composition facade over auth + account (see Request flow).
- **billing-service** (`src/billing/billing.client.ts`, internal token; user calls add `X-User-ID`): payments (create with `Idempotency-Key`, cancel, recent), admin cash/invoice/confirm, subscription grant/expiring, tariff catalog.
- **bot Redis**: Telegraf sessions, `payment_flags:<tg_id>` (tariffId/months/attemptId, 1h TTL — `SessionStateService`), moderation spam-cache.

### Key pieces

1. **BotUpdate** (`src/bot.update.ts`) — central handler: `/start` (+ dashboard-auth deep links via account RPC), admin `/pay` `/confirm` (gated on `ctx.chat.id === ADMIN_CHAT_ID`), `@Action`/`@Hears` routing, group moderation events.
2. **Scenes** (`src/scenes/`) — Telegraf scenes extend `AbstractScene`; tariff-selection scenes extend `TariffPickScene` (`src/abstract/tariff-pick.scene.ts`), which handles catalog-driven `tariff_<id>` buttons. The screens are universal: ANY free tariff (`isFreeTariff` = `is_default`/no price rows) → ISSUE_TOKEN, ANY paid one → SELECT_MONTHS → PAYMENT — no per-tariff binding.
3. **Tariff catalog** (`src/tariff/tariff.service.ts`) — read-through cache (5 min TTL + instant invalidation on the `billing.tariff.catalog.updated` NATS event) over billing `/v1/tariffs`. The bot renders the catalog as-is: admin's `sort_order` (no bot-side re-sort), `display_name`, `description`, ⭐ for `is_popular` (`src/utils/tariff-display.util.ts`). Periods/prices come ONLY from `tariff.prices[]` (billing sells exact rows — no `monthly × N` formula). Admin flows (`/pay`, create-user, update-user-subscription) use `GET /v1/admin/tariffs` (hidden 🔒 included, archived never). A new tariff in billing must show up with zero bot changes.
4. **PaymentService** (`src/payment/payment.service.ts`) — stateless façade: resolves the payer's account UUID, relays to billing, translates billing error codes (`payment_pending`, `downgrade_not_allowed`) into the scene contract.
5. **BillingEventsConsumer** (`src/nats/billing-events.consumer.ts`) — durable JetStream consumer for `billing.payment.{paid,failed}` + `billing.subscription.{expiring,expired}`; resolves account UUID → telegram_id and notifies. Disabled (with a warning) when `NATS_URL` is unset.
6. **SafeTelegramHelper** (`src/helpers/safe-telegram.helper.ts`) — wraps Telegram API calls (retry + timeout). Never call `bot.telegram.*` directly.
7. **ModerationService** (`src/moderation/`) — group spam gate; resolves users via account **read-only** (`getByTelegramId`, never upserts); unban registers via upsert.

## Important Conventions

- **Scene creation**: extend `AbstractScene` (or `TariffPickScene` for catalog pickers), register as provider in `BotModule`, config in `src/constants/scenes.const.ts`, name in `CommandEnum`.
- **Idempotency**: `payment_flags.attemptId` is the billing `Idempotency-Key`. It rotates on tariff/months change and after a cancel — a stale key would return the old payment.
- **User-facing tariff names** come from `display_name` (catalog), `code` is for logs/lookup only.
- **HTML parse mode** everywhere; scene copy lives in `scenes.const.ts`.
- **Errors**: `AllExceptionFilter` logs every exception and answers in private chats (incl. callback queries).
- The broad `@Action` regex in `bot.update.ts` excludes scene-local action prefixes (`tariff_`, `months_`, `user_`, …) — add new prefixes there when introducing scene actions.

## Deployment

Docker multi-stage build (node:20-alpine), Helm chart `charts/kp-bot` (env from the `kp-bot` k8s secret). Required env: `BOT_TOKEN`, `REDIS_URL`, `CHAT_ID`, `ADMIN_CHAT_ID`, `AUTH_SERVICE_URL/TOKEN`, `ACCOUNT_SERVICE_URL/TOKEN`, `BILLING_SERVICE_URL/TOKEN`, `NATS_URL`, `UPDATE_API_BASE_URL`; optional `ENABLE_HTTP_SERVER` (health endpoint :3000), `TELEGRAM_API_ROOT`, `SKIP_REBRAND_BLOCKER`, `DISABLE_SCHEDULERS`. `MONGO_URI` is gone — the bot has no Mongo. The two `*_TOKEN` values are the bot's service token at auth/account (label `bot`); add `AUTH_SERVICE_URL`/`AUTH_SERVICE_TOKEN` to the `kp-bot` secret before cutover.
