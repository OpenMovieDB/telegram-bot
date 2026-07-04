<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-12 -->

# telegram-bot

## Purpose
Telegram bot (@poiskkinodev_bot) for the Poiskkino API platform — a **stateless façade** over account-service (identity, API tokens, usage) and billing-service (payments, subscriptions, tariff catalog). The bot owns no domain data: Redis holds only scene/session state and the moderation spam-cache; payment/subscription outcomes arrive as NATS JetStream events from billing. Built with NestJS + Telegraf, running in Kubernetes with `Recreate` deployment strategy (one bot pod active per replica to prevent concurrent polling).

> ⛔ This working tree is the **unmerged v2 migration** — prod runs the old Mongo-based bot from `HEAD`. Do not commit/push (see `../docs/services-refactoring/AGENT-GUARDRAILS.md`).

## Key Files
| File | Description |
|------|-------------|
| `src/main.ts` | Bootstrap: creates BotModule, optionally starts HTTP server (controlled by `ENABLE_HTTP_SERVER` env var) |
| `src/bot.module.ts` | Root NestJS module — wires TelegrafModule, RedisModule, feature modules, and all scene providers |
| `src/bot.update.ts` | Central Telegraf update handler — routes `@Start`, `@Command`, `@Action`, `@Hears`, `@On` events to scenes and services |
| `src/bot.service.ts` | Group chat join/leave events and chat-membership cron check |
| `src/bot-config.service.ts` | Bot configuration helpers |
| `src/bot.controller.ts` | HTTP controller — health `GET /` only |
| `.env` | Local dev environment (account :8091, billing :8092, NATS, Redis) |
| `nest-cli.json` / `tsconfig.json` | `@app/update-client` path alias for `libs/` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | All application source code (see `src/AGENTS.md`) |
| `libs/` | `update-client` — kinopoiskdev movie-update client (payment-gateway libs are gone; billing owns providers) |

## For AI Agents

### Working In This Directory
- **Always use `SafeTelegramHelper.safeSend()`** for every Telegram API call — never call `bot.telegram.*` or `ctx.*` directly without it. It retries 3 times with exponential backoff and handles blocked-bot/chat-not-found errors gracefully.
- Read `CLAUDE.md` in this directory before making any changes — it documents the architecture, ownership boundaries (account vs billing vs bot Redis), and key conventions.
- Bot runs in polling mode by default (`launchOptions: false` in TelegrafModule). HTTP server is optional (healthcheck).
- All messages use HTML parse mode (`ctx.replyWithHTML`, `parse_mode: 'HTML'`).
- Admin commands (`/pay`, `/confirm`, `/admin`) are gated by `ctx.chat.id === adminChatId`.

### Testing Requirements
```bash
npm test                                        # run all Jest tests
npm run test -- --testPathPattern=<pattern>     # run single test file
```

### Common Patterns
- Feature modules: `PaymentModule`, `TariffModule`, `SessionModule`, `ModerationModule`, `AccountModule`, `BillingModule`, `NatsModule`
- All scenes registered as providers directly in `BotModule` (not inside feature modules)
- Rate-limit counters are account-internal: usage comes from `GET /svc/accounts/:id/usage` (`AccountClient.getUsage`), rotation carry-over happens inside account — the bot never touches counter keys in Redis
- Tariff UI is catalog-driven: buttons/labels built from billing `/v1/tariffs` via `src/utils/tariff-display.util.ts`, selection handled by `TariffPickScene` — never map tariff codes to hardcoded enums/scenes
- Error handling: `AllExceptionFilter` logs every exception and answers in private chats (incl. callback queries)

## Dependencies

### Internal
- All `src/` feature modules
- `libs/update-client` — kinopoiskdev movie-update client

### External
| Package | Purpose |
|---------|---------|
| `nestjs-telegraf` | NestJS integration for Telegraf |
| `telegraf` | Telegram Bot API framework |
| `@liaoliaots/nestjs-redis` + `ioredis` | Redis client (sessions, payment flags, moderation cache) |
| `nats` | JetStream consumer for billing events |
| `@nestjs/schedule` | Cron job scheduling (chat-membership check) |
| `luxon` | Date/time handling for subscription periods |

<!-- MANUAL: -->
