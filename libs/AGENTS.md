<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-06-21 -->

# libs

## Purpose
Independent NestJS library modules registered in `tsconfig.json` and `nest-cli.json`
with `@app/<name>-client` path aliases. The bot is a stateless façade over
account/billing, so it ships **no payment-gateway libraries** — payment providers
live in **billing-service**. The only library here is `update-client`, an admin
utility for the internal kinopoiskdev movie-data sync API.

> The payment-gateway client libs (`cryptomus-client`, `tbank-client`,
> `yookassa-client`, `yoomoney-client`, `wallet-client`) and the in-bot
> `IPaymentStrategy` / `src/payment/strategies/` pattern were **removed**. Do not
> add a `libs/*-client` gateway or a strategy class — a new provider is added in
> billing-service and exposed via `src/payment/payment-provider.map.ts`.

## Key Files
| File | Description |
|------|-------------|
| `update-client/src/update-client.service.ts` | `UpdateClientService` — `update(ids[])` triggers full movie data sync (14 data types), `setImdbRelation(id, imdbId)`. HTTP PUT/PATCH to the internal API. Used by admin movie scenes |
| `update-client/src/update-client.module.ts` | NestJS module exporting `UpdateClientService` |
| `update-client/src/update-client.service.spec.ts` | Unit tests for `UpdateClientService` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `update-client/` | Internal movie-data sync API client (`@app/update-client`) |

## For AI Agents

### Working In This Directory
- `update-client` is **not** a payment gateway — it talks to the internal kinopoiskdev data-sync API for the admin movie-management scenes (`update-movie.scene.ts`, `set-imdb-relation.scene.ts`).
- Do not reintroduce payment-gateway libraries or an `IPaymentStrategy` pattern (see the note above).
- The library's `index.ts` re-exports the module and service for clean imports.

### Testing Requirements
```bash
npm test                                          # all tests including libs/
npm run test -- --testPathPattern=update-client   # UpdateClient tests
```

### Common Patterns
```typescript
import { UpdateClientService } from '@app/update-client';

// Trigger full movie sync
await this.updateClientService.update([123, 456]);

// Link movie to IMDB
await this.updateClientService.setImdbRelation(123, 'tt1234567');
```

## Dependencies

### Internal
None — libraries have no dependencies on `src/` code.

### External
| Library | External Package |
|---------|-----------------|
| `update-client` | `@nestjs/axios` (HTTP) |

<!-- MANUAL: -->
