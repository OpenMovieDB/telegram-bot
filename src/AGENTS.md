<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# src

## Purpose
All application source code for the Telegram bot. Organized into feature modules (payment, user, tariff, moderation, session, cache), a scenes layer for conversation flows, helpers, middleware, utilities, and shared constants/enums/interfaces.

## Key Files
| File | Description |
|------|-------------|
| `main.ts` | Application bootstrap — NestFactory, graceful shutdown, optional HTTP server |
| `bot.module.ts` | Root module — imports all feature modules, registers all 26 scene providers, configures TelegrafModule middleware stack |
| `bot.update.ts` | Central update handler — `@Start`, `@Command` (admin/pay/confirm/retry), `@Action` (scene routing), `@Hears` (button text), `@On` (group events) |
| `bot.service.ts` | Group chat membership tracking and payment success message sending |
| `bot-config.service.ts` | Configuration helpers for bot settings |
| `bot.controller.ts` | HTTP endpoints (webhook support) |
| `bot-name.const.ts` | (in `constants/`) Bot name constant used with `@InjectBot` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `abstract/` | `AbstractScene` base class all scenes extend |
| `cache/` | `CacheModule` and `CacheResetService` for user API limit cache management |
| `constants/` | `SCENES` config, `BUTTONS` map, `BOT_NAME` constant |
| `enum/` | `CommandEnum` (all scene/command names), other enums |
| `filters/` | `AllExceptionFilter` — global exception handler |
| `helpers/` | `SafeTelegramHelper` — all Telegram API calls go through here (see `helpers/AGENTS.md`) |
| `interceptors/` | `ResponseTimeInterceptor` — logs response time for every update |
| `interfaces/` | `Context` interface extending Telegraf context |
| `middleware/` | Additional middleware utilities |
| `middlewares/` | `rebrand-blocker.middleware.ts`, `command-args.middleware.ts` |
| `moderation/` | Group chat spam detection and banning (see `moderation/AGENTS.md`) |
| `payment/` | Payment creation, validation, scheduling, strategies (see `payment/AGENTS.md`) |
| `scenes/` | 26 Telegraf wizard scenes for all conversation flows (see `scenes/AGENTS.md`) |
| `session/` | `SessionStateService` — Redis-backed per-user payment flow state |
| `tariff/` | Tariff CRUD (see `tariff/AGENTS.md`) |
| `user/` | User CRUD and token management (see `user/AGENTS.md`) |
| `utils/` | `safeReplyOrEdit`, `replyOrEdit` — message edit-or-send utilities |

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

// Clear Redis token cache after user update
await this.redis.del(`user:token:${user.token}`);
```

## Dependencies

### Internal
- `libs/` — payment gateway clients via `@app/<name>-client` path aliases

### External
- `nestjs-telegraf`, `telegraf`, `@nestjs/mongoose`, `@liaoliaots/nestjs-redis`, `luxon`

<!-- MANUAL: -->
