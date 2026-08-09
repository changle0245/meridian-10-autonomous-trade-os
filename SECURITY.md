# Security policy

MERIDIAN 10 is a public synthetic demonstration, not a production trade, compliance or financial system.

## Reporting

Do not include credentials, real personal data, customer records, supplier contracts or regulated trade information in a public issue. Report a reproducible software weakness through GitHub's private vulnerability reporting feature when available.

## Supported surface

Only the latest `main` revision and current public deployment are supported. Dependencies are pinned and checked by CI and Dependabot.

## Explicit boundaries

- No secret belongs in source control, browser storage, screenshots or issue bodies.
- `/api/cron/daily` rejects requests unless `CRON_SECRET` is configured and the bearer token matches.
- Customer portal responses redact supplier cost, internal margin and risk notes.
- Screening flags create a hold; they do not assert that a person or company is sanctioned.
- Generated customs and origin documents are drafts and must not be filed.
- Synthetic demo data must never be mixed with production records.

See `docs/THREAT-MODEL.md` for trust boundaries, mitigations and residual risks.
