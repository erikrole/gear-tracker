# Audit: bookings (iOS) — 2026-04-24

**MVP verdict (post-fix, pre-Xcode-verify):** all P0 + P1 addressed; needs build verification.
**Original verdict:** NOT READY — 1 P0, 6 P1
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

Scope: `BookingsView` list (Reservations / Checkouts tabs) + `BookingDetailView` + `CreateBookingSheet` + `ExtendBookingSheet` + `EditBookingSheet`.

## P0 — blocks MVP

- [x] [Flows] Tab switch silently drops the new load when a previous load is still in flight — user sees stale data from the old tab with no spinner.
      `ios/Wisconsin/Views/BookingsView.swift:23` (`guard !isLoading else { return }`) combined with `ios/Wisconsin/Views/BookingsView.swift:124` (`onChange(of: vm.tab) { Task { await vm.load(reset: true) } }`)
      Why it blocks ship: in front of a class, a fast tab tap during a slow network leaves Reservations rows visible while the user has tapped Checkouts. No pull-to-refresh hint, no error. Wrong-data risk during checkout actions taken from the next screen.
      Suggested fix: cancel the in-flight task on tab change (store the `Task` handle in the VM, `cancel()` before starting the new one), or queue a re-load when `isLoading` was true on entry.

## P1 — polish before ship

- [x] [Hardening] No role gating on the `+` create button or the EditBookingSheet button — STUDENT users see admin/staff affordances.
      `ios/Wisconsin/Views/BookingsView.swift:127-131` (toolbar `+` always shown when tab is `.reservations`); `ios/Wisconsin/Views/BookingDetailView.swift:65-69` (pencil edit button always shown); `OptionPickerView` for "Requester" lists every user from `formOptions` (`CreateBookingSheet.swift:222-225`).
      Why it matters: AREA_MOBILE.md AC-5 requires role-adaptive visibility matching `AREA_USERS.md`. A student tapping `+`, picking another user, and submitting hits a server 403 — confusing in front of a class.
      Suggested fix: gate the toolbar `+` and the requester picker on `session.currentUser?.role` (`STAFF`/`ADMIN` see all users; `STUDENT` is locked to self and the requester row becomes a read-only label). Hide the pencil edit affordance when the current user is neither owner nor staff.

- [x] [Breaking] Pagination errors are swallowed visually — `vm.error` is set but the UI only renders the error block when `vm.bookings.isEmpty`.
      `ios/Wisconsin/Views/BookingsView.swift:50-52` writes `error`; `BookingsView.swift:79` only shows it when the list is empty.
      Why it matters: scrolling near the end while on a flaky network silently fails. The trailing `ProgressView()` keeps spinning forever (line 109-115) because `hasMore` stays true and no error is surfaced.
      Suggested fix: replace the trailing spinner row with a state that switches to an inline error + Retry when the last load failed; clear `error` on successful append.

- [x] [Flows] Edit / Create sheets dismiss with no "discard changes?" confirmation — accidental Cancel after a long note or asset-pick session destroys input silently.
      `ios/Wisconsin/Views/BookingDetailView.swift:181-183` (EditBookingSheet Cancel); `ios/Wisconsin/Views/CreateBookingSheet.swift:172-178` (Cancel always closes; step 2 Back also abandons selections without warning).
      Why it matters: AREA_MOBILE.md "Performance and Reliability — preserve drafts and pending intent where feasible." This is the silent-data-loss class.
      Suggested fix: when `hasChanges` (or selections present), wrap Cancel in a `confirmationDialog`. Step-2 Back should preserve `selectedAssetIds` (it currently does, good — but also gate Cancel from step 2 the same way).

- [x] [Hardening] CreateBookingSheet's Cancel button stays enabled during submit, and the Create button has no `isSubmitting` disable on the path where it matters.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:172-178` and `:188-196`.
      Why it matters: dismissing mid-`createReservation` orphans the request; the `onCreated` callback fires after dismiss, navigation `append(newId)` lands on a torn-down stack.
      Suggested fix: disable Cancel when `vm.isSubmitting`; treat Cancel-during-submit as a no-op until the task settles.

- [x] [UI polish] FormCard shadow uses hardcoded `Color.black.opacity(...)` — invisible in dark mode and the cards lose their lift.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:419-421` (`FormCard`).
      Why it matters: cards become flat panels in dark mode; AREA_MOBILE.md row-card contract relies on visual lift to separate sections.
      Suggested fix: use `Color.primary.opacity(0.06)` or a `.shadow` style that adapts; or drop the shadow in favor of a subtle border in dark mode.

- [x] [UI polish] AssetPickerRow border uses hardcoded `Color.black.opacity(0.08)` — disappears in dark mode.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:361`.
      Suggested fix: replace with `Color(.separator)` or `Color.primary.opacity(0.1)`.

- [x] [Flows] EditBookingSheet does not call `onSaved()` until after dismiss, but the success path is gated on a non-throwing API — if `updateBooking` throws after partial success on the server, the sheet stays open with no toast on the parent.
      `ios/Wisconsin/Views/BookingDetailView.swift:193-209`.
      Why it matters: edit succeeded but error path interpretation is brittle — user sees an error in the sheet while the parent has stale title.
      Suggested fix: pass the updated booking back through `onSaved` or call `loadBooking` from parent; either is already wired (`onSaved: { Task { await loadBooking() } }`), so just verify ordering.

## P2 — post-MVP

- [x] [UI polish] `nextCleanHour` rewritten to take `addingHours:` with explicit semantics (0 = next `:00`).

- [ ] [Parity] **Deferred to follow-up slice.** Web Bookings list supports status scope filters (DRAFT / BOOKED / OPEN / OVERDUE / CANCELLED / COMPLETED) and column sorting; iOS list is `activeOnly: true` only. Needs new API params on `reservations`/`checkouts` clients + filter UI. Tracked.

- [ ] [Parity] **Deferred to follow-up slice.** Web detail surfaces an Equipment conflict badge per AREA_RESERVATIONS AC-8; iOS `ItemsSection` shows allocation status only. Needs `/api/availability/check` API client + per-row badge wiring. Tracked.

- [x] [UI polish] Toolbar Picker now uses `maxWidth: 260` + `fixedSize(horizontal: false)` so it shrinks on narrower devices instead of clipping.

- [x] [Flows] Trailing pagination switched to `.task(id: vm.bookings.count)` (addressed in P0 fix).

## Acceptance criteria status

AREA_MOBILE.md:
- [x] AC-1 — Dashboard banner + tab/quick-create reach due/overdue in two taps (verified out-of-scope here; covered in dashboard audit).
- [x] AC-2 — list supports search + scope (tab) + row→detail (`BookingsView.swift:122,153-158`).
- [x] AC-3 — overdue red treatment present in row + detail header (`BookingsView.swift:195`, `BookingDetailView.swift:232-240`).
- [x] AC-4 — Scan one-tap (covered by scan audit, not bookings).
- [x] AC-5 — iOS now hides the `+` button when no session, locks the requester picker to self for STUDENT, and hides the EditBookingSheet pencil unless STAFF/ADMIN or the requester owns the booking in DRAFT/BOOKED state.
- [x] AC-6 — list is action-first, not chart-first.

AREA_RESERVATIONS.md (iOS surface only):
- [x] AC-3 — OPEN cannot be canceled (UI gates correctly: `BookingDetailView.swift:386-411`).
- [x] AC-6 — Terminal states immutable: ActionsSection only renders for `.booked / .pendingPickup / .open` (`BookingDetailView.swift:41`).
- [x] AC-9 — actions menu matches state (`BookingDetailView.swift:380-411`).
- [ ] AC-10 — list scope/sort: iOS supports active-only + search; sort + extended status scope not implemented (P2 parity).
- [ ] AC-8 — conflict badges on equipment: iOS shows allocation only (P2 parity).

AREA_CHECKOUTS.md (iOS surface only):
- [x] AC-3 — state-based actions enforced (matches detail view).
- [x] AC-5 — Extend flow uses `ExtendBookingSheet` with `in: currentEndsAt...` (`ExtendBookingSheet.swift:34`).
- [x] AC-6 — role gating relies on server; UI hiding is the P1 above.

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- `docs/AREA_MOBILE.md`
- `docs/AREA_RESERVATIONS.md` (acceptance + state matrix sections)
- `docs/AREA_CHECKOUTS.md` (acceptance + state matrix sections)
- `ios/Wisconsin/Views/BookingsView.swift`
- `ios/Wisconsin/Views/BookingDetailView.swift`
- `ios/Wisconsin/Views/CreateBookingSheet.swift`
- `ios/Wisconsin/Views/ExtendBookingSheet.swift`
- `ios/Wisconsin/Models/Models.swift` (Booking, BookingEvent, Status enums)
- `ios/Wisconsin/Core/APIClient.swift` (booking endpoints)
- `ios/Wisconsin/Core/GearStore.swift` (CachedBooking seeding)
- `ios/Wisconsin/Core/SessionStore.swift` (role surface)

## Notes
- Static audit only — Xcode build / simulator runs were not performed. User must verify in Xcode before declaring fixes shipped.
- `DECISIONS.md` and `GAPS_AND_RISKS.md` were not opened in this pass; if either has a bookings-iOS-specific entry, recheck before fixes.
- Cache (`GearStore.cachedBookings(kind:)`) is unscoped by user — fine for V1 (per-device single-user) but worth noting if multi-user iPad sharing returns.
