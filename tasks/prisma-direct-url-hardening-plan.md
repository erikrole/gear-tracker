# Prisma direct URL hardening

Date: 2026-08-19
Status: Implemented; migrations 0117-0124 applied to production

## Goal

Make every repository-owned Prisma/Neon maintenance path accept the direct URL
names provided by both the repository and the Neon Vercel integration, while
continuing to reject pooled runtime connections for DDL.

## Slices

- [x] Centralize direct migration connection resolution.
- [x] Prefer `DIRECT_URL`, then accept `DATABASE_URL_UNPOOLED`.
- [x] Reject pooled, malformed, missing, and Vercel-redacted values with
      actionable errors that never print credentials.
- [x] Let schema-only Prisma commands use an inert local placeholder while
      deploy and health wrappers remain strict.
- [x] Apply the resolver to deploy, health, empty bootstrap, and the firmware
      maintenance seed.
- [x] Add focused regression coverage and update the Prisma/Neon runbook.
- [x] Rehearse migrations `0117`-`0124` atomically on Neon branch
      `br-dry-bonus-ai1uukrj`, then apply the identical guarded transaction to
      production branch `br-gentle-sky-aisuwcsf`.

## Production evidence

- Production started at `0116_bulk_schedule_assignment` with 121 applied
  migrations and no unresolved rows.
- Migrations `0117`-`0124` were applied in one transaction after the rehearsal
  branch passed ledger and semantic readback.
- Production now has exactly eight completed target rows, no unresolved rows,
  and `0124_calendar_event_site` as the newest applied migration.
- All eight production checksums match the corresponding local migration SQL.
- Migration `0125_software_credentials` remains intentionally unapplied.
- `https://wisconsincreative.com/login` returned HTTP 200 after the migration.
