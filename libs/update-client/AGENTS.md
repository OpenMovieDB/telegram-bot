<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# update-client

## Purpose
NestJS client library for internal Kinopoisk movie data sync API (not a payment gateway). Triggers full data synchronization for movies and manages IMDB ID linking. Exposed via `@app/update-client` path alias. Used only by admin scenes.

## Key Files
| File | Description |
|------|-------------|
| `src/update-client.service.ts` | `UpdateClientService` — `update(ids[])` (triggers sync of 14 data types), `setImdbRelation(id, imdbId)` (links movie to IMDB). Makes HTTP PUT/PATCH requests to internal API. |
| `src/update-client.module.ts` | NestJS module — imports HttpModule, exports UpdateClientService |
| `src/update-client.service.spec.ts` | Unit tests |

## For AI Agents

### Working In This Directory
- `UpdateClientService` is **not** a payment strategy — it is a separate admin utility for movie data management.
- `update(ids)` triggers full sync of 14 data types (cast, genres, ratings, etc.) for the given movie IDs.
- `setImdbRelation(id, imdbId)` creates a one-to-one mapping between a Kinopoisk movie and an IMDB ID for external linking.
- Used by admin scenes: `update-movie.scene.ts` and `set-imdb-relation.scene.ts`.
- No retry logic — errors bubble up to scenes for user feedback.

### Testing Requirements
```bash
npm test                                         # all tests
npm run test -- --testPathPattern=update-client # library-specific tests
```

### Common Patterns
```typescript
import { UpdateClientService } from '@app/update-client';

// Trigger full movie sync
await this.updateClientService.update([123, 456]);
// Sends: PUT /internal-api/movies/bulk-update with IDs

// Link movie to IMDB
await this.updateClientService.setImdbRelation(123, 'tt1234567');
// Sends: PATCH /internal-api/movies/123/imdb-relation
```

## Dependencies

### Internal
None — library is independent.

### External
| Package | Purpose |
|---------|---------|
| `@nestjs/common`, `@nestjs/axios` | HTTP client |

<!-- MANUAL: -->
