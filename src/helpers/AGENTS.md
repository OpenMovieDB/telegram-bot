<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# helpers

## Purpose
Shared utility helpers for the bot. Currently contains `SafeTelegramHelper`, the single required wrapper for all outbound Telegram API calls. This is a critical safety layer — bypassing it risks unhandled errors crashing request handlers.

## Key Files
| File | Description |
|------|-------------|
| `safe-telegram.helper.ts` | Static helper class: `safeSend(fn, description?, retryCount?, retryDelay?)` — wraps any Telegram API call with 3-retry exponential backoff, 30s timeout, and graceful handling of blocked-bot/chat-not-found/message-not-modified errors |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- `SafeTelegramHelper.safeSend()` is **mandatory** for every Telegram API call in the entire codebase — this is a hard rule documented in `CLAUDE.md`. Never call `bot.telegram.*`, `ctx.reply()`, `ctx.editMessageText()`, or any other Telegram method without wrapping it in `safeSend`.
- `safeSend` returns `undefined` on unrecoverable errors rather than throwing — callers must not assume a non-undefined return value without checking.
- Retry behavior: up to 3 attempts with exponential backoff (2s, 4s, 6s delays). Only retries on recoverable errors: `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `ETELEGRAM`.
- Non-retried errors that are silenced: `bot was blocked`, `chat not found` (logged as warn), `message is not modified` (logged as debug).
- All other errors are logged at error level after all retries are exhausted.

### Testing Requirements
```bash
npm test                                           # all tests
npm run test -- --testPathPattern=safe-telegram    # helper-specific tests
```

### Common Patterns
```typescript
import { SafeTelegramHelper } from './helpers/safe-telegram.helper';

// Basic usage — always await
await SafeTelegramHelper.safeSend(
  () => ctx.reply('Message text', { parse_mode: 'HTML' }),
  'Context description for logs',
);

// With bot.telegram (e.g., from BotUpdate or services with @InjectBot)
await SafeTelegramHelper.safeSend(
  () => this.bot.telegram.sendMessage(chatId, text),
  `Sending notification to ${chatId}`,
);

// Capture return value when needed (e.g., sent message ID)
const sentMsg = await SafeTelegramHelper.safeSend(
  () => ctx.reply('text'),
  'send confirmation message',
);
if (sentMsg) {
  await this.sessionStateService.setMessageId(userId, sentMsg.message_id);
}
```

## Dependencies

### Internal
None — this is a pure static utility with no NestJS injected dependencies.

### External
| Package | Purpose |
|---------|---------|
| `@nestjs/common` | `Logger` for structured logging |

<!-- MANUAL: -->
