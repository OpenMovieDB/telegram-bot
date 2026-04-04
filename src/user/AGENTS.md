<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# user

## Purpose
User data access layer. Manages the User MongoDB collection: creating users via bot registration or admin tools, looking up users by Telegram user ID, token, or username, updating subscription dates and tariff assignments, and tracking chat membership. Also exposes token conversion between UUID and API key formats.

## Key Files
| File | Description |
|------|-------------|
| `user.service.ts` | All User CRUD: `create`, `upsert`, `update`, `findOneByUserId`, `findUserByToken`, `findUserByUsername`, `changeToken`, `getUserToken`, `blockUser`, `createExternalUser`, `findAllUsers`, `updateSubscription`, `getExpiringSubscriptions`, `getUsersWithExpiredSubscription` |
| `user.module.ts` | NestJS module — exports `UserService` |
| `schemas/user.schema.ts` | Mongoose schema: `userId` (sparse unique), `token` (unique), `username` (sparse unique), `email` (sparse unique), `chatId`, `tariffId` (ref), `requestsUsed`, `inChat`, `subscriptionStartDate`, `subscriptionEndDate`, `isExternalUser`, `sendWarnNotification` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `schemas/` | Mongoose User schema and UserDocument type |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for any Telegram API calls in services that depend on `UserService`.
- After modifying a user's `token` or `tariffId`, clear the Redis API cache: `await this.redis.del(`user:token:${user.token}`)`. `UserService` itself does not manage Redis — callers are responsible.
- `token` is stored internally as a raw UUID. The public-facing API key format is generated via `uuid-apikey` (`ApiKey.toAPIKey(uuid)`). When looking up by token input from users, convert with `ApiKey.toUUID(apiKey)` first.
- `findOneByUserId` populates `tariffId` as a full `Tariff` object (`.populate('tariffId').lean()`). Treat `user.tariffId` as `Tariff` when populated.
- `isExternalUser: true` marks users created by admin tools (not via Telegram bot registration) — they may have no `userId` or `chatId`.

### Testing Requirements
```bash
npm test                                       # all tests
npm run test -- --testPathPattern=user         # user-specific tests
```

### Common Patterns
```typescript
// Look up by Telegram user ID (tariffId is populated)
const user = await this.userService.findOneByUserId(ctx.from.id);

// Get formatted API key for display
const apiKey = await this.userService.getUserToken(userId);

// Change token and clear cache in caller
const newToken = await this.userService.changeToken(userId);
await this.redis.del(`user:token:${oldToken}`);

// Create external user (admin-created, no Telegram ID)
const user = await this.userService.createExternalUser(username, tariffId, subscriptionEndDate);
```

## Dependencies

### Internal
- `TariffModule` — `tariffId` ref populated in queries

### External
| Package | Purpose |
|---------|---------|
| `mongoose` / `@nestjs/mongoose` | MongoDB ODM |
| `uuid-apikey` | UUID ↔ API key format conversion |
| `uuid` (`v4`) | New token generation |

<!-- MANUAL: -->
