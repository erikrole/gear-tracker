# iOS Reservation Drafts (Minimize-to-Card)

Status: shipped 2026-07-28 (see `docs/AREA_MOBILE.md` change log)
Surface: Native iOS (`ios/Wisconsin`)
Related: `docs/AREA_MOBILE.md`, `docs/AREA_RESERVATIONS.md`, `src/app/api/drafts`

## Problem

`CreateBookingSheet` is a modal dead end. Once it is open the user cannot check an
item's detail, a linked event, or their existing bookings without losing everything
they typed. Cancel is all-or-nothing: a `Discard reservation?` dialog with no way to
keep the work.

The web already solves the persistence half of this. `/api/drafts` (GET list, POST
save/update, GET `/[id]`, DELETE) stores in-progress bookings as `Booking` rows with
`status = DRAFT`, and `use-draft-management.ts` + `BookingWizard` + the dashboard let
web users save and resume. iOS has no client for any of it.

## Shape

Apple Mail's compose model, scoped to reservations:

1. **Minimize** — swipe down or tap the minimize control on the reservation sheet. The
   sheet closes; a compact card takes its place at the bottom of the app shell and the
   composer stays alive in memory (step, gear selection, conflict results, everything).
   The user browses any tab. Tapping the card reopens the sheet exactly where it was.
2. **Exit** — Cancel with real input asks: **Save Draft**, **Discard**, or **Keep
   Editing**. Save Draft writes through the existing `/api/drafts` contract.
3. **Resume** — a saved draft is a `DRAFT` booking, so it already appears in the
   Bookings list and on the web dashboard. On iOS the newest reservation draft also
   restores as the bottom card at launch, so the fast path is one tap.

## Decisions

- **Server drafts, not local persistence.** Reuse `/api/drafts`. A draft started on
  iOS is finishable on web and vice versa, and drafts stay auditable `Booking` rows.
  No new schema, no migration.
- **One live composer at a time.** The card is a single slot. Starting a second
  reservation while one is live prompts: save the current as a draft and start new,
  discard and start new, or keep editing. Saved drafts remain reachable from the
  Bookings list, so "save and start new" loses nothing.
- **Root-level presentation.** The sheet moves from five call sites to `AppTabView`,
  because a minimized draft must survive tab switches and navigation pops. Verified
  that no current call site is itself inside a presented sheet, so a root sheet does
  not stack on an existing presentation.
- **Uniform post-create routing.** With the sheet global, per-call-site push
  navigation is wrong (the originating stack may be gone). Creation now routes to
  Bookings → booking detail via `AppState.pendingBookingDetailId`. Call sites keep
  only non-navigating side effects (`EventDetailView`'s "Gear reserved" line).
- **Native accessory chrome.** The card uses `tabViewBottomAccessory` (iOS 26) rather
  than a hand-placed overlay, per the repository UI contract.
- **Autosave on background.** Scene phase `.background` with a live composer that has
  input saves a draft silently and keeps composing. Insurance against task kills.

## Slices

1. Draft models + `APIClient` methods for the four `/api/drafts` operations.
2. `CreateBookingViewModel`: baseline/dirty tracking moved off the view, draft payload
   builder, draft-detail apply.
3. `ReservationDraftStore`: composer ownership, presentation phase, save/discard/
   resume/autosave, start-conflict arbitration.
4. `CreateBookingSheet` rewired to the store; minimize control; three-way exit dialog.
5. `ReservationDraftCard` + `AppTabView` hosting (sheet, accessory, routing).
6. Call-site migration (`BookingsView`, `ItemsView` ×2, `ItemDetailView`,
   `EventDetailSheet`, `ScannerDebuggerView`).
7. Source-contract test + Xcode build + simulator proof.

## Verification

- `xcodebuild` for the `Wisconsin` target.
- `tests/ios-reservation-drafts-contract.test.ts` source-contract coverage.
- Simulator screenshots: composing → minimized card → browse → reopen → exit dialog.
- `xcodegen generate` after the new Swift files, then git-diff-verify the project file
  and entitlements.
