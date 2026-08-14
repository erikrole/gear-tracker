# Private Usage Analytics Plan - 2026-08-12

## Goal
- Count privacy-light web, iOS, and kiosk product usage without collecting content, search text, record identifiers, device fingerprints, or replay data.
- Give only the explicitly configured product owner access to the usage report. ADMIN status alone must never grant access.

## Route
- Owner area: Reports & Analytics
- Secondary areas: Mobile, Privacy, API, Schema
- Ledger: `tasks/private-usage-analytics-plan.md`
- Existing references: `docs/AREA_REPORTS.md`, `docs/AREA_MOBILE.md`, `src/app/privacy/page.tsx`

## Source Checks
- Operational reports currently aggregate durable business records and do not answer cross-platform product-usage questions.
- Web/server Sentry is diagnostics infrastructure, while native iOS explicitly has no generic tap analytics or session replay.
- `INTERNAL_OPERATOR_EMAILS` can grant hidden-user privileges to more than one person, so usage analytics requires a separate default-deny owner allowlist.
- Badge awards remain server-authoritative and separate from product telemetry.

## Stop Conditions
- Stop if analytics access can be obtained from role alone or if the owner allowlist is absent and access fails open.
- Stop if an event property can contain free-form user content, URLs, search terms, record identifiers, or scanned values.
- Stop if telemetry failure can block an operational mutation or signed-in app workflow.
- Stop if the current migration chain or Prisma schema contradicts the planned append-only event model.

## Slices
- [x] Slice 1: Add the append-only, bounded `ProductEvent` schema and migration.
- [x] Slice 2: Add an authenticated allowlisted ingestion service and owner-only aggregate report endpoint.
- [x] Slice 3: Add shared web instrumentation for app opens and normalized surface views, plus native iOS app-open and tab-view events.
- [x] Slice 4: Add a private web Usage report discoverable only by the configured owner.
- [x] Slice 5: Add focused authorization, validation, aggregation, source-contract, privacy, and documentation coverage.

## Verification
- [x] Focused Vitest route, service, UI-contract, and iOS source-contract tests.
- [x] `npx prisma format`
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `npm run build:app`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [ ] Wisconsin build for `platform=iOS Simulator,name=iPhone 16 Pro`
- [ ] Authenticated browser smoke for owner access, role-only denial, and event ingestion, or record why unavailable.
- [x] `git diff --check`

## Review
- Shipped: Local schema/migration, strict ingestion, yearly-pseudonymous identity/session storage, owner-only aggregate API and Usage page, web app/surface counts, native app/tab counts, privacy disclosure, and nightly 90-day retention.
- Verified: Focused Vitest suites, Prisma format/validate/generate, migration-prefix check, TypeScript, ESLint, codemap/docs checks, production app build, iOS project consistency, drift, audit-gap inventory, and whitespace checks.
- Deferred: Production migration deployment, owner environment configuration, deployment, and data-backed runtime inspection were not authorized.
- Blocked: Exact iPhone 16 Pro build is blocked by pre-existing Swift 6 Sendable errors in `ios/Wisconsin/Views/ReportsView.swift`; the new analytics Swift compiled without a reported error. Authenticated browser proof requires the migration plus explicit owner environment configuration.
- Proof artifacts: Vitest 11/11 focused tests plus 40/40 native/API source tests; `npm run build:app` includes `/api/product-events`, `/api/reports/usage`, and `/reports/usage`.
- Next slice or stop: Configure `USAGE_ANALYTICS_OWNER_EMAILS` for Erik only, apply migration `0112`, deploy compatible server/web/native clients, then perform owner and non-owner authenticated acceptance proof.
