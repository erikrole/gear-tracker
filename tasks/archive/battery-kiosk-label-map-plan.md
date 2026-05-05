# Battery Kiosk Label Mapping Plan

Date: 2026-05-05

## Scope

- Make iOS kiosk pickup/return checklists include numbered battery units.
- Confirm pickup only after all serialized items and requested battery units are scanned.
- Map current camera bodies to available battery SKUs for creation warnings.
- Improve the bulk unit QR tab for Brother P-Touch D610BT number-first labels.
- Pin battery reporting for a later slice.

## Checklist

- [x] Harden kiosk checkout detail API for pending pickup and return bulk units.
- [x] Harden kiosk pickup confirm so planned battery quantities must be scanned.
- [x] Update iOS kiosk labels/counts where the API already provides bulk quantities.
- [x] Query current inventory read-only and update camera model battery compatibility rules.
- [x] Update unit QR tab label copy/layout for Brother P-Touch number-first printing.
- [x] Add focused tests and docs.
- [x] Run verification gates.

## Review

- Kiosk detail payloads now include pending battery quantity slots and checked-out battery units.
- Kiosk pickup confirm now blocks until all planned battery units are scanned.
- iOS pickup subtitles count serialized items plus bulk quantities.
- Compatibility rules now match the current import snapshot for Sony NP-FZ100 bodies and Sony BP-U FX6 bodies; direct Neon read was unreachable in this environment, so the Cheqroom import snapshot was used.
- Brother P-Touch unit labels now emphasize the plain unit number while keeping the derived QR value encoded.
- Battery audit/reporting is pinned as GAP-37 for a later slice.
- Verification passed: focused Vitest tests, TypeScript, migration-prefix check, local Next build, iOS simulator build, and whitespace check.
