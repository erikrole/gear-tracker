# Item Detail Identity Firmware Refresh Plan

Started: 2026-06-10

## Goal
Fold item firmware into the admin identity block under QR and serial, rename Scan identity to Identity, and polish the surface so QR, serial, firmware status, and source/update actions read as one coherent identity cluster.

## Checklist
- [x] Rename the admin Scan identity section to Identity.
- [x] Move firmware badge/status/link into the Identity surface beneath QR and serial.
- [x] Refresh Identity spacing, hit areas, and visual hierarchy against the provided screenshot.
- [x] Sync Items docs/tasks and run focused tests, TypeScript, migration check, browser smoke, whitespace, and build.

## Review
- 2026-06-10: The admin identity block now renders QR, serial, and firmware as one compact definition-list surface with the QR preview on the right.
- 2026-06-10: Firmware no longer renders as a nested card. The row shows only the compact installed-firmware badge; clicking the badge opens the cleaned-up modal with current firmware, newest firmware, checked date, release date, source link, and update actions.
- 2026-06-10: Authenticated browser smoke on real FX3 item `cmmvmbdhe001hjx04hb39a7mk` confirmed the row layout and modal contents with no current-page console warnings/errors. The smoke did not save or mutate firmware.
