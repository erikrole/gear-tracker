# Reservations Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-ready (23/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_RESERVATIONS.md is comprehensive (249 lines). V1 scope clearly delineated. State transitions, action matrix, bug traps, edge cases, acceptance criteria all documented. Brief exists and marked shipped. |
| Hardening | 4/5 | Detail page fully hardened (3 rounds UX polish, optimistic locking, double-submit guards, error states, dark mode). API routes have auth, validation, audit. List page gap — uses shared BookingListPage but no dedicated 5-pass audit. |
| Roadmap | 5/5 | Phase A complete. Phase B has no reservation-specific items. Phase C deferred items (templates) named. Plan files archived. No open gaps. |
| Feature completeness | 4/5 | 21 features shipped. One AC partially met (equipment conflict badges). Two features intentionally deferred (spotcheck, PDF). Three intentionally out of scope. |
| Doc sync | 5/5 | AREA doc updated 2026-03-22 with unified detail architecture, D-025 status vocabulary, full change log. Brief marked shipped. GAPS_AND_RISKS current. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Reservations List | `/reservations` | Partially hardened | Thin wrapper around shared BookingListPage. Has skeleton, error handling, search/filter/sort. No dedicated 5-pass audit. Lacks AbortController, refresh-preserves-data. |
| Reservation Detail | `/reservations/[id]` | Hardened | 7-line wrapper passing `kind="RESERVATION"` to BookingDetailPage (510 lines). Full hardening: skeleton, optimistic updates, busyRef double-submit guard, 409 stale-write detection, toast on all actions, keyboard shortcuts, live countdown, dark mode. |
| BookingInfoTab | Shared | Hardened | SaveableField with blur-save, status indicators, clipboard copy, mixed-location alert. |
| BookingEquipmentTab | Shared | Hardened | Search, empty states, progress bar, context menus, optimistic checkin. |
| BookingHistoryTab | Shared | Hardened | ToggleGroup filter, relative timestamps, field-level diffs, equipment action detail. |

## API Route Status
| Route | Method | Auth | Validation | Audit | Transactions | Issues |
|---|---|---|---|---|---|---|
| `/api/reservations` | GET | withAuth + requirePermission | Via listBookings | N/A | N/A | None |
| `/api/reservations` | POST | withAuth + requirePermission | Zod + sanitize + parseDateRange | Yes (after snapshot) | Inside createBooking | None |
| `/api/reservations/[id]` | GET/PATCH | withAuth | — | — | — | 308 redirect to /api/bookings/[id] |
| `/api/reservations/[id]/convert` | POST | requireBookingAction | Kind + action gating | Yes (with linkage) | Inside createBooking | None |
| `/api/reservations/[id]/cancel` | POST | requireBookingAction | Kind + state validation | Yes | Inside cancelReservation | None |
| `/api/reservations/[id]/duplicate` | POST | requireBookingAction | Kind + state validation | Yes (source ref) | Inside createBooking | None |
| `/api/bookings/[id]` | PATCH | requireBookingAction | Zod + optimistic lock | Yes (before/after) | Inside updateReservation | 409 on stale write |
| `/api/bookings/[id]/extend` | POST | requireBookingAction | Zod | Yes | Inside extendBooking | None |

## Booking Rules Engine
- Full state x action matrix: DRAFT (edit, cancel), BOOKED (edit, extend, cancel, convert, duplicate), OPEN/COMPLETED/CANCELLED (none)
- Owner check: requesterUserId OR createdBy
- Staff+ vs owner access gating
- `requireBookingAction` validates kind, checks permission, throws HttpError on denial

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Create reservation (BOOKED state) | Shipped | AREA_RESERVATIONS | |
| Edit with conflict revalidation | Shipped | AREA_RESERVATIONS AC-2 | |
| Convert to checkout (BOOKED->OPEN) | Shipped | AREA_RESERVATIONS AC-1 | Atomically creates checkout from items |
| Cancel reservation | Shipped | D-012 | BOOKED->CANCELLED |
| Duplicate reservation | Shipped | AREA_RESERVATIONS | |
| Extend reservation | Shipped | AREA_RESERVATIONS | |
| Unified detail page (with checkouts) | Shipped | D-002 | BookingDetailPage with kind prop |
| Inline title/notes editing | Shipped | AREA_RESERVATIONS | SaveableField pattern |
| Reference numbers (RV-XXXX) | Shipped | D-024 | Global sequence, monospace badge |
| Status vocabulary (BOOKED->"Confirmed") | Shipped | D-025 | statusLabel() helper |
| Optimistic locking | Shipped | AREA_RESERVATIONS | If-Unmodified-Since, 409 on stale |
| Audit logging with before/after snapshots | Shipped | D-007 | All 5 mutation routes |
| List with filters/search/sort | Shipped | AREA_RESERVATIONS | Via shared BookingListPage |
| Context menu actions on list | Shipped | AREA_RESERVATIONS | Convert, duplicate, cancel |
| Equipment panel with search | Shipped | AREA_RESERVATIONS | |
| History tab with filters | Shipped | AREA_RESERVATIONS | ToggleGroup, field diffs |
| Mixed-location alert | Shipped | D-008 | |
| Live countdown badge | Shipped | AREA_RESERVATIONS | |
| Keyboard shortcut (E to edit) | Shipped | AREA_RESERVATIONS | |
| Equipment conflict badges | **Partially shipped** | AREA_RESERVATIONS AC-8 | Items shown but live conflict indicators not evident |
| Spotcheck creation | Deferred | AREA_RESERVATIONS | Documented, out of scope V1 |
| PDF generation | Deferred | AREA_RESERVATIONS | Documented, out of scope V1 |
| Templates | Deferred | Phase C | Named but unscoped |
| Approval workflows | Deferred | Phase C | Out of scope V1 |

## Open Gaps & Blockers
1. **List page not 5-pass hardened** — Shared BookingListPage works but hasn't had dedicated hardening like dashboard, items, users, scan, profile pages have.
2. **Equipment conflict badges (AC-8)** — Spec says "item-level conflict badges with actionable guidance." Equipment tab shows items but no availability/conflict indicators. Either implement or update AC.
3. **Minimal test coverage** — Brief's test plan calls for unit tests on transition guards, integration tests for lifecycle, regression tests for concurrent edits. Only 3 reservation references in checkout-rules.test.ts, 5 in status.test.ts.

## Recommended Actions (prioritized)
1. **[P1] Harden BookingListPage** — AbortController, refresh-preserves-data, high-fidelity skeleton. Benefits both reservations and checkouts lists.
2. **[P2] Resolve equipment conflict badges (AC-8)** — Either implement availability indicators or update AREA doc to reflect shipped behavior.
3. **[P2] Expand test coverage** — Transition guard matrix, permission checks, concurrent edit collision tests per brief test plan.

## Roadmap Status
**Rating: Well-defined**

- Phase A complete. Plan files archived.
- Phase B has no reservation-specific remaining items.
- Phase C deferred items (templates, approval workflows) named in AREA doc and GAPS_AND_RISKS.
- No open gaps or pending decisions blocking reservations.
- Highest-scoring area for roadmap clarity.
