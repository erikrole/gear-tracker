# Event Travel API Hardening Plan - 2026-07-23

## Goal
- Make event travel roster writes accountable, atomic, bounded, and constrained to active members of the event's sport roster.

## Route
- Owner area: Events, with Schedule as the secondary area.
- Ledger: `tasks/archive/completed-2026-07/event-travel-api-hardening-plan.md`.
- Existing references: `tasks/audit-trail-audit.md` finding 5 and `tasks/api-hardening-audit.md` accepted travel-roster read and mutation boundaries.

## Source Checks
- `POST /api/calendar-events/[id]/travel` and `DELETE /api/calendar-events/[id]/travel/[memberId]` use `withAuth`, require `shift.manage`, and validate event ownership for deletes.
- Both state-changing routes currently write `EventTravelMember` rows without audit entries or an atomic mutation-plus-audit transaction.
- `EventTravelMember` has database-enforced uniqueness on `(eventId, userId)`.
- The Event detail picker only offers users from the event sport's roster, but the POST route currently accepts any syntactically valid user ID.
- D-007 and the platform invariants require every mutation path to emit actor, diff, and timestamp evidence.

## Stop Conditions
- Stop if travel membership is intentionally allowed outside the event's sport roster or if event travel audit entries must use a different entity/action vocabulary than the existing event timeline contract.
- Stop if the active schema tranche changes `CalendarEvent`, `StudentSportAssignment`, `EventTravelMember`, or `AuditLog` while this slice is in progress.

## Slices
- [x] Slice 1: Put event travel add/remove plus useful audit snapshots in `SERIALIZABLE` transactions, preserve database-owned duplicate detection, and return actionable conflicts.
- [x] Slice 2: Enforce active sport-roster membership and the shared settings-mutation rate bound at the server boundary.
- [x] Slice 3: Add focused authorization, validation, concurrency-boundary, audit, and failure-response tests.
- [x] Slice 4: Sync Events/Schedule documentation, the gap ledger, and this review.

## Verification
- [x] `npx vitest run tests/calendar-travel-auth.test.ts`
- [x] `npx eslint 'src/app/api/calendar-events/[id]/travel/route.ts' 'src/app/api/calendar-events/[id]/travel/[memberId]/route.ts' tests/calendar-travel-auth.test.ts`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated mutation smoke, or record why shared schedule data was not mutated.

## Review
- Shipped: Event travel adds and removals now commit with event-scoped audit rows inside `SERIALIZABLE` transactions. Adds enforce active event-sport roster membership, preserve database-owned uniqueness, return a specific duplicate conflict, and share the bounded settings mutation limiter.
- Verified: 10 focused route tests, focused and full lint, TypeScript, migration-prefix validation, codemap/docs checks, whitespace checks, and `build:app` pass.
- Deferred: No live authenticated add/remove smoke was performed because it would mutate shared schedule data and no disposable event/traveler fixture was available.
- Blocked: The repository-wide suite has 8 unrelated failures across pre-existing Users, iOS Schedule/Bookings/Profile, and collaborator-booking contracts; 2,648 tests pass, including the full travel route suite.
- Proof artifacts: Command output from the 2026-07-23 execution turn; no browser artifact was generated for this API-only mutation slice.
- Next slice or stop: Stop this bounded route-family slice. Continue the remaining audit-trail findings separately so unrelated account-security, calendar-sync, and audit-retention contracts do not become one oversized change.
