# iOS App Intents Hardening Plan

## Scope

Audit and harden the shipped App Intents surface without adding background
mutations or changing the kiosk-owned custody boundary.

## Verified gaps

- Open-app actions used deprecated `openAppWhenRun` metadata.
- Private checkout, shift, and booking data did not request system
  authentication before execution.
- Booking fields were display-only instead of structured entity properties.
- Booking query failures could collapse into empty results.
- Capability-denied navigation could remain queued in `AppState`.
- `OpenBookingIntent` used a generic intent instead of the system open contract
  and was absent from App Shortcuts.

## Completed slice

- [x] Move open-app actions to immediate foreground execution.
- [x] Require authentication for private operational data.
- [x] Expose focused booking entity properties and actionable query errors.
- [x] Adopt `OpenIntent` and add a direct Open Booking shortcut.
- [x] Clear denied routing requests.
- [x] Add focused source-contract coverage and sync Mobile area truth.

## Boundaries

- No booking, checkout, return, shift, or custody mutation.
- No new API route, schema, widget, control, or Spotlight index.
- No change to the native tab hierarchy or existing destination ownership.
