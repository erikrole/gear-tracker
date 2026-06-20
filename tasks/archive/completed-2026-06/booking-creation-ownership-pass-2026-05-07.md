# Booking Creation Ownership Pass - 2026-05-07

## Goal
- Make checkout and reservation creation resilient across event-linked, ad hoc, multi-event, and draft-resume paths without changing the shipped wizard model.

## Peer patterns checked
- Bookings list: URL and deep-link state must survive across the booking surface.
- Items detail forms: inline recovery paths should preserve user-entered context instead of forcing a restart.
- Schedule/events: event-linked operations need enough future range for real planning, not only near-term events.
- Items list: use quiet shadcn toolbar/control rhythm, `PageHeader`, `Button` variants, `Switch`, `ToggleGroup`-style segmented steps, exact transitions, and dense bordered surfaces instead of bespoke wizard chrome.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [x] Event detail gear shortcuts: keep using `requesterUserId` and event context deep links into the wizard.
- [x] Future event creation helpers: reuse the 30-day booking event window unless a narrower operational flow is intentional.

## Review
- Shipped: checkout/reservation creation now loads a 30-day event window, labels the window consistently, and saves draft event links through `/api/drafts` with ordered `BookingEvent` rows. Draft resume now returns ordered `events[]` and restores `selectedEvents` in the wizard.
- Verified: `npx tsc --noEmit`, focused Vitest coverage for draft routes and booking creation, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools smoke checks on `/checkouts/new` and `/reservations/new`.
- Deferred: no additional propagation needed in this slice; the event detail/requester deep-link behavior was preserved rather than changed.

## Item-list styling follow-up
- [x] Replace bespoke creation header with the shared `PageHeader` pattern.
- [x] Replace raw toggle, step buttons, and draft dismiss button with shadcn `Switch`/`Button` composition.
- [x] Move Step 1 form rhythm toward the item form/list standard: shared `Label`, bordered quiet surfaces, exact transitions, no `transition-all`, and fewer inline styles.
- [x] Carry the same section-heading and shadcn alert treatment through Step 2 and Step 3.
- [x] Re-run type, focused booking tests, whitespace, build, and browser smoke on checkout/reservation creation.

## Item-list styling review
- Shipped: booking creation now follows the Items list/header/form rhythm more closely: `PageHeader`, shadcn `Badge`, `Button`, `Switch`, shared `SectionHeading`, item-style `FormRow`/`FormRow2Col`, quiet bordered card surfaces, and exact transition classes.
- Verified: browser smoke passed on `/checkouts/new` and `/reservations/new` with no console messages after label association fixes.
- Deferred: the `EquipmentPicker` internals remain unchanged because they are shared with booking detail editing and already have their own picker roadmap.

## Item picker and flow follow-up
- [x] Hydrate preselected/deep-linked assets even when they are outside the currently loaded picker section.
- [x] Move picker tabs, search, selected shelf, empty/error states, and quantity controls onto shadcn/ui composition where local components already exist.
- [x] Restore scan-to-add entry from the shipped picker brief without leaving the booking creation flow.
- [x] Let users review a valid selection from Step 2 without forcing a pass through every equipment section.
- [x] Re-run type, focused booking tests, whitespace, build, and browser smoke on checkout/reservation creation.

## Item picker and flow review
- Shipped: `EquipmentPicker` now hydrates selected asset IDs through `/api/assets/picker-search?ids=...`, uses shadcn `Tabs`, `Input`, `Checkbox`, `Button`, `Item`, and `Empty` primitives, restores in-step scan-to-add, adds select-visible/clear-section/clear-all selection controls, and lets Step 2 advance to review once a valid selection exists.
- Verified: `npx tsc --noEmit`, focused booking Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools smoke checks on `/checkouts/new` and `/reservations/new`. Browser smoke covered Step 2 render, checkbox selection, review-first navigation, scan panel rendering, and deep-linked `newFor` asset hydration from a non-active section.
- Deferred: generic picker abstraction remains deferred because this component is still tightly coupled to booking creation and booking-detail equipment editing.

## Item picker hardening follow-up
- [x] Run availability preview against visible section assets plus selected assets, so conflict badges and select-visible behavior are truthful before selection.
- [x] Keep conflicting serialized assets selectable with warning badges; only true status/eligibility problems disable selection.
- [x] Preserve search text per equipment section instead of clearing search on every tab switch.
- [x] Let booking detail equipment edit pass its booking id into the picker so conflict preview excludes the booking being edited.
- [x] Re-run type, focused booking tests, whitespace, build, and browser smoke on checkout/reservation creation.

## Item picker hardening review
- Shipped: picker availability checks now preview the visible section plus selected assets in one batched `/api/availability/check` call, section searches persist independently, conflict-warning rows remain selectable, and booking detail equipment edits exclude their own booking from conflict preview.
- Verified: `npx tsc --noEmit`, focused booking Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, local HTTP route checks, and Arc smoke checks. Browser smoke covered authenticated checkout creation, deep-linked selected asset hydration into Step 2, review-first navigation availability, per-section search persistence after tab switching, and authenticated reservation creation render with requester/location prefilled.

## Item picker stale-selection follow-up
- [x] Make unresolved selected asset IDs visible and removable in the picker shelf.
- [x] Count only resolved serialized assets plus bulk quantities for Step 2 review readiness and confirmation counts.
- [x] Re-run focused type/tests/whitespace/build and browser smoke for stale `newFor` recovery.

## Item picker stale-selection review
- Shipped: stale `newFor` or draft asset IDs now show as removable unavailable selected rows, and they no longer satisfy review readiness, confirmation counts, draft saves, or create payloads unless the picker resolves the asset.
- Verified: `npx tsc --noEmit`, focused booking Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Arc smoke with a stale `newFor` value. Browser smoke confirmed the unresolved item row rendered with a remove action and Step 2 stayed in browse mode instead of allowing review from only the stale ID.

## Step 2 UX polish follow-up
- [x] Add a compact valid/warning/unavailable selection summary above the picker.
- [x] Make the footer CTA state-aware for valid selections, warning selections, and unresolved-only selections.
- [x] Re-run type, focused booking tests, whitespace, build, and browser smoke on checkout/reservation creation.

## Step 2 UX polish review
- Shipped: Step 2 now reports picker selection state up to the wizard, shows valid item, conflict-warning, unavailable, and availability-checking status in one compact strip, and changes the primary footer copy to "Review with warnings" or "Remove unavailable item" when that better explains the next action.
- Verified: `npx tsc --noEmit`, focused booking Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools smoke on checkout/reservation creation. Browser smoke covered unresolved-only `newFor` recovery, valid item selection changing the footer to review, and a clean no-stale checkout Step 2 console.

## Final-screen polish follow-up
- [x] Add outcome-first confirmation copy for checkout and reservation creation.
- [x] Make checkout submit language match the actual kiosk handoff model.
- [x] Re-run type, focused booking tests, whitespace, build, and browser smoke on checkout/reservation final review.

## Final-screen polish review
- Shipped: Step 3 now leads with a compact handoff panel that names the next action, location, and timing. Checkout copy says the record becomes a pending pickup until kiosk scan, while reservation copy says the gear is held and staff can start checkout when handoff begins. Checkout submit now says "Create pickup" instead of implying pickup completes on desktop.
- Verified: `npx tsc --noEmit`, focused booking Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools smoke on checkout/reservation final review. Browser smoke confirmed checkout shows kiosk-pickup expectations and "Create pickup"; reservation shows confirmed-for-later expectations and "Reserve for later".
