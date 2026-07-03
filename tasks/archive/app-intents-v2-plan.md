# App Intents v2 — Siri Answers + Booking Entity

## Context

The v1 slice (shipped 2026-07-03, AREA_MOBILE change log) exposed four open-app
navigation intents (Scan, My Gear, Schedule, Create Reservation) routed through
`GearTrackerAppIntentHandoff`. Nothing answers a question without launching the
app, and no entity exists for Shortcuts to parameterize over. The iOS framework
roadmap memory lists AppIntents phase 2 as "Siri shortcuts + widget support".

## Scope (this slice — iOS only, no schema/API changes)

1. **Background query intents** (no app launch, `ProvidesDialog + ShowsSnippetView`):
   - `MyCheckedOutGearIntent` — "What gear do I have out?" Fetches
     `me()` → `checkouts(activeOnly: true, requesterId: me.id)`; dialog
     summarizes items out / overdue / next due-back; snippet lists checkouts
     with due times, overdue flagged via status tokens.
   - `NextShiftIntent` — "When's my next shift?" Fetches `myShifts()`, picks
     the current-or-next shift; dialog covers event, call time, location; the
     snippet adds area + gear status (`ShiftGear.gearLabel`).
   - Signed-out → typed intent error ("Open the app and sign in first").
2. **`BookingEntity` + `OpenBookingIntent`**:
   - `AppEntity` over `Booking` (id, title, kind, status, window, item summary)
     with `EntityStringQuery`: identifiers via `booking(id:)`, string match via
     `q=` search on active reservations + checkouts, suggestions = my active
     bookings.
   - `OpenBookingIntent(booking:)` reuses the push deep-link path
     (`pendingPushBookingId` → HomeView booking sheet), with a cold-launch
     mirror on `GearTrackerAppIntentHandoff` like v1 destinations.
3. **App Shortcuts registration** for the two query intents (6 of 10 slots used).

## Out of scope (later slices)

- Widgets / due-back countdown widget (needs a widget-extension intents split).
- Mutation intents (extend booking, claim trade) — deliberate: custody actions
  stay in kiosk per `project_scan_role`.
- Interactive snippets (iOS 26 SnippetIntent) — revisit once query intents prove out.

## Files

- `ios/Wisconsin/App/AppIntentsData.swift` (new) — query intents + snippet views + error enum
- `ios/Wisconsin/App/BookingEntity.swift` (new) — entity, query, OpenBookingIntent
- `ios/Wisconsin/App/AppIntents.swift` — handoff booking-id mirror, shortcuts registration
- `ios/Wisconsin/Views/AppTabView.swift` — consume cold-launch booking id
- `xcodegen generate` after new files; verify entitlements survive (now declared in project.yml)

## Verification

- `npm run ios:xcode:verify` (simulator build) green
- Doc sync: AREA_MOBILE.md change log entry

## Status

- [x] Plan written
- [x] Implementation
- [x] Build verified (`IOS_SKIP_DEVICE_BUILD=1 npm run ios:xcode:verify` — passed)
- [x] Docs synced (AREA_MOBILE.md change log), committed, pushed

## Review

Shipped in one slice as planned. Notes:
- Entitlements are now declared in `ios/project.yml` (`properties:` block), so
  xcodegen no longer wipes them — the old restore-after-generate step is dead.
- `entities(for:)` tolerates stale booking ids (`try?` per id) so saved
  Shortcuts don't hard-fail after a booking completes/cancels.
- Snippet views intentionally use system fonts (Gotham isn't guaranteed to
  render in out-of-process snippet archives) and `Color.statusText` tokens.
