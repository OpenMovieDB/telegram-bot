<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-12 -->

# tariff

## Purpose
Read-only, cached (5 min TTL) view of the **billing-service tariff catalog**.
Billing is the single source of truth for tariffs and prices; the bot only
formats them. There is no local tariff storage and no legacy shape — scenes
consume `BillingTariff` (`src/billing/billing.client.ts`) directly.

## Key Files
| File | Description |
|------|-------------|
| `tariff.service.ts` | Catalog queries over `BillingClient.listTariffs()`: `getOneById`, `getOneByCode` (case-insensitive), `getAllTariffs` (excludes hidden, sorted by monthly price), `getFreeTariff` (`is_default`). Price helpers: `monthlyPriceRub`, `priceForMonthsRub` (exact per-period price from `prices[]`, fallback monthly × months) |
| `tariff.module.ts` | NestJS module — imports `BillingModule`, exports `TariffService` |

## For AI Agents

### Working In This Directory
- `TariffService` is purely read-only. Tariffs are managed in billing-service (`/v1/admin/tariffs`), never from the bot.
- Never recompute prices/discounts beyond the helpers here — billing computes the authoritative amount at payment time.
- `getAllTariffs()` returns only non-hidden tariffs sorted by monthly price ascending — this is the list shown to users.
- `getOneByCode` is case-insensitive; tariff `code` is the display name used in scene texts (`BUTTONS[code + '_TARIFF']`).

### Testing Requirements
```bash
npm test
npm run test -- --testPathPattern=tariff
```

### Common Patterns
```typescript
// Get all visible tariffs for display
const tariffs = await this.tariffService.getAllTariffs();

// Get by code (admin /pay passes the tariff name)
const tariff = await this.tariffService.getOneByCode(tariffName);

// Get free tariff (is_default)
const freeTariff = await this.tariffService.getFreeTariff();

// Price for a period
const totalRub = priceForMonthsRub(tariff, months);
```

## Dependencies

### Internal
- `BillingModule` (`BillingClient.listTariffs`)
- Referenced by scenes, `PaymentModule`, `BotService`

<!-- MANUAL: -->
