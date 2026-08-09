# Integrated core implementation report

Date: 2026-08-09
Release candidate: `integrated-core-v1`
Implementation branch: `feat/integrated-core`

## Outcome

MERIDIAN now has a real shared-data execution path in addition to its deterministic public laboratory. The implementation connects the operator UI, authenticated organization context, PostgreSQL records, atomic business transactions, durable workflow steps, controlled documents, shipment milestones, customer portal, audit chain, Inbox/Outbox and idempotency layer.

The public Vercel runtime remains in safe `fixture` mode until managed PostgreSQL and Clerk resources are provisioned. It does not silently fall back to fixtures when `database` mode is selected but misconfigured.

## Completed integration boundaries

| Boundary | Implemented result |
|---|---|
| Identity and tenancy | Clerk organization/user/membership webhook provisioning; server-derived organization context; role checks; no trusted browser tenant IDs |
| Shared persistence | 32 PostgreSQL tables with foreign keys, organization indexes, versions, timestamps and Drizzle migrations |
| Lead-to-order | One atomic transaction creates company, lead, due diligence, customer, quote/version/lines and sales order/lines; high-risk cases stop at a held review |
| Inventory | Atomic reserve function with row locking, optimistic version check, oversell prevention, stock movement, audit, held Outbox and replay record |
| Documents | Eight PDF types project from the authenticated organization; unknown or cross-organization orders return no document; controlled drafts are marked not for filing |
| Fulfillment | Vercel Workflow DevKit persists the order saga; database steps reserve stock and create document, shipment and milestone records with stable step idempotency |
| Milestones | Atomic current-to-next transition updates the order stage and creates a linked audit event plus a held customer-update draft |
| Customer portal | Expiring HMAC-derived token, SHA-256-only database storage, idempotent issue, automatic rotation/revocation and a cost-redacted projection |
| Reliability | Provider Inbox, held Outbox, scoped idempotency records, deterministic request hashes and retry-safe transaction functions |
| Audit | Organization-serialized append-only event chain with previous hash and tamper verification |
| UI state | Database mode is server-rendered from organization rows and does not read or write the fixture IndexedDB journal |

## Verification evidence

| Check | Result |
|---|---|
| ESLint | Passed with zero errors |
| TypeScript | Passed with zero errors |
| Vitest | 10 files, 179 tests passed |
| PostgreSQL integration | Fresh migration plus 22 database cases passed |
| Production build | Next.js 16.3 and Workflow build passed; all application/API/workflow routes emitted |
| Browser E2E | 36/36 journeys passed across desktop Chromium and mobile WebKit |
| Visual/browser health | Meaningful page content, 15 workspaces, no framework overlay, no page errors |
| Accessibility | Automated WCAG 2 A/AA scan: zero violations after remediation |
| Local performance sample | TTFB 25.5 ms, FCP 68 ms, LCP 108 ms, CLS 0.0001 |
| Production dependency audit | Zero high/critical production dependency findings; four moderate findings remain in the development-only Drizzle CLI chain |

Performance values are local samples, not production SLOs.

## Deliberately held external effects

The following remain disabled or draft-only even in database mode:

- real lead scraping or personal-data acquisition;
- email, chat or CRM message delivery;
- supplier purchase-order transmission;
- carrier booking or instruction;
- customs/origin filing;
- invoice collection, payment or bank movement.

These require provider credentials, contracts, jurisdiction-specific review, approval policies, reconciliation and explicit production authorization. Internal `dryRun=false` means controlled database writes only; it never means permission for an external effect.

## Cloud activation still required

1. Provision a managed PostgreSQL database and apply `npm run db:migrate`.
2. Provision Clerk Organizations and register `/api/webhooks/clerk` with its signing secret.
3. Add `DATABASE_URL`, Clerk keys, `PORTAL_TOKEN_SECRET` and `CRON_SECRET` to Vercel Preview.
4. Optionally seed deterministic onboarding records mapped to one Clerk organization/user.
5. Set Preview to `DATA_MODE=database`, `AUTH_MODE=clerk`, `OUTBOUND_MODE=draft`.
6. Run authenticated Preview acceptance and backup/restore validation.
7. Promote only after the organization owner accepts data residency, operational and compliance controls.

No managed resource, legal term, paid service or production deployment was created merely to make the report appear complete.
