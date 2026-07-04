<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-12 -->

# src

## Purpose
All application source code for the Telegram bot — a stateless Telegram façade over account-service (identity/tokens) and billing-service (payments/subscriptions/tariffs). Organized into service clients (account, billing), feature modules (payment, tariff, moderation, session), a scenes layer for conversation flows, helpers, middleware, utilities, and shared constants/enums/interfaces. The bot's own state lives only in Redis (scenes/sessions, moderation cache).

## Key Files
| File | Description |
|------|-------------|
| `main.ts` | Application bootstrap — NestFactory, graceful shutdown, optional HTTP server |
| `bot.module.ts` | Root module — imports all feature modules, registers all 21 scene providers, configures TelegrafModule middleware stack |
| `bot.update.ts` | Central update handler — `@Start`, `@Command` (admin /pay, /confirm), `@Action` (scene routing), `@Hears` (button text), `@On` (group events) |
| `bot.service.ts` | Group chat membership tracking and payment success message sending |
| `bot-config.service.ts` | Configuration helpers for bot settings |
| `bot.controller.ts` | HTTP endpoint — health `GET /` only (Docker HEALTHCHECK) |
| `bot-name.const.ts` | (in `constants/`) Bot name constant used with `@InjectBot` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `abstract/` | `AbstractScene` base class all scenes extend; `TariffPickScene` — catalog-driven `tariff_<id>` selection base for tariff-picker scenes |
| `account/` | `AccountClient` — HTTP client for account-service `/svc/*` (identity, tokens, usage) |
| `billing/` | `BillingClient` — HTTP client for billing-service (payments, subscriptions, tariffs) |
| `constants/` | `SCENES` config, `BUTTONS` map, `BOT_NAME` constant |
| `enum/` | `CommandEnum` (all scene/command names), other enums |
| `filters/` | `AllExceptionFilter` — global exception handler |
| `helpers/` | `SafeTelegramHelper` — all Telegram API calls go through here (see `helpers/AGENTS.md`) |
| `interceptors/` | `ResponseTimeInterceptor` — logs response time for every update |
| `interfaces/` | `Context` interface extending Telegraf context |
| `middlewares/` | `rebrand-blocker.middleware.ts`, `command-args.middleware.ts` |
| `moderation/` | Group chat spam detection and banning (see `moderation/AGENTS.md`) |
| `nats/` | `BillingEventsConsumer` — durable JetStream consumer for `billing.payment.*` / `billing.subscription.*` |
| `payment/` | Stateless payment façade over billing (see `payment/AGENTS.md`) |
| `scenes/` | Telegraf wizard scenes for all conversation flows (see `scenes/AGENTS.md`) |
| `session/` | `SessionStateService` — Redis-backed per-user payment flow state |
| `tariff/` | Billing tariff catalog read-through cache (see `tariff/AGENTS.md`) |
| `utils/` | `safeReplyOrEdit`, `replyOrEdit`, `tariff-display.util` (catalog → UI labels/buttons), `splitArrayIntoPairs` (see `utils/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- The middleware stack order in `BotModule` is fixed: `rebrandBlocker` → `session` → `commandArgs`. Do not change order.
- `bot.update.ts` uses a broad `@Action` regex that excludes known action prefixes (`unban_`, `ignore_`, `clear_cache_`, `tariff_`, etc.) — when adding new action prefixes, update that regex.
- Always use `SafeTelegramHelper.safeSend()` for every Telegram API call — never call `bot.telegram.*` directly.
- Scene entry is always via `ctx.scene.enter(CommandEnum.SCENE_NAME)` — never by string literal.

### Testing Requirements
```bash
npm test                                    # runs all *.spec.ts files
npm run test -- --testPathPattern=bot       # run bot-specific tests
```

### Common Patterns
```typescript
// Correct: all Telegram calls wrapped
await SafeTelegramHelper.safeSend(
  () => ctx.reply('message', { parse_mode: 'HTML' }),
  'description for logging',
);

// Scene navigation
await ctx.scene.enter(CommandEnum.HOME);

// Usage stats — never read counter keys from Redis directly
const usage = await this.accountClient.getUsage(accountId);
```

## Dependencies

### Internal
- `libs/update-client` — kinopoiskdev movie-update client (`@app/update-client`)

### External
- `nestjs-telegraf`, `telegraf`, `@liaoliaots/nestjs-redis`, `luxon`, `nats`

<!-- MANUAL: -->
