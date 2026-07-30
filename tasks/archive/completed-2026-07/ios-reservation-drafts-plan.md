# iOS Reservation Drafts (Minimize-to-Card)

Status: complete 2026-07-28 (base workflow and hardening follow-up shipped)
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

## Hardening Follow-up — 2026-07-28

### Goal

Keep every draft transition honest under network failure, enforce the same
reservation/checkout permission boundary as final creation, and remove a source
draft atomically when its reservation is created.

### Stop Conditions

- Stop if draft authorization cannot preserve both reservation and checkout draft
  callers through the current permission matrix.
- Stop if source-draft cleanup cannot remain inside the existing serializable booking
  creation transaction.
- Stop if testability would require replacing the app-wide API client rather than a
  narrow draft persistence boundary.

### Slices

- [x] Make save, save-and-start, discard, and cleanup transitions conditional on
  successful persistence while keeping recoverable work visible.
- [x] Gate draft reads and mutations by booking kind and collaborator capability,
  force student/collaborator reservation drafts to self, and write transactional
  create/update/delete audit entries.
- [x] Accept an owned source draft during reservation creation and delete it inside
  the booking creation transaction.
- [x] Replace source-only failure assertions with executable Swift store tests and
  route tests for permission, requester, audit, and atomic cleanup behavior.
- [x] Sync area docs, risks, and this ledger to verified shipped reality.

### Verification

- [x] Focused Drafts route and iOS contract tests.
- [x] Native Swift unit tests for failed save/discard transition behavior.
- [x] `npx tsc --noEmit --pretty false`.
- [x] `npm run lint`.
- [x] `npm run codemap` and `npm run verify:docs`.
- [x] `npm run db:migrate:check`.
- [x] `npm run drift:ios` and `npm run audit:ios:gaps`.
- [x] `npm run ios:project:check`.
- [x] `npm run build:app`.
- [x] Xcode build for `Wisconsin` and affected test target.
- [x] `git diff --check`.

### Review

- Shipped: recoverable iOS transition failures, permission- and capability-gated
  draft persistence, transactional draft audit history, and atomic source-draft
  consumption during reservation creation.
- Verified: 2,693 Vitest tests, 4 native draft-store XCTest cases, TypeScript,
  ESLint, docs, migration state, iOS project/drift/audit checks, Next.js production
  build, and Wisconsin simulator build.
- Deferred: authenticated visual failure injection; executable store tests cover
  the network-failure state transitions without requiring a manipulated live API.
- Blocked: none.
- Proof artifacts: XcodeBuildMCP simulator test and build logs; repository command
  output recorded in the completing task.
- Next slice or stop: stop. The audited Drafts gaps are closed.
