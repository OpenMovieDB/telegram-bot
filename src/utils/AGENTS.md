<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-12 -->

# utils

## Purpose
Shared utility functions for message handling, keyboard layout, and catalog-driven tariff display.

## Key Files
| File | Description |
|------|-------------|
| `tariff-display.util.ts` | Billing catalog → UI: `tariffLine` (⭐ popular + display_name + limit + price + description), `tariffButtons` (`tariff_<id>` pairs), `priceLabel` (free / monthly / «от N руб. за M мес.»), `adminTariffButtonLabel` (🔒 hidden), `accountTariffName` (display_name over code), `requestsLimitLabel` (∞). |
| `safe-reply.util.ts` | `safeReplyOrEdit(ctx, messageId, text, extra)` — edits existing message or replies with new one. Falls back from HTML to plain text on parse errors. |
| `reply-or-edit.util.ts` | `replyOrEdit(ctx, messageId, text, extra)` — simpler version, requires messageId to be set. |
| `split-array-into-pairs.ts` | Helper to chunk arrays into pairs (used for keyboard layouts). |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- `tariff-display.util` is the ONLY place tariff UI strings/buttons are built — it works for arbitrary catalog codes (a new tariff in billing needs zero bot changes). Never reintroduce code→enum/scene mappings.
- `safeReplyOrEdit` — tries to edit the tracked message from `SessionStateService`, falls back to reply on error. Gracefully handles parse mode fallback from HTML to plain text.
- Both message utilities avoid duplicate messages in scenes by editing inline instead of spamming replies.
- Rate-limit TTL/midnight-MSK logic does NOT belong here — counters are account-internal (see `src/AGENTS.md`).

### Testing Requirements
```bash
npm test                                         # all tests
npm run test -- --testPathPattern=utils          # utility-specific tests (incl. tariff-display.util.spec.ts)
```

### Common Patterns
```typescript
// Catalog-driven tariff UI
const tariffs = await this.tariffService.getAllTariffs(); // hidden filtered, sorted by price
const text = tariffs.map(tariffLine).join('');
const keyboard = Markup.inlineKeyboard(tariffButtons(tariffs));

// Edit or reply with fallback to plain text
await safeReplyOrEdit(ctx, existingMessageId, htmlText, {
  parse_mode: 'HTML',
  reply_markup: keyboard,
});
```

## Dependencies

### Internal
- `BillingTariff` type (`src/billing/billing.client.ts`), `monthlyPriceRub` (`src/tariff/tariff.service.ts`)

### External
| Package | Purpose |
|---------|---------|
| `telegraf` | Context type and `Markup` for message/keyboard utilities |

<!-- MANUAL: -->
