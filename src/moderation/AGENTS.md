<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# moderation

## Purpose
Group chat spam detection with **admin-in-the-loop** moderation. When a message arrives in the configured group chat (`CHAT_ID`), checks if the sender is a registered user. An unregistered sender is NOT banned and the message is NOT deleted automatically: the admin gets a review request with «заблокировать и удалить» / «не блокировать» buttons. Ban + deletion of every message collected during the review happen only on the admin's ban press; «не блокировать» keeps the message and allowlists the user for 30 days. Uses Redis caching to avoid repeated database lookups and a cooldown to prevent check spam.

## Key Files
| File | Description |
|------|-------------|
| `moderation.service.ts` | Core moderation logic: `checkAndModerateUser`, `banUser`, `approveUser`, `unbanUser`, `clearUserCache`. Cache keys: `spam:user:{userId}` (1h TTL, 30d after an admin approve), `spam:checked:{userId}` (10min cooldown), `spam:pending:{userId}` (list of message ids awaiting the admin decision, 24h TTL, max 50) |
| `moderation.module.ts` | NestJS module — imports AccountModule, exports ModerationService |
| `keyboards/moderation.keyboards.ts` | Inline keyboard builders: `createReviewKeyboard(userId, messageId)` (ban+delete / keep buttons on the review request), `createUnbanKeyboard(userId, username)` (unban + ignore, shown after a ban), `createUnbanConfirmationKeyboard(userId)` (after unban is processed) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `keyboards/` | Inline keyboard factory functions for moderation action buttons |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for every Telegram API call — message deletion, banning, admin notifications, and message edits all go through it.
- `checkAndModerateUser` is called from `BotUpdate` for both `@On('text')` and `@On('message')` events targeting `CHAT_ID`. The text handler covers text messages; the message handler covers all other types (stickers, photos, documents, etc.) — avoid duplicating logic.
- Cache check order: (1) pending review — just collect the message id and return, (2) cooldown check — skip if checked recently, (3) Redis cache hit — allow or request review, (4) account-service lookup (`AccountClient.getByTelegramId`, read-only) — cache result, then allow or request review.
- Nothing is deleted or banned without an admin press. `banUser(userId, messageId)` deletes the message from the button plus every id collected in `spam:pending:{userId}`; `approveUser(userId)` allowlists the user for 30 days and clears the pending/cooldown keys.
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
await this.moderationService.banUser(userId, messageId);   // modban_<userId>_<messageId>
await this.moderationService.approveUser(userId);          // modkeep_<userId>
await this.moderationService.unbanUser(userId, username);
await this.moderationService.clearUserCache(userId);

// Redis cache keys (read-only reference)
// spam:user:{userId}    — 'exists' | 'not_exists', TTL 3600s (30d on admin approve)
// spam:checked:{userId} — timestamp, TTL 600s (cooldown)
// spam:pending:{userId} — list of message ids awaiting the admin decision, TTL 86400s
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
