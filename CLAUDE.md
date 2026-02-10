# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Poiskkino API Telegram bot — handles user registration, API token generation, subscription management, and payment processing through multiple gateways. Built with NestJS + Telegraf + MongoDB + Redis.

## Development Commands

```bash
npm run start:dev              # Start with hot reload
npm run build                  # Build for production
npm run start:prod             # Start production build
npm run test                   # Run Jest tests
npm run test -- --testPathPattern=<pattern>  # Run single test file
npm run test:e2e               # Run e2e tests (jest-e2e.json config)
npm run lint                   # ESLint with auto-fix
npm run format                 # Prettier format
```

## Architecture

### Request Flow

Telegram message → **Middleware stack** (rebrandBlocker → session → commandArgs) → **BotUpdate** handler → **Scene** → **Service** → **MongoDB/Redis**

### Key Layers

1. **BotUpdate** (`src/bot.update.ts`) — Central handler. Routes `@Start`, `@Command`, `@Action` (callback buttons), `@Hears` (text buttons), and `@On` (group events) to scenes and services. Admin commands (`/pay`, `/confirm`, `/retry`) check `ctx.chat.id === adminChatId`.

2. **Scenes** (`src/scenes/`) — 17 Telegraf scenes manage conversation flows. All extend `AbstractScene` (`src/abstract/abstract.scene.ts`) which provides `@SceneEnter()` rendering with consistent navigation buttons/text from `SCENES` constants. Scene names defined in `CommandEnum` (`src/enum/command.enum.ts`), UI config in `src/constants/scenes.const.ts`.

3. **Payment Strategies** (`src/payment/strategies/`) — Strategy pattern via `PaymentStrategyFactory`. Each gateway implements `IPaymentStrategy` with `createPayment()` and `validateTransaction()`. Gateways: Cryptomus, TBank, YooKassa, YooMoney, Wallet, Cash. Each has its own NestJS library in `libs/` with path alias `@app/<name>-client`.

4. **SessionStateService** (`src/session/session-state.service.ts`) — Redis-backed payment flow state: `paymentInProgress`, `waitingForEmail`, `tariffId`, `paymentMonths`, plus message ID tracking. Payment flags have 1-hour TTL, message IDs 24-hour TTL.

5. **ModerationService** (`src/moderation/moderation.service.ts`) — Group chat spam detection. Cache-based user verification with 1-hour TTL and 10-minute cooldown. Deletes spam, bans users, notifies admin with unban button.

6. **SafeTelegramHelper** (`src/helpers/safe-telegram.helper.ts`) — Wraps all `bot.telegram.*` calls with retry logic (3 attempts, exponential backoff, 30s timeout). Handles blocked-bot/chat-not-found errors gracefully.

### Middleware Stack (order matters)

1. `rebrandBlocker` — Blocks old bot version, shows migration message to `@poiskkinodev_bot`
2. `session` — Telegraf session management
3. `commandArgs` — Parses `/command args` into `ctx.state.command`

### Message Utilities

- `safeReplyOrEdit` (`src/utils/safe-reply.util.ts`) — Tries to edit existing message (tracked by messageId in session), falls back to new reply. Falls back from HTML to plain text on parse errors.
- `replyOrEdit` (`src/utils/reply-or-edit.util.ts`) — Simpler version, edits if messageId exists.

## Important Conventions

**Scene creation**: Every scene must extend `AbstractScene`, be registered as a provider in `BotModule`, and have its config in `src/constants/scenes.const.ts`. Use `ctx.scene.enter(CommandEnum.SCENE_NAME)` for navigation.

**Adding a payment gateway**:
1. Create library in `libs/` with NestJS module
2. Add path alias in `tsconfig.json` and `nest-cli.json`
3. Implement `IPaymentStrategy` interface
4. Register in `PaymentStrategyFactory`
5. Add to `PaymentSystemEnum`

**Token caching**: When modifying user tokens or tariffs, always clear Redis cache:
```typescript
await this.redis.del(`user:token:${user.token}`);
```

**Telegram calls**: Always use `SafeTelegramHelper` for external Telegram API calls — never call `bot.telegram.*` directly.

**HTML parse mode**: All bot messages use HTML formatting. Scene text in constants uses HTML tags.

**Error handling**: `AllExceptionFilter` catches all exceptions globally and displays error scene (private chats only).

## Database Schemas

- **User** (`src/user/schemas/user.schema.ts`): userId (unique), token (unique), email (unique), tariffId (ref), requestsUsed, inChat, subscription dates
- **Payment** (`src/payment/schemas/payment.schema.ts`): paymentId, orderId, status, paymentSystem, userId, tariffId, amount, monthCount, gateway-specific fields
- **Tariff** (`src/tariff/schemas/tariff.schema.ts`): name (unique), requestsLimit, price, isHidden

## Deployment

Docker multi-stage build (node:20-alpine). Health check on port 3000. Uses tini for signal handling. Runs in Kubernetes.

```bash
docker compose up -d --build    # Local
```
