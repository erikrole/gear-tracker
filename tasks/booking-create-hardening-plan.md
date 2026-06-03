# Booking Create Hardening Plan

Date: 2026-05-30
Status: Shipped

## Scope
Harden booking creation at the shared server boundary used by `/api/checkouts`, `/api/reservations`, reservation conversion, and reservation duplication.

## Sources Checked
- `AGENTS.md`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`
- `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`
- `docs/archive/BRIEF_CHECKOUT_UX_V2.md`
- `docs/archive/BRIEF_RESERVATIONS_V1.md`
- `docs/archive/BRIEF_PICKER_IMPROVEMENTS_V1.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `prisma/schema.prisma`
- `src/app/api/checkouts/route.ts`
- `src/app/api/reservations/route.ts`
- `src/app/api/reservations/[id]/convert/route.ts`
- `src/app/api/reservations/[id]/duplicate/route.ts`
- `src/lib/services/bookings-lifecycle.ts`
- `src/lib/services/availability.ts`
- `src/lib/validation.ts`

## Findings
- Create routes already validate JSON, auth, RBAC, date parsing, and availability before insert.
- Shared `createBooking()` is the right hardening point because direct routes, conversion, and duplication all pass through it.
- The current service allows empty non-draft bookings if a caller bypasses the wizard.
- Duplicate `eventIds` are silently deduped in the service, but the multi-event brief calls for a 400.
- Direct service callers can pass invalid or zero-length windows; API routes catch this, but the shared service should enforce it too.
- DB overlap races are only normalized for `P2002`; exclusion-constraint and serializable transaction failures should return conflict semantics instead of leaking a server error.

## Slice Checklist
- [x] Add shared create-input guardrails for equipment minimum, date window validity, and duplicate `eventIds`.
- [x] Normalize DB overlap/constraint races to user-facing `409` conflicts.
- [x] Add route/schema duplicate `eventIds` validation so bad API payloads fail before service work.
- [x] Add focused regressions for service and validation behavior.
- [x] Sync checkout and reservation docs with the shipped hardening.
- [x] Run focused tests, TypeScript, migration check, whitespace check, and production build.

## Review
- Shared booking creation now rejects invalid windows, empty non-source equipment selections, duplicate multi-event links, duplicate bulk lines, and non-positive bulk quantities before booking writes.
- Checkout and reservation create schemas reject empty non-source payloads, duplicate `eventIds`, and duplicate bulk lines before route handlers call the service.
- DB overlap races from the `asset_allocations_no_overlap` exclusion constraint and serializable transaction conflicts are translated to 409 responses that the existing create UI can surface as conflicts.
- Focused regressions cover service guardrails, event-link ordering, constraint-race handling, serializable conflict handling, and schema validation.
- Verified with `npx vitest run tests/create-booking.test.ts tests/booking-create-validation.test.ts`, `npx vitest run tests/availability.test.ts tests/availability-route.test.ts tests/booking-list-routes.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.

## Verification Plan
- `npx vitest run tests/create-booking.test.ts tests/booking-create-validation.test.ts`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
