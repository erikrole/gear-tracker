# Booking Create UX Goal Plan

Date: 2026-05-30
Status: Complete

## Goal
- Make checkout and reservation creation faster to understand, safer to recover from, and clearer at submit time without changing booking integrity rules or the shared service boundary.

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
- `src/app/(app)/checkouts/new/page.tsx`
- `src/app/(app)/reservations/new/page.tsx`
- `src/app/api/checkouts/route.ts`
- `src/app/api/reservations/route.ts`
- `src/app/api/availability/check/route.ts`
- `src/lib/services/bookings-lifecycle.ts`
- `src/lib/services/availability.ts`
- `src/lib/validation.ts`
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep1.tsx`
- `src/components/booking-wizard/WizardStep2.tsx`
- `src/components/booking-wizard/WizardStep3.tsx`
- `src/components/EquipmentPicker.tsx`
- `src/components/equipment-picker/use-conflict-check.ts`
- `src/components/equipment-picker/use-picker-search.ts`
- `src/components/create-booking/use-event-context.ts`
- `src/components/create-booking/use-draft-management.ts`
- `src/app/(app)/items/page.tsx`
- `src/app/(app)/items/new-item-sheet/SerializedItemForm.tsx`
- `src/app/(app)/items/new-item-sheet/BulkItemForm.tsx`
- `src/app/(app)/bookings/BookingEquipmentTab.tsx`
- `src/app/(app)/schedule/_components/NewEventSheet.tsx`
- `tasks/archive/completed-2026-06/booking-creation-ownership-pass-2026-05-07.md`
- `tasks/archive/completed-2026-06/booking-create-hardening-plan-2026-05-30.md`

## Peer Patterns Checked
- Items create/edit forms: section headings, compact shadcn inputs, explicit required fields, and direct validation copy.
- Items list: summary bars help users scan current state before working a table.
- Booking detail equipment tab: conflicts, next use, and turnaround risk should appear as compact row badges with short supporting text.
- Schedule event sheet and event detail: after create, show the next operational step rather than only raw success.
- Event and dashboard gear links: deep links preserve title, window, location, event, sport, requester, and selected item context.

## Prioritized Issues
1. Step 1 asks users to decide event-linked vs ad hoc but does not summarize the consequence of that choice after events are selected.
2. Step 2 rows expose conflicts, next use, and turnaround warnings, but the wizard chrome only counts hard conflicts. Users can reach review without seeing a flow-level warning summary.
3. Step 3 confirms item count and handoff outcome, but it does not carry selected availability warnings into submit confidence.
4. Submit success navigates correctly but the toast does not name the next surfaced place or handoff expectation.
5. Mobile layout is mostly workable, but fixed form rows and dense event controls can still make the first decision feel heavier than it needs to be.

## User-Facing Outcomes
- Users can tell whether the booking is event-linked or ad hoc before leaving Step 1.
- Users can see how many hard conflicts, next-use notices, and turnaround warnings are in the current selection before review.
- Confirmation names the availability state and explains what submit will re-check.
- Checkout and reservation language remains explicit: checkout creates a pending kiosk pickup, reservation creates a confirmed hold.
- Deep links, drafts, stale selected item recovery, and server-side overlap enforcement continue to work.

## Thin Slices
- [x] Slice 1: Event/ad hoc context summary in Step 1, including selected event count, derived hold window, and direct ad hoc recovery when no events load.
- [x] Slice 2: Extend picker selection state with next-use and turnaround warning counts, then surface those counts in Step 2.
- [x] Slice 3: Carry the same warning summary into Step 3 and tighten post-submit success feedback.
- [x] Slice 4: Add focused unit tests for the new helper logic.
- [x] Slice 5: Sync checkout/reservation docs and run full verification.

## Verification Plan
- `npx vitest run tests/booking-create-ux.test.ts tests/create-booking.test.ts tests/booking-create-validation.test.ts`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Browser smoke on `/checkouts/new` and `/reservations/new` at desktop and mobile widths, including a warning/conflict scenario if local data supports it.

## Risks
- Availability warnings are advisory in the UI, but server enforcement remains authoritative. The UI must not imply that a hard conflict is overridden at submit.
- `EquipmentPicker` is shared with booking-detail equipment editing, so selection-state additions must remain optional and backward compatible.
- Browser smoke may be limited if the local database credentials or seed data block authenticated create-flow access.

## Non-Goals
- No schema changes.
- No kiosk custody rule changes.
- No broad rewrite of the wizard or picker.
- No server-side availability relaxation.
- No new event-link editing after booking creation.

## Review
- Shipped: Step 1 now has a compact event-linked/ad hoc context panel with selected-event count, derived window, location preview, and direct ad hoc recovery from empty event states.
- Shipped: `EquipmentPicker` now reports selected next-use and turnaround warning counts, and Step 2 separates valid items, unavailable selections, hard conflicts, next-use notices, and turnaround warnings.
- Shipped: Step 3 repeats availability warnings before submit and the success toast names the highlighted booking destination after creation.
- Verified: `npx vitest run tests/booking-create-ux.test.ts tests/create-booking.test.ts tests/booking-create-validation.test.ts`
- Verified: `npx tsc --noEmit`
- Verified: `npm run db:migrate:check`
- Verified: `git diff --check`
- Verified: `npx next build`
- Verified: authenticated in-app browser smoke on `/checkouts/new` and `/reservations/new` at desktop and 390px mobile widths. Checkout smoke also reached Step 2, selected one item, and reached the confirmation handoff screen.
- Deferred: No schema, kiosk custody, or server availability rule changes. A live conflict/warning browser scenario was not forced because the visible local smoke selection had no advisory warnings; helper coverage exercises hard-conflict, next-use, and turnaround warning states.
