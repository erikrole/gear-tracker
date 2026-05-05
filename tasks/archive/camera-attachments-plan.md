# Camera Attachments Plan

Last updated: 2026-05-05

## Goal
Clarify and implement the camera attachment model for SD cards, cages, and fixed camera parts while preserving numbered bulk tracking for QR-coded batteries.

## Implementation
- [x] Add shared attachment classification/display helpers for SD cards, camera cages/rigs, and misc attached parts.
- [x] Rename item detail accessory UI to Attachments and group parent-camera children by attachment type.
- [x] Show camera-slot context for attached SD cards on child item detail and scan lookup preview.
- [x] Document the SD card attachment rule and battery numbered-bulk rule in area docs and decisions.
- [x] Verify type checks/tests/build for the changed surface.

## Review
- Shipped camera attachment display without schema changes: camera-slot SD cards and fixed parts remain child assets, while QR-coded batteries remain numbered bulk units.
- Verified with focused attachment helper tests, TypeScript, migration-prefix check, and local Next build. `npm run build` still stops at remote Prisma migrate deploy without DB approval.
