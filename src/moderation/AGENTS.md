<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# moderation

## Purpose
Group chat spam detection and automated moderation. When a message arrives in the configured group chat (`CHAT_ID`), checks if the sender is a registered user. Unregistered users have their message deleted, are banned from the chat, and the admin receives a notification with unban/ignore buttons. Uses Redis caching to avoid repeated database lookups and a cooldown to prevent check spam.

## Key Files
| File | Description |
|------|-------------|
| `moderation.service.ts` | Core moderation logic: `checkAndModerateUser`, `unbanUser`, `clearUserCache`. Cache keys: `spam:user:{userId}` (1h TTL), `spam:checked:{userId}` (10min cooldown) |
| `moderation.module.ts` | NestJS module — imports AccountModule, exports ModerationService |
| `keyboards/moderation.keyboards.ts` | Inline keyboard builders: `createUnbanKeyboard(userId, username)` (unban + ignore buttons), `createUnbanConfirmationKeyboard(userId)` (after unban is processed) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `keyboards/` | Inline keyboard factory functions for moderation action buttons |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for every Telegram API call — message deletion, banning, admin notifications, and message edits all go through it.
- `checkAndModerateUser` is called from `BotUpdate` for both `@On('text')` and `@On('message')` events targeting `CHAT_ID`. The text handler covers text messages; the message handler covers all other types (stickers, photos, documents, etc.) — avoid duplicating logic.
- Cache check order: (1) cooldown check — skip if checked recently, (2) Redis cache hit — allow or moderate immediately, (3) account-service lookup (`AccountClient.getByTelegramId`, read-only) — cache result, then allow or moderate.
- account-service errors during user lookup result in **no moderation action** (fail open) — this is intentional to avoid false bans if account-service is temporarily unreachable. The bot has no Mongo.
- `unbanUser` unlifts the Telegram ban, registers the user in account-service via `upsertByTelegramId` + `updateTelegramProfile({ inChat: true })`, updates the Redis cache, and clears the cooldown key.

### Testing Requirements
```bash
npm test                                            # all tests
npm run test -- --testPathPattern=moderation        # moderation-specific tests
```

### Common Patterns
```typescript
// Called from BotUpdate on group messages
await this.moderationService.checkAndModerateUser(ctx);

// Admin action handlers in BotUpdate call these
await this.moderationService.unbanUser(userId, username);
await this.moderationService.clearUserCache(userId);

// Redis cache keys (read-only reference)
// spam:user:{userId}    — 'exists' | 'not_exists', TTL 3600s
// spam:checked:{userId} — timestamp, TTL 600s (cooldown)
```

## Dependencies

### Internal
- `AccountClient` — read-only resolve by telegram_id (`getByTelegramId`, never creates accounts); unban registers via `upsertByTelegramId` + `updateTelegramProfile(in_chat)`

### External
| Package | Purpose |
|---------|---------|
| `nestjs-telegraf` | `@InjectBot` for direct `bot.telegram.*` calls (via SafeTelegramHelper) |
| `@liaoliaots/nestjs-redis` | Redis cache for user verification results |

<!-- MANUAL: -->
