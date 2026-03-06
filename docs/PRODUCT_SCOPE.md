# Gear Tracker Product Scope Index

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Product: Gear Tracker
- Last Updated: 2026-03-02
- Status: Living index
- Purpose: route planning work to focused area files so implementation agents can load only relevant context

## Product Mission
Replace Cheqroom with an athletics-first, event-driven gear system for Wisconsin Athletics Creative across Camp Randall Stadium and Kohl Center.

## Core Invariants
1. Asset status is derived from active allocations, never authoritative stored status.
2. Booking integrity protections remain intact (SERIALIZABLE + overlap prevention).
3. Audit logging integrity is preserved for every mutation path.
4. Mobile-first usability remains a baseline requirement.

## Area Files
1. Dashboard: `AREA_DASHBOARD.md`
2. Items: `AREA_ITEMS.md`
3. Checkouts: `AREA_CHECKOUTS.md`
4. Reservations: `AREA_RESERVATIONS.md`
5. Events: `AREA_EVENTS.md`
6. Notifications: `AREA_NOTIFICATIONS.md`
7. Platform Integrity: `AREA_PLATFORM_INTEGRITY.md`
8. Users: `AREA_USERS.md`
9. Importer: `AREA_IMPORTER.md`
10. Mobile Operations: `AREA_MOBILE.md`

## Phase Sequence Across Areas
1. Phase A (Now): Checkouts + Events + Items foundation.
2. Phase B (Next): Dashboard expansion + Notifications escalation + Picker improvements.
3. Phase C (Later): Templates, kiosk, board, analytics, and integrations.

## Immediate Brief Queue
1. Checkout UX v2 (event-default creation flow).
2. B&H metadata enrichment (safe prefill and image-source handling).
3. Event sync phase 1 (ICS ingest and booking linkage).
4. Student-first mobile operations hardening (dashboard, lists, scan parity).

## Implementation Brief Files
1. Checkout UX V2: `BRIEF_CHECKOUT_UX_V2.md`
2. Reservations Lifecycle V1: `BRIEF_RESERVATIONS_V1.md`
3. Items List + Create + Detail V1: `BRIEF_ITEMS_V1.md`
4. Cheqroom CSV Importer V1: `BRIEF_CHEQROOM_IMPORTER_V1.md`

## Working Rule for Claude Sessions
1. Load only the relevant `AREA_*.md` file.
2. Load `DECISIONS.md` only for invariants that affect the change.
3. Use `FEATURE_BRIEF_TEMPLATE.md` to scope the request before implementation.
4. For role or visibility changes, always include `AREA_USERS.md`.
5. For dashboard, list, or scan changes that touch phone UX, include `AREA_MOBILE.md`.

## Sync Checklist (Required Per Scope Update)
1. Update `DECISIONS.md` if behavior changes a durable rule.
2. Update relevant `AREA_*.md` files in the same pass when shared behavior changes.
3. Confirm role effects in `AREA_USERS.md` for any action or visibility change.
4. Confirm mobile effects in `AREA_MOBILE.md` for any dashboard, reservations, check-outs, or items change.
5. Update affected `BRIEF_*.md` files when acceptance criteria or file scope changes.

## Change Log
- 2026-03-01: Converted monolithic scope doc into area-index model.
- 2026-03-01: Added standalone users and permissions area file.
- 2026-03-01: Added implementation brief file index for checkout and reservation hardening work.
- 2026-03-01: Added items implementation brief file.
- 2026-03-01: Added importer area and Cheqroom CSV importer brief.
- 2026-03-02: Added mobile operations area and scope-sync checklist.
