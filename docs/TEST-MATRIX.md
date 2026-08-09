# Test matrix

## Automated coverage

| Area | Examples | Suite |
|---|---|---|
| Lead and similarity scoring | score bounds, ranking stability, explanations | Vitest |
| Quotes and finance | landed cost, discount guard, FX/freight stress, profit status | Vitest |
| Inventory | reserve, replay, stale version, unknown SKU, oversell rejection | Vitest |
| PostgreSQL migration | fresh schema, constraints, transaction functions | PGlite + Drizzle migrator |
| Order intake | lead through order atomicity, review hold, replay and tenant isolation | PGlite + Vitest |
| Milestones | atomic timeline/stage transition, completion, held update, replay and tenant isolation | PGlite + Vitest |
| Portal grants | hashed token, deterministic retry, expiry, rotation, revocation, redaction and tenant isolation | PGlite + Vitest |
| Audit | genesis, append, tamper detection, deterministic chain | Vitest |
| Automation | discovery deduplication, dry-run loop, hold semantics | Vitest |
| Documents | all eight PDF types, signature, title, watermark and draft text | Vitest + visual render review |
| Workflow | synthetic boundary, stock step, documents, milestones and draft outbox | Vitest + WDK build |
| API | health, validation, scoring, quote, reserve, profit, audit, cron auth | Vitest |
| Operator UI | 15 workspaces, controls, persistence-sensitive flows and PDFs | Playwright Chromium + Mobile WebKit |
| Customer portal | valid/expired/unknown token, redaction, database projection and invalid-token 404 | Vitest + Playwright |
| Public runtime | home, API, PDFs, workflow queue, cron denial and portal | Playwright against Vercel |

## Release acceptance

- `npm run lint` returns zero errors.
- `npm run typecheck` returns zero errors.
- All Vitest tests pass.
- `npm run build` compiles the workflow and all routes.
- All local desktop and mobile Playwright journeys pass.
- All public deployment journeys pass over HTTPS.
- Representative PDFs render with no clipping or overlap.
- Production runtime shows no release-blocking errors.

The test counts are reported from the release run rather than hard-coded here so the matrix remains accurate as coverage grows.
