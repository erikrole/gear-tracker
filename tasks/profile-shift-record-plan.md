# Personal Shift Records Plan - 2026-07-23

## Goal
- Show an evidence-backed all-time W-L record and shift count on internal web and iOS profiles using final published assignments and synced `[W]` / `[L]` event-title markers.

## Route
- Owner area: Schedule
- Secondary areas: Users, Mobile
- Ledger: `tasks/profile-shift-record-plan.md`
- Related plan: `tasks/athletic-calendar-wrapped-plan.md`

## Source Checks
- Synced `CalendarEvent.summary` is cleaned for display while `rawSummary` preserves the upstream title.
- `cleanSourceSummary` already removes a leading single-letter source marker, so result extraction must happen before title cleanup.
- Published relational assignments with `DIRECT_ASSIGNED` or `APPROVED` are the worker-facing source of truth under D-042.
- Attendance UI and attendance-based recognition remain intentionally out of scope.
- The current migration chain ends at `0105_license_expiry_timestamp_parity`.

## Stop Conditions
- Stop if the source marker is not a leading `[W]` or `[L]`, if result extraction would apply to manual events, or if profile authorization cannot reuse the existing internal profile visibility contract.
- Stop client work if the route response differs from the documented numeric contract.
- Stop closeout if schema, web, iOS, docs, or authenticated/runtime proof cannot be separated honestly.

## Slices
- [x] Slice 1: Add nullable event result persistence, migration `0106`, backfill from stored raw titles, and result-aware calendar sync.
- [x] Slice 2: Add the all-time shift-record aggregation service and authorized internal profile API.
- [x] Slice 3: Add matching web and native profile cards with per-sport disclosure and empty/incomplete coverage copy.
- [x] Slice 4: Add focused regression, authorization, source-contract, migration, docs, build, and runtime proof, recording unavailable authenticated navigation honestly.

## Verification
- [x] Focused calendar-sync, aggregation, route, web-source, and iOS-source tests.
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for changed web and TypeScript source.
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:project:check`
- [x] Affected iOS source-contract tests and Xcode simulator build.
- [x] Authenticated web and iOS profile smoke attempted; blockers recorded below.
- [ ] Full `npm run build` only in a controlled migration-safe environment.

## Review
- Shipped: Source-backed event results, migration/backfill, sync correction tracking, protected shift-record aggregation, and matching internal web/native profile cards.
- Verified: 149 focused tests, Prisma validation, 108-migration prefix check, TypeScript, focused ESLint, app build, codemap/docs, whitespace, iOS drift/audit/project checks, and Wisconsin simulator build/run.
- Deferred: Scores, ties, no-contests, season filtering, attendance, leaderboards, and public/collaborator records.
- Blocked: The local web browser has no authenticated session. Signed-in native navigation did complete through Browse, Users, and Ashley Steltenpohl's production-backed User Detail; the record card is correctly absent until migration `0106` and the new API route deploy to the backend that Simulator uses. The broad native source suite also has four unrelated existing failures in deep-link and Schedule filter expectations; this slice's native source contract passes.
- Proof artifacts: `npm run build:app` includes `/api/users/[id]/shift-record`; XcodeBuildMCP built, installed, and launched `com.erikrole.Wisconsin` on simulator `7F67231E-D454-4D40-8546-603DD961683F`. Native User Detail proof: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/com.openai.sky.CUAService/Simulator Screenshot 2026-07-23 at 3.30.21 PM.jpeg`.
- Next slice or stop: Apply migration `0106_calendar_event_results` in the controlled release flow, then run the normal source sync so still-published upstream markers augment the raw-title backfill. Stop feature work here.
