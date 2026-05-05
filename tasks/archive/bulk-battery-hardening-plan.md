# Bulk Battery Hardening Plan

Date: 2026-05-05

## Settled Rules

- Batteries are separate numbered bulk inventory, not camera attachments.
- Kits may include battery quantities as saved presets, but pickup assigns the actual unit numbers.
- Booking creation selects battery quantity only.
- Kiosk pickup/check-in scans bind and return specific battery units one by one.
- Battery compatibility warnings are based on camera model in V1.
- Chargers remain optional gear.
- `AVAILABLE`, `CHECKED_OUT`, `LOST`, and `RETIRED` remain the unit statuses.
- Admins can manually mark units lost.
- Retired/lost units remain visible in admin unit views until admin action removes or hides them.
- Unit QR values stay derived from the parent SKU QR plus unit number; visible label text should be just the unit number.
- Global lookup should resolve unit QR scans and show parent SKU plus unit status.
- Available quantity for numbered batteries derives from available units.
- Low battery warnings use available units, defaulting to a threshold of 10 when SKU threshold is lower or unset.
- Audit/reporting improvements are deferred.

## Checklist

- [x] Add kiosk pickup support for derived numbered bulk unit QR scans.
- [x] Add kiosk check-in support for returning one numbered bulk unit at a time.
- [x] Add global kiosk lookup support for numbered bulk unit QR scans.
- [x] Add booking creation low-battery compatibility warning for selected camera models.
- [x] Add focused tests for unit scan services and compatibility warnings.
- [x] Update bulk inventory, kiosk, checkout, scan, and decision docs.
- [x] Run focused tests, TypeScript, migration-prefix check, local Next build, and whitespace verification.

## Review

- Kiosk pickup and check-in now accept numbered battery unit QR scans and update one unit at a time.
- Kiosk scan lookup resolves battery unit QR values to the parent SKU, unit number, status, holder, and due date when checked out.
- Booking creation keeps batteries quantity-only, downgrades the old hard gate to a warning, and shows low compatible battery availability warnings for selected camera models.
- Verification passed: focused Vitest tests, TypeScript, migration-prefix check, local Next build, and whitespace check.
