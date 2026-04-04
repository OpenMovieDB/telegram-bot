<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# telegram-bot

## Purpose
Telegram bot (@poiskkinodev_bot) for the Poiskkino API platform. Handles user registration, API token generation, subscription management, and payment processing through multiple gateways (Cryptomus, TBank, YooKassa, YooMoney, Wallet, Cash). Built with NestJS 11 + Telegraf + MongoDB + Redis, running in Kubernetes.

## Key Files
| File | Description |
|------|-------------|
| `src/main.ts` | Bootstrap: creates BotModule, optionally starts HTTP server (controlled by `ENABLE_HTTP_SERVER` env var) |
| `src/bot.module.ts` | Root NestJS module — wires TelegrafModule, MongooseModule, RedisModule, all feature modules, and all scene providers |
| `src/bot.update.ts` | Central Telegraf update handler — routes `@Start`, `@Command`, `@Action`, `@Hears`, `@On` events to scenes and services |
| `src/bot.service.ts` | Shared bot utilities: group chat join/leave events, payment success notifications to users and admin |
| `src/bot-config.service.ts` | Bot configuration helpers |
| `src/bot.controller.ts` | HTTP controller (webhook endpoints) |
| `example.env` | All required environment variables with descriptions |
| `nest-cli.json` | NestJS CLI config — lists all `libs/` path aliases |
| `tsconfig.json` | TypeScript config — defines `@app/<name>-client` path aliases for libs |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | All application source code (see `src/AGENTS.md`) |
| `libs/` | Independent NestJS payment-gateway client libraries (see `libs/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **Always use `SafeTelegramHelper.safeSend()`** for every Telegram API call — never call `bot.telegram.*` or `ctx.*` directly without it. It retries 3 times with exponential backoff and handles blocked-bot/chat-not-found errors gracefully.
- Read `CLAUDE.md` in this directory before making any changes — it documents the full architecture, middleware stack order, payment gateway addition procedure, and key conventions.
- Bot runs in polling mode by default (`launchOptions: false` in TelegrafModule). HTTP server is optional for webhook support.
- All messages use HTML parse mode (`ctx.replyWithHTML`, `parse_mode: 'HTML'`).
- Admin commands (`/pay`, `/confirm`, `/retry`, `/admin`) are gated by `ctx.chat.id === adminChatId`.

### Testing Requirements
```bash
npm test                                        # run all Jest tests
npm run test -- --testPathPattern=<pattern>     # run single test file
npm run test:e2e                                # e2e tests (test/jest-e2e.json config)
```

### Common Patterns
- Feature modules: `UserModule`, `PaymentModule`, `TariffModule`, `CacheModule`, `SessionModule`, `ModerationModule`
- All scenes registered as providers directly in `BotModule` (not inside feature modules)
- Token caching: always `await this.redis.del(`user:token:${user.token}`)` after changing a user's token or tariff
- Error handling: `AllExceptionFilter` catches all unhandled exceptions globally and shows error scene (private chats only)

## Dependencies

### Internal
- All `src/` feature modules
- `libs/` payment gateway clients

### External
| Package | Purpose |
|---------|---------|
| `nestjs-telegraf` | NestJS integration for Telegraf |
| `telegraf` | Telegram Bot API framework |
| `@nestjs/mongoose` + `mongoose` | MongoDB ODM |
| `@liaoliaots/nestjs-redis` + `ioredis` | Redis client |
| `@nestjs/schedule` | Cron job scheduling (payment polling) |
| `luxon` | Date/time handling for subscription periods |
| `uuid-apikey` | Convert UUID tokens to API key format |

<!-- MANUAL: -->
