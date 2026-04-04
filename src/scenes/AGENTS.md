<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# scenes

## Purpose
Contains all 26 Telegraf wizard scenes that manage multi-step conversation flows in the bot. Scenes cover the full user journey: onboarding, tariff selection, payment initiation, token management, admin operations, and content management tools.

## Key Files
| File | Description |
|------|-------------|
| `start.scene.ts` | Entry scene for new users — onboarding flow |
| `home.scene.ts` | Main menu scene for registered users |
| `get-access.scene.ts` | Tariff selection entry point |
| `free-tariff.scene.ts` | Free tariff information and registration |
| `demo-tariff.scene.ts` | Demo tariff scene |
| `basic-tariff.scene.ts` | Basic tariff scene |
| `developer-tariff.scene.ts` | Developer tariff scene |
| `student-tariff.scene.ts` | Student tariff scene |
| `unlimited-tariff.scene.ts` | Unlimited tariff scene |
| `nolimit-tariff.scene.ts` | No-limit tariff scene |
| `select-months.scene.ts` | Month count selection before payment |
| `payment.scene.ts` | Payment gateway selection and payment link display; polls `SessionStateService` for completion |
| `get-my-token.scene.ts` | Shows user their current API token |
| `change-token.scene.ts` | Generates a new API token for the user |
| `get-request-stats.scene.ts` | Shows user their request usage stats |
| `update-tariff.scene.ts` | Tariff upgrade/change flow |
| `i-have-token.scene.ts` | Token binding for users who already have a token |
| `question.scene.ts` | Contact/support scene |
| `update-movie.scene.ts` | Admin tool: trigger movie data sync |
| `set-imdb-relation.scene.ts` | Admin tool: link Kinopoisk movie to IMDB ID |
| `admin-menu.scene.ts` | Admin main menu with keyboard buttons |
| `create-user.scene.ts` | Admin: create a new user manually |
| `create-invoice.scene.ts` | Admin: create a TBank invoice for a user |
| `list-users.scene.ts` | Admin: paginated user list |
| `expiring-subscriptions.scene.ts` | Admin: list subscriptions expiring soon |
| `user-details.scene.ts` | Admin: view and manage a specific user |
| `update-user-subscription.scene.ts` | Admin: update a user's tariff/subscription dates |

## Subdirectories
None — all scene files are in this directory.

## For AI Agents

### Working In This Directory
- Every scene **must** extend `AbstractScene` from `src/abstract/abstract.scene.ts`. `AbstractScene` provides `@SceneEnter()` which renders the scene's text and buttons from the `SCENES` config in `src/constants/scenes.const.ts`.
- Every scene must be registered as a provider in `BotModule` (`src/bot.module.ts`). Adding a scene file without registering it there will cause it to never be instantiated.
- Scene names are defined in `CommandEnum` (`src/enum/command.enum.ts`). Use enum values, not string literals.
- Scene UI (text, navigation buttons, inline buttons) is configured in `src/constants/scenes.const.ts` — keep logic out of the constants file.
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

// Navigate to another scene
await ctx.scene.enter(CommandEnum.HOME);

// Edit existing message instead of sending new one
const messageId = await this.sessionStateService.getMessageId(ctx.from.id);
await safeReplyOrEdit(ctx, messageId, text, extra);
```

## Dependencies

### Internal
- `AbstractScene` (`src/abstract/abstract.scene.ts`) — base class
- `SCENES` (`src/constants/scenes.const.ts`) — scene UI configuration
- `CommandEnum` (`src/enum/command.enum.ts`) — scene name constants
- `UserService`, `PaymentService`, `TariffService` — data access
- `SessionStateService` — payment flow state
- `SafeTelegramHelper` — all Telegram API calls

### External
- `nestjs-telegraf` — `@Scene`, `@SceneEnter`, `@Action`, `@On`, `@Hears`, `@Ctx`
- `telegraf` — `Markup` for keyboard building

<!-- MANUAL: -->
