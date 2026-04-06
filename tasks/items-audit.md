# Items Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Items
**Overall Verdict**: Ship-ready (22/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_ITEMS.md is comprehensive (378 lines) with detailed IA for list, create, and detail surfaces. All 14 ACs checked. V1 spec covers serialized + bulk items, numbered tracking (D-022), accessories (D-023). |
| Hardening | 4/5 | Items list: 5-pass hardened (AbortController, skeletons, error differentiation, double-click guards). Item detail: hardened (AbortController, 401 redirect, refresh-preserves-data, error differentiation, visibility refresh). Kits/bulk-inventory pages less documented. |
| Roadmap | 5/5 | Three roadmap files: `items-roadmap.md` (list V1-V3), `item-details-roadmap.md` (detail V1-V3), `item-picker-roadmap.md`. V1 polish items shipped. V2/V3 well-scoped. |
| Feature completeness | 5/5 | All 14 ACs met. V1 roadmap polish items shipped (notes, summary bar, export, favorites, column persistence). Detail roadmap V1 complete (all 7 items shipped including notes section). Missing only: consumable flag UI and primaryScanCode editing (both deferred by design). |
| Doc sync | 3/5 | AREA_ITEMS last updated 2026-03-25. Missing changelog entries for: favorites shipped, export shipped, summary bar shipped, detail page hardening (all shipped after 2026-03-25). items-roadmap.md V1 items marked shipped but AREA doc doesn't reflect these. |

## Page-by-Page Status
| Page | Route | Lines | Hardening | Issues |
|---|---|---|---|---|
| Items list | `/items` | 493 | Hardened | 5-pass hardened. AbortController, skeletons, error differentiation, bulk actions, keyboard shortcuts. Well-decomposed (4 hooks + 4 components). |
| Item detail | `/items/[id]` | 313 + 3398 (tabs/hooks) | Hardened | AbortController, 401 redirect, refresh-preserves-data, visibility refresh, error differentiation, skeleton loading. 7 tabs with keyboard shortcuts. Dynamic imports for heavy tabs. |
| ItemInfoTab | (tab) | 860 | Partial | Large file. SaveableField inline editing, operational overview cards. No AbortController on individual field saves. |
| ItemBookingsTab | (tab) | 676 | Partial | Bookings + calendar + settings sub-components. No pagination on booking history (could grow unbounded). |
| ItemInsightsTab | (tab) | 398 | Hardened | Dynamic import, Recharts charts, 4 time windows. |
| ItemHistoryTab | (tab) | 205 | Hardened | Cursor pagination, actor attribution, diff display. |
| ItemSettingsTab | (tab) | 189 | Partial | Accessories attach/detach with search. Policy toggles. |
| Kits list | `/kits` | 346 | Partial | Uses useFetch hook. Basic error/loading states. No documented hardening pass. |
| Kit detail | `/kits/[id]` | 591 | Partial | Member management, search, archive. No documented hardening pass. |
| Bulk inventory | `/bulk-inventory` | 477 | Partial | Unit grid, status cycling, quantity adjust. Uses useFetch + useUrlState. No documented hardening pass. |
| Labels | `/labels` | 249 | Partial | QR label printing. Uses useFetch. |
| New item sheet | (sheet) | ~400 | Hardened | Serialized + bulk forms, Zod validation, useFormSubmit. |

## API Route Status
| Route | Method | Auth | Validation | Audit | Transaction | Notes |
|---|---|---|---|---|---|---|
| `/api/assets` | GET | All roles | Query params | N/A | N/A | Derived status via subqueries. Pagination. |
| `/api/assets` | POST | ADMIN/STAFF | Zod | Yes | No | P2002 for tag uniqueness. |
| `/api/assets/[id]` | GET | All roles | N/A | N/A | N/A | Includes accessories, bookings, allocations. |
| `/api/assets/[id]` | PATCH | ADMIN/STAFF | Zod | Yes (before/after) | No | Field-level diffs. |
| `/api/assets/[id]` | DELETE | ADMIN/STAFF | N/A | Yes | No | Policy-safe gating (no active allocations). |
| `/api/assets/[id]/accessories` | POST/DELETE | ADMIN/STAFF | Zod | Yes | No | Attach/detach/move. |
| `/api/assets/[id]/activity` | GET | All roles | Cursor params | N/A | N/A | Cursor pagination. |
| `/api/assets/[id]/image` | POST/DELETE | ADMIN/STAFF | File upload | Yes | No | Vercel Blob. Old image cleanup. |
| `/api/assets/[id]/duplicate` | POST | ADMIN/STAFF | N/A | Yes | No | Clones asset with new tag. |
| `/api/assets/[id]/generate-qr` | POST | ADMIN/STAFF | N/A | Yes | No | Unique code generation. |
| `/api/assets/[id]/maintenance` | PATCH | ADMIN/STAFF | N/A | Yes | No | Toggle maintenance flag. |
| `/api/assets/[id]/retire` | PATCH | ADMIN/STAFF | N/A | Yes | No | Toggle retired flag. |
| `/api/assets/[id]/favorite` | POST | All roles | N/A | No | No | Toggle favorite (personal). No audit (personal pref). |
| `/api/assets/[id]/insights` | GET | All roles | Query params | N/A | N/A | Aggregated utilization data. |
| `/api/assets/bulk` | POST | ADMIN/STAFF | Zod | Yes (batch) | Yes ($transaction) | Bulk location/category/retire/maintenance. |
| `/api/assets/export` | GET | ADMIN/STAFF | Query params | N/A | N/A | CSV stream with truncation warning. |
| `/api/assets/brands` | GET | All roles | N/A | N/A | N/A | Distinct brand list for filters. |
| `/api/assets/picker-search` | GET | All roles | Query params | N/A | N/A | Equipment picker search (paginated). |
| `/api/assets/import` | POST | ADMIN/STAFF | Zod | Yes | Yes ($transaction) | CSV import with dry-run. |
| `/api/bulk-skus` | GET/POST | ADMIN/STAFF | Zod | Yes | No | Bulk SKU CRUD. |
| `/api/bulk-skus/[id]/adjust` | POST | ADMIN/STAFF | Zod | Yes | Yes (Serializable) | Stock adjustment. |
| `/api/bulk-skus/[id]/convert-to-numbered` | POST | ADMIN/STAFF | N/A | Yes | Yes ($transaction) | Converts to tracked units. |
| `/api/bulk-skus/[id]/units` | GET/POST | ADMIN/STAFF | Zod | Yes | No | Unit CRUD. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Items list with filters/search/sort | Shipped | AREA_ITEMS AC-1 | 6 filter dimensions, 9 search fields, 7 sortable columns. |
| Tag-first identity | Shipped | D-004, AC-2 | `tagName` primary in all surfaces. |
| Derived status display | Shipped | D-001, AC-3, AC-4 | Color-coded badges with booking deep links. |
| Item-kind-aware create flow | Shipped | AC-5 | Serialized + bulk forms in Sheet. |
| Detail page with 7 tabs | Shipped | AC-6, AC-7 | Info, Bookings, Calendar, Insights, History, Accessories, Settings. |
| Actions menu (duplicate, retire, delete, maintenance) | Shipped | AC-8 | Policy-safe delete gating. |
| Category/fiscal year dropdowns | Shipped | AC-9 | Controlled inputs with July 1 rollover. |
| QR code generation/manual entry | Shipped | AC-10 | Uniqueness validation. |
| Inline `Add...` prompts | Shipped | AC-11 | Empty optional fields show prompts. |
| CSV export | Shipped | AC-12 | Filtered view, truncation warning at 5K. |
| Image upload | Shipped | AC-13 | Vercel Blob, prefill safety. |
| Audit logging on all mutations | Shipped | D-007, AC-14 | Before/after diffs. |
| Numbered bulk tracking (D-022) | Shipped | AREA_ITEMS §Numbered | Unit picker, status cycling, conversion. |
| Accessories (D-023) | Shipped | AREA_ITEMS changelog | Attach/detach/move, parent-child display. |
| Financial fields (D-018) | Shipped | GAPS_AND_RISKS | Procurement section in Info tab. |
| Department filter (D-019) | Shipped | GAPS_AND_RISKS | Combobox filter on list. |
| Favorites | Shipped | GAP-22 | Star toggle on list + detail, favorites filter chip. |
| Notes in create form | Shipped | items-roadmap V1.1 | Textarea in both forms. |
| Summary bar | Shipped | items-roadmap V1.2 | Status breakdown above table. |
| Column visibility persistence | Shipped | items-roadmap V1.4 | localStorage. |
| Kit management (D-020) | Shipped | GAPS_AND_RISKS | CRUD + member management at `/kits`. |
| Kit-to-booking integration | Shipped | GAP-18 | kitId FK, selector in booking creation. |
| Labels page | Shipped | GAP-17 | Print label action in item detail. |
| Consumable flag UI | Missing | items-roadmap | Schema field exists, no UI anywhere. Deferred — needs design brief. |
| primaryScanCode editing | Missing | items-roadmap | Schema field exists, not editable. Low priority. |
| Notes display on detail page | Shipped | item-details-roadmap V1.7 | `NotesField` component in `ItemInfoTab.tsx:806-855`. Inline-editable textarea with SaveableField. |
| React Query migration | Specced | items-roadmap V2.4 | Manual fetch+useState still in use. |
| Quick filter chips | Specced | items-roadmap V2.1 | Predefined filter shortcuts. |
| Inline quick-edit on list | Specced | items-roadmap V2.3 | Click cell to edit. |
| Saved filter presets | Specced | items-roadmap V2.2 | localStorage presets. |

## Open Gaps & Blockers

### No open gaps in GAPS_AND_RISKS.md
All items-related gaps are closed (GAP-17, GAP-22, GAP-25, GAP-E, PD-4).

### Discovered during audit

**Data Integrity / Race Conditions (from API route audit):**

1. ~~**N+1 in `attachActiveBookings()`**~~ — **FALSE POSITIVE.** The function already batches with `{ in: assetIds }`. No N+1.

2. ~~**QR update TOCTOU**~~ — **FIXED 2026-04-06.** Removed pre-check `findUnique`, now catches P2002 from DB unique constraint (same pattern as user email uniqueness per `lessons.md`).

3. ~~**Delete asset TOCTOU**~~ — **FIXED 2026-04-06.** Wrapped booking count + delete in `$transaction` to prevent concurrent booking creation between check and delete.

4. **Accessory operations not transactional** (LOW): Attach/move/detach do find-then-update without transaction.

5. **Export permission mismatch** (LOW): `/api/assets/export` uses `requirePermission("asset", "create")` instead of dedicated export permission. Same role gate but semantically wrong.

**Documentation / Hardening:**

6. **AREA_ITEMS.md stale**: Last updated 2026-03-25. Missing changelog entries for favorites (GAP-22), export, summary bar, detail page hardening — all shipped after that date.

7. **BRIEF_ITEM_BUNDLING_V1.md ACs unchecked**: Status says "Shipped" but all 9 ACs marked `[ ]`.

8. **Kits and bulk-inventory pages lack documented hardening**: No 5-pass entries for `/kits`, `/kits/[id]`, `/bulk-inventory`.

9. **ItemBookingsTab has no pagination**: Loads all bookings unbounded. V2 item.

10. **4 separate fetch calls on detail mount**: Categories, departments, locations, `/api/me` fetched independently.

5. **4 separate fetch calls on detail mount**: `loadCategories`, `loadDepartments`, `loadLocations`, and `/api/me` are fetched independently without batching (pattern fragmentation noted in item-details-roadmap).

## Recommended Actions (prioritized)

1. ~~**[High] Fix N+1 in `attachActiveBookings()`**~~ — **False positive.** Already batched with `{ in: assetIds }`.

2. ~~**[Medium] Fix QR update and delete TOCTOU**~~ — **DONE 2026-04-06.** QR now catches P2002. Delete wrapped in `$transaction`.

3. **[Medium] Update AREA_ITEMS.md changelog** — Add entries for: favorites UI, CSV export, summary bar, column persistence, detail page hardening. Bump Last Updated.

4. **[Medium] Harden kits pages** — `/kits` and `/kits/[id]` need formal hardening pass (401 handling, error differentiation, double-click guards).

5. **[Medium] Harden bulk-inventory page** — `/bulk-inventory` needs formal hardening pass.

6. **[Low] Check off BRIEF_ITEM_BUNDLING_V1.md ACs** — All 9 ACs met. Update `[ ]` → `[x]`.

7. **[Low] Add pagination to ItemBookingsTab** — Currently loads all bookings unbounded.

8. **[Optional] Batch detail page mount fetches** — Replace 4 separate fetches with single init endpoint.

## Roadmap Status

| Version | Status | Notes |
|---|---|---|
| Items list V1 | **Complete** | All 5 polish items shipped (notes, summary, export, favorites, column persistence). |
| Items list V2 | Not started | 8 features: quick chips, saved presets, inline edit, React Query, cross-links, optimistic UI, filtered export, Cmd+N. |
| Items list V3 | Not started | 8 features: suggestions, low-stock alerts, compare, real-time, smart grouping, batch labels, depreciation, predictive maintenance. |
| Item detail V1 | **Mostly complete** | 6 of 7 items shipped (data flow, errors, refresh, breadcrumb, tab overflow, tab counts). V1.7 (notes display) not shipped. |
| Item detail V2 | Not started | 7 features: favorite toggle, print QR, booking pagination, batch mount fetches, React Query, related items, consumable flag. |
| Item detail V3 | Not started | Features: real-time, maintenance scheduling, depreciation chart, version history, collaborative indicators. |
| Item picker | Documented | `item-picker-roadmap.md` exists with FormCombobox normalization plan. |
