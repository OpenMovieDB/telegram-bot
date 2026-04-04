<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# tariff

## Purpose
Read-only access layer for the Tariff MongoDB collection. Provides lookups by ID, name, and price tier. Tariffs are created and managed outside the bot (directly in MongoDB). The bot only reads tariff data.

## Key Files
| File | Description |
|------|-------------|
| `tariff.service.ts` | Tariff queries: `getOneById`, `getOneByName`, `getAllTariffs` (excludes hidden, sorted by price), `getFreeTariff` (price=0 and not hidden) |
| `tariff.module.ts` | NestJS module — exports `TariffService` |
| `schemas/tariff.schema.ts` | Mongoose schema: `name` (unique), `requestsLimit`, `price`, `isHidden` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `schemas/` | Mongoose Tariff schema and TariffDocument type |

## For AI Agents

### Working In This Directory
- Always use `SafeTelegramHelper.safeSend()` for any Telegram API calls in services that depend on `TariffService`.
- `TariffService` is purely read-only — there are no create/update/delete methods. Do not add write operations to this service; tariffs are managed via external MongoDB tooling.
- `getAllTariffs()` returns only non-hidden tariffs sorted by price ascending — this is the list shown to users in the bot.
- `getOneByName` matches exact uppercase name — callers pass `tariffName.toUpperCase()` before calling.
- `tariffId` on the User schema is a MongoDB ObjectId ref to the Tariff collection. Populated via `.populate('tariffId')`.

### Testing Requirements
```bash
npm test                                         # all tests
npm run test -- --testPathPattern=tariff         # tariff-specific tests
```

### Common Patterns
```typescript
// Get all visible tariffs for display
const tariffs = await this.tariffService.getAllTariffs();

// Get by name (admin commands pass uppercase)
const tariff = await this.tariffService.getOneByName(tariffName.toUpperCase());

// Get free tariff for default assignment
const freeTariff = await this.tariffService.getFreeTariff();
```

## Dependencies

### Internal
- Referenced by `UserModule` (tariffId populate), `PaymentModule` (price calculation)

### External
| Package | Purpose |
|---------|---------|
| `mongoose` / `@nestjs/mongoose` | MongoDB ODM |

<!-- MANUAL: -->
