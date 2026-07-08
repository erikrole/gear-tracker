# Audit: /bookings detail (web) — 2026-07-08

**MVP verdict:** READY — 0 P0, 0 P1
**Ship bar:** all staff + students, zero hiccups
**Scope:** `BookingDetailPage.tsx` (shared component serving both `/checkouts/[id]` and `/reservations/[id]` via `kind` prop) and its full component tree. This is a fresh audit replacing the stale, unverifiable `tasks/booking-flows-audit.md` (2026-04-29), whose target files were renamed in a since-shipped refactor.

## P0 — blocks MVP

_None._

## P1 — polish before ship

_None._

## P2 — post-MVP

- [x] [Hardening] **`extend()` had no stale-write (optimistic-lock) protection, unlike every other mutation on this page. Fixed 2026-07-08.** `src/hooks/useBookingActions.ts` called `POST /api/bookings/[id]/extend` without an `If-Unmodified-Since` header, and the route never checked one. Compare to `saveField()` and the main `PATCH /api/bookings/[id]` route, which both required the header and returned 409 on a stale write.
      Concrete scenario: booking shows `endsAt=5pm` in a tab that hasn't refetched. A second person extends the same booking to 6pm elsewhere. The first tab's "+3 days" quick-extend computes its new date from the stale local `5pm`. Server-side `extendBooking()` only checked `newEndsAt <= existing.endsAt` against the *current* (6pm) value inside its SERIALIZABLE transaction — since `5pm+3days > 6pm`, the check passed and the extend silently succeeded from a premise the user never saw was outdated. No data loss, no crash, no scheduling conflict (the transaction and availability checks were otherwise sound) — but the user acted on stale context without being told, unlike every other edit path on this exact page.
      Fix shipped: `useBookingActions.ts`'s `callAction()` now accepts optional extra headers; `extend()` sends `If-Unmodified-Since` the same way `saveField()` does. `src/app/api/bookings/[id]/extend/route.ts` now fetches current state, requires the header (428 if missing, 400 if invalid), and returns 409 on a stale snapshot before calling `requireBookingAction`/`extendBooking` — mirroring the main PATCH route's contract exactly. New `tests/booking-extend-route-contract.test.ts` (4 tests, mirroring the existing `booking-lifecycle-route-contract.test.ts` pattern) covers missing header, stale header, valid header, and invalid header. Verified: `tsc --noEmit`, full `npx vitest run` (302 files / 1826 tests), `npm run build:app`.

## Acceptance criteria status

Against `docs/AREA_RESERVATIONS.md` and `docs/AREA_CHECKOUTS.md` (no dedicated `AREA_BOOKINGS.md` exists — the two kind-specific docs are the source of truth for the shared detail page):

- [x] Reservation AC-7: detail page exposes Info/Equipment/History — `BookingDetailPage.tsx:320-375` (equipment + info two-column, collapsible history section).
- [x] Reservation AC-8: equipment panel surfaces item-level conflict badges — `BookingEquipmentTab.tsx:131-205` fetches `/api/availability/check` and renders Conflict/Next use/Turnaround badges per row.
- [x] Reservation AC-9: actions menu matches state/policy mapping — verified `booking-action-policy.ts` matrix directly, including the `CHECKOUT + cancel + OPEN → staff-only` rule (`booking-action-policy.ts:105-109`), which the UI correctly reflects via `allowedActions` from the server (`BookingDetailPage.tsx:138-144`).
- [x] Checkout AC-3: state-based actions enforced exactly by lifecycle state — server-computed `allowedActions` drives every button; no client-side-only gating found.
- [x] Checkout AC-6 / Reservation AC-4: permission and ownership gates — `GET /api/bookings/[id]:61-66` has explicit student-scoped IDOR protection (404, not 403, for non-owned bookings — doesn't leak existence).
- [x] Checkout AC-7 / Reservation AC-5: every mutation emits audit records with actor/diff — confirmed in `extend`, `cancel`, PATCH routes; before/after snapshots present.
- [ ] Checkout AC-9: `PENDING_PICKUP` rollout-visibility criterion — unchecked in `AREA_CHECKOUTS.md` itself. Functionally the code handles `PENDING_PICKUP` correctly (status label, kiosk handoff copy, allowed actions), so this reads as an intentionally-open rollout/signoff item, not a code defect. Not re-litigated here.

## Lenses checked

- [x] Gaps — walked ACs above against source.
- [x] Flows — traced extend, cancel, duplicate, nudge, force-complete, inline title/notes/date saves; all have loading/disabled states, toast success/error, and double-submit guards (`busyRef` in `useBookingActions.ts`).
- [x] UI polish — loading skeleton and error states present (`BookingDetailPage.tsx:180-242`); empty equipment state present (`BookingEquipmentTab.tsx:279-284`); no stub/placeholder text found.
- [x] Hardening — traced RBAC (GET/PATCH/extend/cancel/nudge routes), rate limiting (`nudge`: 30/min + hourly dedupe key, `nudge/route.ts:8-32`), optimistic locking (PATCH route), SERIALIZABLE transactions (`extendBooking`, `cancelBooking`). One finding above.
- [x] Breaking — traced the stale-tab extend scenario above; traced auth-redirect/403/404/network-error branches in `useBookingDetail.ts` and `useBookingActions.ts`.
- [x] Parity (informational) — iOS `BookingDetailView` has matching conflict badges (GAP-35, closed), matching optimistic-lock `If-Unmodified-Since` usage per `docs/AREA_RESERVATIONS.md`'s 2026-06-03 changelog entry — iOS is not behind web here.

## Files read

- `src/app/(app)/bookings/BookingDetailPage.tsx`
- `src/app/(app)/bookings/BookingEquipmentTab.tsx`
- `src/hooks/useBookingDetail.ts`
- `src/hooks/useBookingActions.ts`
- `src/components/booking-details/BookingHeader.tsx`
- `src/components/booking-details/BookingInfoCard.tsx`
- `src/app/api/bookings/[id]/route.ts` (GET/PATCH)
- `src/app/api/bookings/[id]/extend/route.ts`
- `src/app/api/bookings/[id]/nudge/route.ts`
- `src/lib/services/bookings-lifecycle.ts` (`extendBooking`)
- `src/lib/services/booking-rules.ts`
- `src/lib/booking-action-policy.ts`
- `docs/AREA_RESERVATIONS.md`
- `docs/AREA_CHECKOUTS.md`
- `docs/GAPS_AND_RISKS.md` (checked for open items touching bookings — none beyond already-tracked GAP-34/36 iOS parity items)

## Notes

- This page is exceptionally well-hardened relative to typical MVP-audit findings — the changelog in both AREA docs documents dozens of prior hardening passes (SERIALIZABLE transactions, AbortController everywhere, safe JSON parsing, 401/403/404 differentiation, double-submit guards, idempotent-stale-PATCH detection). The one finding above is narrow specifically because it's the one action that doesn't follow the otherwise-consistent optimistic-lock pattern used everywhere else on this exact page.
- `BookingEditForm.tsx` and `BookingItems.tsx` (referenced in the stale `booking-flows-audit.md`'s target list under different old names) were not independently re-read in this pass — they're reached through the edit sheet (`BookingDetailsSheet.tsx`) rather than the detail page tree audited here. Worth a follow-up pass if the edit sheet itself becomes a concern.
- The P2 finding was fixed after this audit was presented (user approved); see the checked entry above for what shipped.
