# Items Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Items
**Overall Verdict**: Ship-ready (21/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_ITEMS.md is comprehensive (378 lines) with detailed IA for list, create, and detail surfaces. All 14 ACs checked. V1 spec covers serialized + bulk items, numbered tracking (D-022), accessories (D-023). |
| Hardening | 4/5 | Items list: 5-pass hardened (AbortController, skeletons, error differentiation, double-click guards). Item detail: hardened (AbortController, 401 redirect, refresh-preserves-data, error differentiation, visibility refresh). Kits/bulk-inventory pages less documented. |
| Roadmap | 5/5 | Three roadmap files: `items-roadmap.md` (list V1-V3), `item-details-roadmap.md` (detail V1-V3), `item-picker-roadmap.md`. V1 polish items shipped. V2/V3 well-scoped. |
| Feature completeness | 4/5 | All 14 ACs met. V1 roadmap polish items shipped (notes, summary bar, export, favorites, column persistence). Missing: consumable flag UI, primaryScanCode editing, notes display on detail page (V1.7 in detail roadmap). |
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
| Notes display on detail page | Missing | item-details-roadmap V1.7 | Stored as JSON metadata, no dedicated section. |
| Detail page notes section | Specced | item-details-roadmap V1.7 | Not yet implemented. |
| React Query migration | Specced | items-roadmap V2.4 | Manual fetch+useState still in use. |
| Quick filter chips | Specced | items-roadmap V2.1 | Predefined filter shortcuts. |
| Inline quick-edit on list | Specced | items-roadmap V2.3 | Click cell to edit. |
| Saved filter presets | Specced | items-roadmap V2.2 | localStorage presets. |

## Open Gaps & Blockers

### No open gaps in GAPS_AND_RISKS.md
All items-related gaps are closed (GAP-17, GAP-22, GAP-25, GAP-E, PD-4).

### Discovered during audit

1. **AREA_ITEMS.md stale**: Last updated 2026-03-25. Missing changelog entries for favorites (GAP-22 closed 2026-03-28), export shipped, summary bar shipped, detail page hardening (AbortController, 401 redirect, error differentiation, breadcrumb, tab overflow, tab counts — all shipped per item-details-roadmap V1).

2. **Detail page notes section not shipped**: `item-details-roadmap.md` V1.7 "Notes display" is not checked off and appears unimplemented. The notes field is editable in the Info tab metadata but lacks a dedicated display section.

3. **Kits and bulk-inventory pages lack documented hardening**: No 5-pass hardening entries in AREA docs or git log for `/kits`, `/kits/[id]`, `/bulk-inventory`. These pages use `useFetch` hook (which provides some resilience) but haven't been through the formal hardening process.

4. **ItemBookingsTab has no pagination**: Booking history in the Bookings tab loads all bookings for an item. For frequently-used equipment, this could grow unbounded. The item-details-roadmap notes this as a V2 item.

5. **4 separate fetch calls on detail mount**: `loadCategories`, `loadDepartments`, `loadLocations`, and `/api/me` are fetched independently without batching (pattern fragmentation noted in item-details-roadmap).

## Recommended Actions (prioritized)

1. **[Medium] Update AREA_ITEMS.md changelog** — Add entries for: favorites UI (GAP-22), CSV export, summary bar, column persistence, detail page hardening (V1 items 1-6 from item-details-roadmap). Bump Last Updated to current date.

2. **[Medium] Harden kits pages** — `/kits` and `/kits/[id]` haven't been through formal hardening. Run `/harden-page` on both to check for missing 401 handling, error differentiation, double-click guards, mobile behavior.

3. **[Medium] Harden bulk-inventory page** — `/bulk-inventory` lacks documented hardening. Run `/harden-page` to verify resilience patterns.

4. **[Low] Add notes display to detail Info tab** — item-details-roadmap V1.7. Show notes field as a read-only or inline-editable section rather than buried in JSON metadata.

5. **[Low] Add pagination to ItemBookingsTab** — Currently loads all bookings. Add cursor-based pagination (same pattern as UserActivityTab).

6. **[Optional] Batch detail page mount fetches** — Replace 4 separate fetches (categories, departments, locations, me) with a single `/api/items-page-init`-style endpoint or use the existing one.

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
