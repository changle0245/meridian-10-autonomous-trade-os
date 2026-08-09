# Operations runbook

## Local verification

```bash
npm ci
npm run verify
npx playwright install chromium webkit
npm run test:e2e
```

## Vercel configuration

1. Deploy the repository as a Next.js project using Node.js 22 or newer.
2. Generate a long random `CRON_SECRET` in the platform; do not store it in Git.
3. Add `CRON_SECRET` to the production environment.
4. Keep the cron path and schedule in `vercel.json`.
5. Confirm `/api/cron/daily` returns `401` without authorization.
6. Confirm Vercel's scheduled request supplies the bearer token and the dry-run reports zero external actions.

The app has no other required production secret because all operational data is synthetic.

## Health and smoke checks

```bash
curl -fsS https://meridian-10-autonomous-trade-os.vercel.app/api/health
PLAYWRIGHT_BASE_URL=https://meridian-10-autonomous-trade-os.vercel.app npm run test:public
```

Expected health characteristics: HTTP 200, `status: ok`, `synthetic: true`, and no credential or personal-data fields.

## Incident triage

1. Check the latest Vercel deployment status and function logs.
2. Reproduce with the public Playwright suite.
3. If workflow queuing fails, inspect Workflow DevKit events and confirm generated discovery routes exist.
4. If PDF generation fails, call one document endpoint directly and verify the `%PDF` signature.
5. If browser state is corrupt, export when possible, validate tenant/schema, then use the reset control.
6. If cron authentication fails, rotate `CRON_SECRET` and redeploy; never weaken the endpoint check.

## Rollback and recovery

- Application: promote the last known-good immutable Vercel deployment.
- Browser demo state: import a previously exported JSON snapshot or reset to deterministic fixtures.
- Workflow: start a new idempotent dry-run; do not replay a real external effect.
- Documents: regenerate from the versioned order; drafts remain non-fileable.

## Production handoff gate

Do not connect real customer data or external effects until authentication, shared storage, provider contracts, privacy controls, approval roles, observability, reconciliation, backup/restore and licensed compliance ownership have all been independently accepted.
