# Items Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-Ready with Minor Gaps (19/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_ITEMS.md is comprehensive (350+ lines), covers list/create/detail/settings/accessories/numbered bulk. Bug traps, edge cases, acceptance criteria all documented. BRIEF_ITEMS_V1.md and BRIEF_ITEM_BUNDLING_V1.md provide additional specificity. |
| Hardening | 4/5 | 5-pass hardening completed on list page. AbortController, refresh-preserves-data, toast feedback, double-click guards, skeletons. Detail page not explicitly hardened — 4 fetches without AbortController, no refresh-preserves-data. |
| Roadmap | 3/5 | No `tasks/items-roadmap.md` exists. AREA doc has "Out of Scope (V1)" section. Future work scattered across GAPS_AND_RISKS and NORTH_STAR. |
| Feature completeness | 4/5 | Core V1 shipped: list with 9-field search + 6 filters, create (serialized + bulk), detail with 7 tabs, accessories, insights, inline edit, QR, image upload, bulk actions, import. Missing: Export (specced), draft recovery on create (specced), duplicate assetTag validation on create. |
| Doc sync | 3/5 | AREA_ITEMS.md change log ends at 2026-03-22. Does not mention Insights tab or Favorites (both shipped). BRIEF_ITEM_BUNDLING_V1.md acceptance criteria all unchecked despite feature shipped. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Items List | `/items` | Hardened | 5-pass completed. AbortController, skeleton, toast, actionBusy guard, differentiated empty states. Well-decomposed into 4 hooks + 4 components. |
| Item Detail | `/items/[id]` | Partially hardened | Has skeleton, error state, actionBusy guard. Missing: AbortController on 4 fetches, no refresh-preserves-data, no shimmer on reload. |
| ItemInfoTab | `/items/[id]` | Partially hardened | SaveableField for inline edits. Category/department comboboxes. No explicit error boundary. |
| ItemBookingsTab | `/items/[id]` | Partially hardened | OperationalOverview, BookingsTab, CalendarTab. Functional. |
| ItemHistoryTab | `/items/[id]` | Partially hardened | Activity feed from audit log. |
| ItemInsightsTab | `/items/[id]` | Partially hardened | Dynamic import (code-split). 4 time windows. Legends and empty states. |
| ItemSettingsTab | `/items/[id]` | Partially hardened | Accessories with search, attach, detach, move. Debounced search. |
| New Item Sheet | Sheet | Not hardened | No draft recovery/persistence. No double-submit guard visible. |
| Columns / DataTable | `/items` | Hardened | Part of list page hardening pass. |
| Bulk Action Bar | Component | Hardened | Toast success/failure with action type and count. |
| Items Toolbar | Component | Hardened | Search + 6 faceted filters + accessories toggle + clear all. |

## API Route Status
| Route | Methods | Auth | Audit | Issues |
|---|---|---|---|---|
| `/api/assets` | GET, POST | withAuth | Yes (POST) | POST missing duplicate assetTag check |
| `/api/assets/[id]` | GET, PATCH, DELETE | withAuth | Yes (mutations) | QR uniqueness on PATCH. Delete gated by booking history. |
| `/api/assets/[id]/accessories` | GET, POST, PATCH, DELETE | withAuth | Yes (mutations) | Self-reference and nesting prevention. Checkout/reservation flags managed. |
| `/api/assets/[id]/activity` | GET | withAuth | N/A | Audit logs for asset + related bookings. |
| `/api/assets/[id]/duplicate` | POST | withAuth + requirePermission | Yes | Unique QR + tag suffix generation. |
| `/api/assets/[id]/generate-qr` | POST | withAuth + requirePermission | Yes | Collision retry (5 attempts). |
| `/api/assets/[id]/image` | POST, PUT, DELETE | withAuth + requirePermission | Yes | Vercel Blob. Old blob cleanup. |
| `/api/assets/[id]/maintenance` | POST | withAuth + requirePermission | Yes | Toggle MAINTENANCE <-> AVAILABLE. |
| `/api/assets/[id]/retire` | POST | withAuth + requirePermission | Yes | One-way to RETIRED. |
| `/api/assets/[id]/favorite` | POST | withAuth | **No** | Missing audit log (low priority — user preference). |
| `/api/assets/[id]/insights` | GET | withAuth | N/A | 60s Cache-Control. 4 time windows. |
| `/api/assets/bulk` | POST | withAuth + requirePermission | Yes (per-asset) | Max 50 IDs. Move, categorize, retire, maintenance. |
| `/api/assets/import` | POST | withAuth + requirePermission | Yes | Cheqroom preset. Image download. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Items list (table + mobile cards) | Shipped | AREA_ITEMS, BRIEF_ITEMS_V1 | 9-field search, 6 filters, sorting, pagination, keyboard shortcuts |
| Tag-first identity (assetTag) | Shipped | D-004 | Consistent across list, detail, create |
| Derived status display | Shipped | D-001, D-013 | StatusLine with 6 states + deep links |
| Create item (serialized) | Shipped | AREA_ITEMS | Required fields enforced |
| Create item (bulk) | Shipped | AREA_ITEMS | Separate form with quantity |
| Item detail (7 tabs) | Shipped | AREA_ITEMS | Info, Bookings, Calendar, Insights, History, Accessories, Settings |
| Actions menu | Shipped | AREA_ITEMS | Duplicate, Retire, Delete, Maintenance — delete gated |
| Inline edit (ADMIN/STAFF) | Shipped | AREA_ITEMS | SaveableField, role-gated |
| QR code generation | Shipped | AREA_ITEMS | Collision-checked |
| Image upload/URL/remove | Shipped | AREA_ITEMS | Vercel Blob, audit logged |
| Accessories (bundling) | Shipped | D-023, BRIEF_ITEM_BUNDLING_V1 | Attach/detach/move, list hides children |
| Fiscal year dropdown | Shipped | AREA_ITEMS | July 1 rollover computation |
| Category/department dropdowns | Shipped | D-019 | ComboBox wired, department filter on list |
| Settings tab (policy toggles) | Shipped | AREA_ITEMS | Reservation/checkout/custody toggles |
| Bulk actions | Shipped | AREA_ITEMS | Up to 50 items, per-asset audit |
| Import (CSV) | Shipped | AREA_ITEMS | Cheqroom preset, image download |
| Insights tab | Shipped | Not in AREA doc | 4 time windows, punctuality, cost per use, sport breakdown |
| Favorites | Shipped | Not in AREA doc | Toggle endpoint, no audit log |
| **Export** | **Missing** | AREA_ITEMS line 53 | Specced V1 feature — no button, no API route |
| **Draft recovery on create** | **Missing** | AREA_ITEMS line 131 | Specced — no implementation |
| **Duplicate assetTag check on create** | **Missing** | AREA_ITEMS line 129 | Specced validation — not enforced on POST |
| Numbered bulk items | Specced | D-022 | BulkItemForm references trackByNumber. Full UI depth unclear. |

## Open Gaps & Blockers
1. **Export missing** — AREA_ITEMS specifies "Export visible to ADMIN and STAFF." No export button or API route exists. Specced V1 feature.
2. **Draft recovery on create not implemented** — AREA_ITEMS specifies "Draft recovery is supported if user leaves before save." No draft persistence in NewItemSheet.
3. **Duplicate assetTag validation on create** — POST /api/assets doesn't check for duplicate assetTag. Edit warns but create doesn't.
4. **Item detail page not hardened** — 4 independent fetches without AbortController, no refresh-preserves-data, no shimmer on reload.
5. **BRIEF_ITEM_BUNDLING_V1.md acceptance criteria unchecked** — All 9 checkboxes empty despite feature shipped.
6. **Numbered bulk item UI completeness unclear** — D-022 specifies unit picker, conversion, status cycling. Not fully verified.
7. **Favorite toggle unaudited** — Inconsistent with D-007 (low priority).

## Recommended Actions (prioritized)
1. **[P0] Wire Export button** — Add Export (ADMIN/STAFF) next to Import. Implement CSV export API. Specced V1 feature.
2. **[P0] Add assetTag uniqueness check on create** — Prevent duplicate serialized identities at creation time.
3. **[P1] Harden item detail page** — AbortController on all fetches, refresh-preserves-data, shimmer on reload, error recovery.
4. **[P1] Add double-submit guard to NewItemSheet** — Prevent duplicate item creation.
5. **[P2] Update doc sync** — Check off bundling brief ACs. Add Insights + Favorites to AREA doc. Mark ACs met/unmet.
6. **[P2] Verify numbered bulk item UI** — Audit D-022 spec vs shipped code.
7. **[P3] Implement draft recovery or descope** — Either build localStorage persistence or remove AC.
8. **[P3] Add audit to favorite toggle** — Per D-007.

## Roadmap Status
**Rating: Partially defined**

- Items V1 marked Phase A Complete in NORTH_STAR.
- No dedicated roadmap or plan file exists.
- Future work scattered: numbered bulk (D-022), kit management (D-020), export, procurement, depreciation — all out of scope V1.
- AREA_ITEMS.md "Out of Scope (V1)" provides clear boundaries.
- Would benefit from a `tasks/items-roadmap.md` consolidating V2 plans.
