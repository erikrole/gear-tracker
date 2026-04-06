# Checkouts Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Checkouts (includes Reservations, Bookings unified detail, Scan, Equipment Picker)
**Overall Verdict**: Ship-ready (23/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_CHECKOUTS.md is comprehensive (291 lines) — workflow, action matrix, equipment picker, DRAFT state, bug traps, edge cases. AREA_RESERVATIONS.md adds reservation-specific behavior. Both use unified `BookingDetailPage`. All 7 checkout ACs checked. |
| Hardening | 5/5 | Extensive hardening documented: scan page (5-pass), BookingDetailsSheet (4-pass + stress test), BookingListPage (5-pass), Equipment Picker (4-pass + stress test), booking detail page (5-pass). SERIALIZABLE on all booking mutations. AbortController throughout. |
| Roadmap | 4/5 | `booking-details-sheet-roadmap.md` exists (V1/V2/V3). `item-picker-roadmap.md` covers EquipmentPicker. No dedicated checkouts-list or reservations-list roadmap, but these are simple list wrappers around BookingListPage. |
| Feature completeness | 5/5 | All checkout ACs met. Photo requirement (D-028) shipped. Unified detail page (D-002). Scan-to-add, availability preview, guidance rules. Kit integration. Overdue priority sort. Deep links from dashboard/items. |
| Doc sync | 4/5 | AREA_CHECKOUTS changelog current through 2026-03-31. AREA_RESERVATIONS last updated 2026-03-22 — missing entries for unified detail page, booking page hardening, kit integration, overdue sort, photo requirement. Reservation ACs not in checkbox format. |

## Page-by-Page Status
| Page | Route | Lines | Hardening | Issues |
|---|---|---|---|---|
| Checkouts list | `/checkouts` | 15 (wrapper) | Hardened | Thin wrapper → `BookingListPage` (393 lines, 5-pass hardened). |
| Checkout detail | `/checkouts/[id]` | 7 (wrapper) | Hardened | Thin wrapper → `BookingDetailPage` (464 lines, 5-pass + 3 UX rounds). |
| Reservations list | `/reservations` | 15 (wrapper) | Hardened | Same `BookingListPage` component. |
| Reservation detail | `/reservations/[id]` | 7 (wrapper) | Hardened | Same `BookingDetailPage`. |
| Booking detail | `/bookings` | 464 | Hardened | AbortController, 401 redirect, error differentiation, refresh-preserves-data, skeleton, tabs, inline editing. |
| BookingInfoTab | (tab) | 236 | Hardened | SaveableField rows, mixed-location alert, photos display. |
| BookingEquipmentTab | (tab) | 360 | Hardened | Checkin progress, context menus, optimistic return, scan-only checkin (D-028). |
| BookingHistoryTab | (tab) | 246 | Hardened | Cursor pagination, filter chips, natural language labels. |
| Scan page | `/scan` | 356 (+ hooks) | Hardened | 5-pass scan page hardening. AbortController, 401, spam-click guards, auto-clear feedback. Page decomposed to 251 lines (76% reduction). |
| CreateBookingSheet | (sheet) | 988 | Hardened | Event tie-in, picker integration, kit selector, Zod validation, useFormSubmit. |
| BookingDetailsSheet | (sheet) | 866 | Hardened | 4-pass + stress test. SERIALIZABLE on all mutations. AbortController on all fetches. |
| EquipmentPicker | (component) | 1334 | Hardened | 4-pass + stress test. shadcn Checkbox/Button/Badge. O(1) lookups. ARIA roles. Scan-to-add with status check. |

## API Route Status
| Route | Auth | Validation | Audit | Transaction | Notes |
|---|---|---|---|---|---|
| `GET /api/bookings/[id]` | All roles | N/A | N/A | N/A | Returns enriched detail with derived status, allowed actions. |
| `PATCH /api/bookings/[id]` | Owner/Staff+ | Zod | Yes (before/after) | Yes | If-Unmodified-Since concurrency control. |
| `POST /api/bookings/[id]/cancel` | Staff+ | N/A | Yes | SERIALIZABLE | State transition guard (prevents cancel on COMPLETED). |
| `POST /api/bookings/[id]/extend` | Owner/Staff+ | Zod | Yes | SERIALIZABLE | Overlap check before extension. |
| `POST /api/bookings/[id]/nudge` | Staff+ | N/A | Yes | No | Sends notification reminder. |
| `GET /api/bookings/[id]/audit-logs` | All roles | Cursor | N/A | N/A | Cursor pagination. |
| `POST /api/checkouts` | Staff+/Student-own | Zod | Yes | SERIALIZABLE | Full overlap + allocation in one transaction. |
| `POST /api/checkouts/[id]/scan` | Staff+/Owner | Zod | Yes | SERIALIZABLE | Records scan event with dedup. |
| `POST /api/checkouts/[id]/complete-checkout` | Staff+/Owner | N/A | Yes | SERIALIZABLE | Enforces photo requirement (D-028). |
| `POST /api/checkouts/[id]/checkin-scan` | Staff+/Owner | Zod | Yes | SERIALIZABLE | Returns individual item, updates allocation. |
| `POST /api/checkouts/[id]/checkin-bulk` | Staff+/Owner | Zod | Yes | SERIALIZABLE | Quantity-based return with guard. |
| `POST /api/checkouts/[id]/complete-checkin` | Staff+/Owner | N/A | Yes | SERIALIZABLE | Enforces photo + all items returned. |
| `POST /api/checkouts/[id]/photo` | Staff+/Owner | File | Yes | No | Camera-only capture, Vercel Blob. |
| `POST /api/checkouts/[id]/admin-override` | Admin only | N/A | Yes | SERIALIZABLE | Bypasses photo requirement. |
| `POST /api/reservations` | Staff+/Student-own | Zod | Yes | SERIALIZABLE | Full overlap check. |
| `POST /api/reservations/[id]/cancel` | Staff+ | N/A | Yes | SERIALIZABLE | State guard. |
| `POST /api/reservations/[id]/convert` | Staff+/Owner | N/A | Yes | SERIALIZABLE | BOOKED → OPEN transition. |
| `POST /api/reservations/[id]/duplicate` | Staff+ | N/A | Yes | SERIALIZABLE | Clones with new ref number. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Event-linked checkout creation | Shipped | AC-1 | Sport → event → prefill title/dates/location. |
| Ad hoc checkout (no event) | Shipped | AC-2 | Event tie-in toggle. |
| State-based action gating | Shipped | AC-3 | `booking-rules.ts` enforces per state+role. |
| Partial check-in | Shipped | AC-4 | OPEN until all items returned. Auto-complete on full return. |
| Extend with overlap detection | Shipped | AC-5 | SERIALIZABLE + conflict feedback. |
| Permission/ownership gates | Shipped | AC-6 | Server-computed `allowedActions`. |
| Audit on all mutations | Shipped | AC-7, D-007 | Before/after diffs on every mutation. |
| Equipment picker (multi-select, search, scan-to-add) | Shipped | AREA_CHECKOUTS §Picker | Sectioned flow, availability preview, guidance rules. |
| DRAFT booking state | Shipped | D-017 | Dashboard recovery, auto-save on cancel. |
| Booking reference numbers | Shipped | D-024 | CO-XXXX / RV-XXXX format. |
| Unified detail page | Shipped | D-002 | Single `BookingDetailPage` for both kinds. |
| Photo requirement (D-028) | Shipped | AREA_CHECKOUTS changelog | Camera-only capture, scan-only checkin, admin override. |
| Kit-to-booking integration | Shipped | GAP-18 | Kit selector, kit badge on detail. |
| Overdue priority sort | Shipped | AREA_CHECKOUTS changelog | Longest-overdue first in lists. |
| Deep links from dashboard/items | Shipped | AREA_CHECKOUTS changelog | Auto-fill sport, event, pre-select asset. |
| Equipment conflict badges on reservation detail | Specced | Reservations AC-8, todo.md | Conflict detection exists in picker but not on booking detail display. |
| Date range grouping on detail | Mentioned | todo.md | Connected From/To display deferred. |

## Open Gaps & Blockers

### Auth gaps (from API route audit)
1. **Audit logs endpoint lacks permission gate** (MEDIUM): `GET /api/bookings/[id]/audit-logs` — any authenticated user can fetch audit logs for any booking. Should enforce `requireBookingAction(id, user, "view")` to prevent students from reading other users' booking audit trails.

2. **Photo upload endpoint lacks permission gate** (MEDIUM): `POST /api/checkouts/[id]/photo` — only checks booking exists and is OPEN, doesn't verify user has permission (student ownership or staff+). Should add `requireBookingAction` check.

### From todo.md
3. **Reservations AC-8**: Equipment conflict badges on booking detail — conflict detection exists in EquipmentPicker but not surfaced on the booking detail equipment tab. P2 priority.

### From AREA_RESERVATIONS.md
4. **Reservation ACs not in checkbox format**: 12 acceptance criteria listed as numbered items, not `[x]`/`[ ]`. Unlike AREA_CHECKOUTS (all checked), these haven't been formally verified against the checkbox convention.

### From doc review
5. **AREA_RESERVATIONS.md stale**: Last updated 2026-03-22. Missing changelog entries for: unified detail page (2026-03-22), booking page hardening (2026-03-25), kit integration (2026-03-25), overdue sort (2026-03-25), photo requirement (2026-03-30), deep links (2026-03-31).

## Recommended Actions (prioritized)

1. ~~**[Medium] Add permission gate to audit-logs endpoint**~~ — **DONE 2026-04-06.** Added `requireBookingAction(id, user, "view")` to `GET /api/bookings/[id]/audit-logs`.

2. ~~**[Medium] Add permission gate to photo upload**~~ — **DONE 2026-04-06.** Added student ownership check to `POST /api/checkouts/[id]/photo`.

3. **[Medium] Update AREA_RESERVATIONS.md** — Add changelog entries for 6+ features shipped since 2026-03-22. Convert ACs to checkbox format and verify each.

4. **[Low] Implement reservation conflict badges** — todo.md P2 item. Surface conflict data from booking detail API on the equipment tab.

5. **[Low] Date range grouping** — Connected From/To display on booking detail. Deferred from UX Round 3.

## Roadmap Status

| Artifact | Status | Notes |
|---|---|---|
| BookingDetailsSheet roadmap | Active | V1 shipped, V2/V3 planned with specifics. |
| Equipment Picker roadmap | Active | V1 standardization, V2 compound API, V3 generic picker. |
| Checkouts list roadmap | None | Simple wrapper — no dedicated roadmap needed. |
| Reservations list roadmap | None | Same — no dedicated roadmap needed. |
| Scan page roadmap | None | Fully hardened and decomposed. Future work is Phase C (kiosk mode). |
