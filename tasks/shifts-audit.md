# Shifts Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-ready with minor gaps (20/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_SHIFTS.md has 11 acceptance criteria, all checked. Detailed plan archived. Integration research doc covers Phases 1-4. |
| Hardening | 3/5 | TOCTOU fixes shipped (transaction wrapping in trades/assignments). Time conflict detection implemented. Schedule page itself NOT 5-pass hardened — no AbortController, no refresh-preserves-data, inline styles. |
| Roadmap | 4/5 | Phase B deferred items (email notifications, student availability) clearly documented. Game-Day Readiness Score deferred to Phase C. Integration research doc comprehensive. |
| Feature completeness | 4/5 | All 11 ACs marked done. Gear integration (6 slices) shipped. Two Phase B items remain (shift email, student availability). |
| Doc sync | 4/5 | AREA_SHIFTS.md change log covers slices 1-12 plus gear integration. GAPS_AND_RISKS tracks open items correctly. NORTH_STAR shows scheduling integration as Phase A complete. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Schedule Page | `/schedule` (504 lines) | Partially hardened | 11 useState hooks (not extracted into hooks). No AbortController. Refresh clears view during refetch. Calendar view has no skeleton. Inline styles on buttons/cells. No double-click guards on filter changes. Mobile card layout present. |
| ShiftDetailPanel | Sheet component (577 lines) | Partially hardened | Sheet slide-out with area grouping. Error/loading states with retry. `acting` guard prevents double-click. Heavy inline styles. No aria attributes or keyboard nav for roster. |
| TradeBoard | Component (404 lines) | Partially hardened | Error/loading with retry. `acting` state guards. Mobile card layout. Student filtering (OPEN + own trades). Confirm on cancel. Some inline styles. |
| My Shifts Widget | Dashboard embedded | Hardened | Inherits dashboard 5-pass hardening. Gear status badges, "Reserve gear" links, proper ordering. |
| Event Command Center | Event detail embedded | Partially hardened | Staff/admin gated. Shift grid + gear summary + missing gear + nudge. Heavy inline styles. |
| Shift Context Banner | CreateBookingCard embedded | Hardened | Shows shift area + time on checkout creation. |

## API Route Status (20+ routes)
| Area | Routes | Auth | Validation | Audit | Transactions |
|---|---|---|---|---|---|
| Shift Groups | 3 | requirePermission | Zod on PATCH | Yes | Delegated to service |
| Shifts CRUD | 3 | requirePermission | Zod on POST/PATCH | Yes | No (single creates) |
| Shift Assignments | 6 | requirePermission | Zod on POST | Yes | **SERIALIZABLE** on assign/request/approve/swap. Minor: decline/remove not wrapped. |
| Shift Trades | 5 | requirePermission | Zod on POST; status param validated | Yes | **Yes** on all 5 routes (claim includes time conflict + area check) |
| Sport Configs | 3 | requirePermission | Zod | Yes | Delegated |
| My Shifts | 1 | withAuth | Query params | N/A | N/A |
| Command Center | 1 | withAuth + student blocked | N/A | N/A | N/A |

**API Summary**: Complete auth + Zod + audit coverage. Critical paths use SERIALIZABLE transactions. Two minor routes (decline/remove assignment) don't use transactions — low risk but inconsistent.

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Sport configuration (per-area counts) | Shipped | AREA_SHIFTS AC | Settings UI + CRUD API |
| Sport roster (students/staff to sports) | Shipped | AREA_SHIFTS AC | Roster panel + profile |
| Auto-generation from ICS sync | Shipped | AREA_SHIFTS AC | shift-generation.ts + sync hook |
| Staff assignment (pick from pool) | Shipped | AREA_SHIFTS AC | ShiftDetailPanel assign picker |
| Student requests (premier events) | Shipped | AREA_SHIFTS AC | requestShift service + UI |
| Trade board (area-filtered) | Shipped | AREA_SHIFTS AC | TradeBoard component |
| Trade claims (instant/approved) | Shipped | AREA_SHIFTS AC | claimTrade with requiresApproval branching |
| Calendar view (coverage indicators) | Shipped | AREA_SHIFTS AC | Month grid with green/orange/red dots |
| List view (filterable) | Shipped | AREA_SHIFTS AC | Table with sport/area/coverage filters |
| User profiles (contact, area, sports) | Shipped | AREA_SHIFTS AC | phone, primaryArea fields |
| Mobile responsive | Shipped | AREA_SHIFTS AC | Mobile cards + calendar hint |
| Shift context banner on checkout | Shipped | Gear integration | CreateBookingCard |
| My Shifts dashboard widget | Shipped | Gear integration | Gear status badges, action links |
| Gear Up notification on assignment | Shipped | Gear integration | createShiftGearUpNotification |
| Event Command Center (staff) | Shipped | Gear integration | Shift grid + gear summary + nudge |
| Shift-Checkout linking (FK) | Shipped | Gear integration | shiftAssignmentId on Booking |
| Game-Day Readiness Score | Deferred | Phase C | NORTH_STAR |
| Shift email notifications | Deferred | Phase B | V1 = in-app audit only |
| Student availability tracking | Deferred | Phase B | Declare unavailable dates |

## Open Gaps & Blockers
1. **Schedule page not 5-pass hardened** — No AbortController, no refresh-preserves-data, no high-fidelity skeleton, inline styles. Biggest gap.
2. **decline/remove assignment lack transaction wrapping** — Low risk (single updates) but inconsistent with other mutation patterns.
3. **No pagination on shift groups or trade board** — Both fetch all results. Performance risk at scale.
4. **Calendar view has no loading skeleton** — Only list view shows SkeletonTable.
5. **Inline styles throughout** — ShiftDetailPanel, schedule page, event command center all use `style={{}}` instead of Tailwind.
6. **Hardening plan partially resolved** — `tasks/archive/schedule-hardening-plan.md` has 7 slices, checkboxes all unchecked despite some items shipped.
7. **Area eligibility on trade claims is soft** — Checks primaryArea but allows claim if null. Secondary areas not checked.

## Recommended Actions (prioritized)
1. **[P1] Run /harden-page on schedule page** — AbortController, refresh-preserves-data, calendar skeleton, inline style cleanup, double-click guards. Matches treatment applied to other major pages.
2. **[P1] Wrap decline/remove in transactions** — Consistency with other shift mutation patterns.
3. **[P2] Add pagination to shift groups + trade board** — Server-side pagination before data grows.
4. **[P2] Tighten trade claim area eligibility** — Check secondary area assignments, not just primaryArea.
5. **[P2] Update hardening plan checkboxes** — Mark resolved items in `tasks/archive/schedule-hardening-plan.md`.
6. **[P3] Clean up inline styles** — Replace with Tailwind utilities across ShiftDetailPanel, TradeBoard, schedule page.

## Roadmap Status
**Rating: Well-defined**

- V1 complete (11/11 criteria). Gear integration 5/6 slices shipped.
- Phase B: 2 items documented (shift email, student availability).
- Phase C: Game-Day Readiness Score deferred.
- Integration research complete with ranked feature list.
- Original 12-slice plan archived. Hardening plan archived (partially resolved).
