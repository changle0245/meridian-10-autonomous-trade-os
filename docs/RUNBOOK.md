# Operations runbook

## Local verification

```bash
npm ci
npm run verify
npx playwright install chromium webkit
npm run test:e2e
```

## Vercel configuration

### Public fixture mode

1. Deploy the repository as a Next.js project using Node.js 24.
2. Set `DATA_MODE=fixture`, `AUTH_MODE=demo` and `OUTBOUND_MODE=draft`, or rely on those defaults.
3. Generate a long random `CRON_SECRET` in the platform; do not store it in Git.
4. Confirm `/api/cron/daily` returns `401` without authorization and the scheduled dry-run reports zero external actions.

### Shared database mode

1. Create a managed Neon-compatible PostgreSQL database and retain its provider backup/restore policy.
2. Configure a Clerk application with Organizations enabled. Install the webhook endpoint at `/api/webhooks/clerk` for organization, user and membership events.
3. Generate independent random values for `PORTAL_TOKEN_SECRET` (32+ characters) and `CRON_SECRET`.
4. Add server-only `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `PORTAL_TOKEN_SECRET` and `CRON_SECRET`; add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` as the only public identity key.
5. Run `npm run db:migrate` against the target database. Optionally map a Clerk organization/user and run `npm run db:seed:demo` for deterministic onboarding data.
6. Set `DATA_MODE=database`, `AUTH_MODE=clerk` and keep `OUTBOUND_MODE=draft`.
7. Deploy to Preview first, sign in through Clerk, and verify `/api/system/capabilities` reports `organization-database`, signed portal readiness and held draft output.

Do not place secrets in Git, client-visible environment variables, build logs or screenshots. Portal tokens are returned in a no-store response; PostgreSQL stores only their hash.

## Health and smoke checks

```bash
curl -fsS https://meridian-10-autonomous-trade-os.vercel.app/api/health
PLAYWRIGHT_BASE_URL=https://meridian-10-autonomous-trade-os.vercel.app npm run test:public
```

Expected fixture health characteristics: HTTP 200, `ok: true`, `dataMode: deterministic-synthetic`, and no credential or personal-data fields. Database mode reports `organization-database`; configuration errors return a capability failure rather than falling back to fixtures.

## Incident triage

1. Check the latest Vercel deployment status and function logs.
2. Reproduce with the public Playwright suite.
3. If workflow queuing fails, inspect Workflow DevKit events and confirm generated discovery routes exist.
4. If PDF generation fails, call one document endpoint directly and verify the `%PDF` signature.
5. In fixture mode, if browser state is corrupt, export when possible, validate tenant/schema, then use the reset control. Database mode never hydrates shared records from IndexedDB.
6. If cron authentication fails, rotate `CRON_SECRET` and redeploy; never weaken the endpoint check.
7. If a database write is uncertain, retry with the same request id. Do not invent a new id until the original result is known.
8. If a portal link is exposed, issue a new grant for that order; the transaction revokes all prior active links.

## Rollback and recovery

- Application: promote the last known-good immutable Vercel deployment.
- Browser demo state: import a previously exported JSON snapshot or reset to deterministic fixtures.
- Database: restore through the managed provider, then verify migration history, audit-chain continuity and organization row counts before reopening writes.
- Workflow: resume/retry using stable step and business idempotency keys; do not replay a real external effect.
- Documents: regenerate from the versioned order; drafts remain non-fileable.

## Production handoff gate

Authentication and shared storage are implemented but must be provisioned and operationally accepted per environment. Do not connect real customer data or release external effects until provider contracts, privacy controls, approval roles, observability, reconciliation, backup/restore and licensed compliance ownership have all been independently accepted.
