<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-12 -->

# scenes

## Purpose
Contains all 21 Telegraf scenes that manage multi-step conversation flows in the bot. Scenes cover the full user journey: onboarding, catalog-driven tariff selection, payment initiation, token management, admin operations, and content management tools. Per-tariff scenes are gone — tariff selection is generic (`TariffPickScene` + billing catalog), the free flow is one universal token-issue scene (`issue-token.scene.ts`).

## Key Files
| File | Description |
|------|-------------|
| `start.scene.ts` | `/start` — auto-registration via account upsert + immediate token issuance (no wizard steps) |
| `home.scene.ts` | Main menu for registered users |
| `get-access.scene.ts` | Tariff selection entry point — renders the full billing catalog (extends `TariffPickScene`) |
| `update-tariff.scene.ts` | Tariff change — paid catalog tariffs only (extends `TariffPickScene`); billing rejects downgrades (`downgrade_not_allowed`) |
| `issue-token.scene.ts` | Any free tariff: issue/show the API token |
| `select-months.scene.ts` | Period selection — buttons built from `tariff.prices[]` (billing sells exact rows only) |
| `payment.scene.ts` | Email + provider selection → `PaymentService.createPayment` with `Idempotency-Key` (`payment_flags.attemptId`); cancel rotates the attemptId |
| `get-my-token.scene.ts` | Display current API token |
| `change-token.scene.ts` | Rotate API token via account (`rotateToken`) — daily-limit carry-over happens inside account |
| `get-request-stats.scene.ts` | Show today's usage via `AccountClient.getUsage` |
| `i-have-token.scene.ts` | Token binding for existing token holders |
| `expiring-subscriptions.scene.ts` | Admin: list subscriptions expiring within 7 days (billing `/svc/subscriptions/expiring`) |
| `question.scene.ts` | Contact/support |
| `update-movie.scene.ts` | Admin: trigger movie data sync via `UpdateClientService` |
| `set-imdb-relation.scene.ts` | Admin: link Kinopoisk movie to IMDB ID |
| `admin-menu.scene.ts` | Admin main menu |
| `create-user.scene.ts` | Admin: create user with tariff + subscription dates (admin catalog, hidden 🔒 included) |
| `create-invoice.scene.ts` | Admin: create invoice for manual payment |
| `list-users.scene.ts` | Admin: paginated user list |
| `user-details.scene.ts` | Admin: view/manage specific user |
| `update-user-subscription.scene.ts` | Admin: update tariff/subscription dates (admin catalog, hidden 🔒 included) |

## Subdirectories
None — all scene files are in this directory.

## For AI Agents

### Working In This Directory
- Every scene **must** extend `AbstractScene` from `src/abstract/abstract.scene.ts`. `AbstractScene` provides `@SceneEnter()` which renders the scene's text and buttons from the `SCENES` config in `src/constants/scenes.const.ts`.
- Tariff-picker scenes extend `TariffPickScene` (`src/abstract/tariff-pick.scene.ts`) instead — it handles `@Action(/^tariff_(.+)$/)`: validates the id against the live catalog, routes free (`isFreeTariff`) → `ISSUE_TOKEN`, paid → `SELECT_MONTHS`. Decorators on the abstract base are inherited by subclasses through the prototype chain.
- Tariff buttons/labels come from `src/utils/tariff-display.util.ts` (billing catalog `display_name`/`id`) — never hardcode tariff codes into `CommandEnum` or per-tariff scenes.
- Every scene must be registered as a provider in `BotModule` (`src/bot.module.ts`). Adding a scene file without registering it there will cause it to never be instantiated.
- Scene names are defined in `CommandEnum` (`src/enum/command.enum.ts`). Use enum values, not string literals.
- Scene UI (text, navigation buttons, inline buttons) is configured in `src/constants/scenes.const.ts` — keep logic out of the constants file.
- New scene-local `@Action` prefixes must be excluded from the broad `onAnswer` regex in `bot.update.ts`, or the global handler will swallow the callback.
- Always use `SafeTelegramHelper.safeSend()` for any Telegram API calls within scenes.
- For message editing (avoiding message spam), use `safeReplyOrEdit` from `src/utils/safe-reply.util.ts` — it edits the tracked message ID or falls back to a new reply.

### Testing Requirements
```bash
npm test                                          # all tests
npm run test -- --testPathPattern=scenes          # scene-specific tests
```

### Common Patterns
```typescript
// All scenes extend AbstractScene
import { AbstractScene } from '../abstract/abstract.scene';
import { Scene } from 'nestjs-telegraf';
import { CommandEnum } from '../enum/command.enum';

@Scene(CommandEnum.MY_SCENE)
export class MyScene extends AbstractScene {
  // AbstractScene.onSceneEnter() handles @SceneEnter() rendering automatically
  // Add @On, @Action, @Hears handlers here for scene-specific interactions
}

// Tariff pickers: extend TariffPickScene and only override what differs
@Scene(CommandEnum.GET_ACCESS)
export class GetAccessScene extends TariffPickScene { ... }

// Navigate to another scene
await ctx.scene.enter(CommandEnum.HOME);

// Edit existing message instead of sending new one
const messageId = await this.sessionStateService.getMessageId(ctx.from.id);
await safeReplyOrEdit(ctx, messageId, text, extra);
```

## Dependencies

### Internal
- `AbstractScene` / `TariffPickScene` (`src/abstract/`) — base classes
- `SCENES` (`src/constants/scenes.const.ts`) — scene UI configuration
- `CommandEnum` (`src/enum/command.enum.ts`) — scene name constants
- `AccountClient`, `BillingClient`, `PaymentService`, `TariffService` — data access (identity/tokens/usage → account, money/subscriptions/catalog → billing)
- `SessionStateService` — payment flow state (tariffId/months/attemptId in Redis)
- `tariff-display.util` — catalog → UI labels/buttons
- `SafeTelegramHelper` — all Telegram API calls

### External
- `nestjs-telegraf` — `@Scene`, `@SceneEnter`, `@Action`, `@On`, `@Hears`, `@Ctx`
- `telegraf` — `Markup` for keyboard building

<!-- MANUAL: -->
