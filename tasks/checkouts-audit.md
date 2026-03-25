# Checkouts Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-ready with minor gaps (20/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_CHECKOUTS.md is comprehensive (272 lines), covers workflow, action matrix, equipment picker, edge cases, bug traps, acceptance criteria. IA matches code exactly — list page, detail page, shared BookingDetailPage, API routes all accounted for. |
| Hardening | 4/5 | 5-pass hardening completed on scan page, booking detail (3 rounds of UX polish + security/resilience passes), mobile layout fixes. Git log confirms dedicated hardening commits. No dedicated "break-this" adversarial testing found for checkouts specifically. |
| Roadmap | 3/5 | V1 fully defined and shipped. V2 picker improvements shipped. Phase B/C items listed in NORTH_STAR.md and GAPS_AND_RISKS.md but no dedicated `tasks/checkouts-roadmap.md` exists. Future work (kit-based checkout, kiosk mode, templates) mentioned but not sliced. |
| Feature completeness | 4/5 | All 7 AREA doc acceptance criteria met. All BRIEF_CHECKOUT_UX_V2 and BRIEF_PICKER_IMPROVEMENTS_V1 criteria shipped. DRAFT lifecycle shipped. Unified detail page shipped. Only gap: kit-based checkout deferred per D-020. |
| Doc sync | 4/5 | AREA_CHECKOUTS.md change log current through 2026-03-23. GAPS_AND_RISKS.md has stale GAP-3 ("only 1 guidance rule" — 3 rules shipped). 4 unarchived booking plan files in tasks/ root. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Checkouts List | `/checkouts` | Hardened | Shared BookingListPage with config. Cancel has try/catch, error toasts, confirm dialog. |
| Checkout Detail | `/checkouts/[id]` | Hardened | Thin wrapper delegating to BookingDetailPage. 7 lines, clean. |
| BookingDetailPage | Shared component | Hardened | 510 lines. High-fidelity skeleton, optimistic checkin with rollback, live countdown with urgency-adaptive tick rate, keyboard shortcut (E for edit), double-submit guard via busyRef, inline title editing, collapsible history, mobile-responsive. |
| BookingInfoTab | Shared component | Hardened | SaveableField pattern. Mixed-location Alert. Avatar initials. Clipboard copy. All shadcn. |
| BookingEquipmentTab | Shared component | Hardened | Progress bar, search, checkbox multi-select, select all/clear, bulk return, returned item visual treatment, empty states. |
| BookingHistoryTab | Shared component | Hardened | ToggleGroup filter, field-level diff rendering, equipment change details, relative time. |

## API Route Status
| Route | Method | Auth | Audit | Transaction | Issues |
|---|---|---|---|---|---|
| `/api/checkouts` | GET | withAuth + requirePermission | N/A | N/A | None |
| `/api/checkouts` | POST | withAuth + requirePermission | Yes | SERIALIZABLE | None |
| `/api/bookings/[id]` | GET | withAuth | N/A | N/A | None |
| `/api/bookings/[id]` | PATCH | withAuth + requireBookingAction | Yes (before-snapshot) | Service-level | 409 on stale |
| `/api/bookings/[id]/extend` | POST | withAuth + requireBookingAction | Yes | SERIALIZABLE | None |
| `/api/bookings/[id]/cancel` | POST | withAuth + requireBookingAction | Yes | Service-level | None |
| `/api/checkouts/[id]/checkin-items` | POST | withAuth + requireBookingAction | Yes | SERIALIZABLE | None |
| `/api/checkouts/[id]/checkin-bulk` | POST | withAuth + requireBookingAction | Yes | Service-level | None |
| `/api/checkouts/[id]/complete-checkin` | POST | withAuth + requirePermission | Yes | Service-level | None |
| `/api/checkouts/[id]/complete-checkout` | POST | withAuth + requirePermission | Yes | Service-level | None |
| `/api/checkouts/[id]/scan` | POST | withAuth + requirePermission + student ownership | Yes | Service-level | None |
| `/api/checkouts/[id]/admin-override` | POST | withAuth + requirePermission (admin_override) | Yes | Service-level | None |
| `/api/drafts` | POST | withAuth | N/A | $transaction | None |
| `/api/drafts/[id]` | DELETE | withAuth + ownership | Yes | N/A | None |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Event-linked checkout creation | Shipped | AREA_CHECKOUTS, BRIEF_CHECKOUT_UX_V2 | Event defaults, sport selection, 30-day window |
| Ad hoc checkout (no event) | Shipped | AREA_CHECKOUTS | Fallback path |
| State-based action gating | Shipped | D-012 | booking-rules.ts enforces full matrix |
| Partial check-in | Shipped | BRIEF_CHECKOUT_UX_V2 | Checkbox multi-select, optimistic UI, progress bar |
| Full check-in / complete | Shipped | AREA_CHECKOUTS | Confirmation dialog |
| Extend booking | Shipped | AREA_CHECKOUTS | Quick-extend buttons, DateTimePicker, conflict detection |
| Cancel checkout | Shipped | D-012 | Staff-only for OPEN, confirmation |
| Equipment picker V2 | Shipped | BRIEF_PICKER_IMPROVEMENTS_V1 | Multi-select, search, availability, scan-to-add, guidance |
| Equipment guidance (3 rules) | Shipped | D-016 | body-needs-batteries, lens-needs-body, audio-with-video |
| DRAFT booking state | Shipped | D-017 | CRUD, dashboard recovery, auto-save |
| Booking ref numbers (CO-XXXX) | Shipped | D-024 | Global sequence, monospace badge, clipboard |
| Unified detail page | Shipped | D-002 | BookingDetailPage with kind prop |
| Status vocabulary | Shipped | D-025 | OPEN -> "Checked out" |
| Inline editing | Shipped | AREA_CHECKOUTS | SaveableField + optimistic locking |
| Scan-based checkout/checkin | Shipped | AREA_CHECKOUTS | Scan sessions, QR/barcode |
| Admin override | Shipped | AREA_CHECKOUTS | Dedicated endpoint with audit |
| Audit logging on all mutations | Shipped | D-007 | All create/update/extend/cancel/complete/override |
| Mixed-location support | Shipped | D-008 | Alert for MIXED bookings |
| Shift context banner | Shipped | AREA_CHECKOUTS changelog | shiftAssignmentId FK |
| Mobile-responsive detail | Shipped | AREA_CHECKOUTS changelog | flex-col sm:flex-row, touch menus |
| Kit-based checkout | Not started | D-020 | Phase B — schema exists, zero UI |
| Kiosk mode | Not started | NORTH_STAR | Phase C |
| Booking templates | Not started | NORTH_STAR | Phase C |
| Admin-configurable guidance rules | Not started | D-016 | Phase C |

## Open Gaps & Blockers
1. **GAP-3 stale description**: GAPS_AND_RISKS.md says "only 1 rule in production" but 3 rules shipped. Doc inaccuracy, not functional gap.
2. **No dedicated checkout roadmap file**: Future work scattered across NORTH_STAR, GAPS_AND_RISKS, DECISIONS.
3. **Unarchived plan files**: 4 booking-related plan files in `tasks/` root should be in `tasks/archive/`.
4. **No adversarial/break-this testing**: Hardening was thorough but no systematic break-this pass documented.
5. **Kit-based checkout (D-020)**: Full schema, zero UI. Blocking Phase B completion. Needs brief.

## Recommended Actions (prioritized)
1. **Archive stale plan files** — Move 4 booking plans to `tasks/archive/`. (~5 min)
2. **Fix GAP-3 description** — Update GAPS_AND_RISKS.md to reflect 3 shipped guidance rules. (~2 min)
3. **Create `tasks/checkouts-roadmap.md`** — Consolidate Phase B (kit checkout) and Phase C (kiosk, templates, admin rules). (~30 min)
4. **Write BRIEF_KIT_MANAGEMENT_V1.md** — Priority 2 in NORTH_STAR. Blocking Phase B. (~1 hr)
5. **Adversarial test pass** — Run /break-this on checkout flows. (~2 hrs)

## Roadmap Status
**Rating: Partially defined**

- **V1 (Phase A)**: Fully shipped. All acceptance criteria met.
- **V2 (Phase B)**: Partially defined. Kit management UI (D-020) is the main remaining item. Needs a brief.
- **V3 (Phase C)**: Listed but unscoped. Kiosk mode, templates, admin guidance rules — no briefs or slice plans.
- No dedicated roadmap file — future work distributed across 3+ docs.
