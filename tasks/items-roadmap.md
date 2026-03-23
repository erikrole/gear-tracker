# Items Page Roadmap

## Context

The Items page (`/items`) is the most feature-rich page in the gear-tracker app — a complete inventory management interface for Wisconsin Athletics Creative. It serves as the primary hub for managing serialized and bulk equipment across the organization.

This roadmap identifies gaps in the shipped V1 and designs progressive enhancements (V2, V3). Each version is independently shippable and feels complete.

---

## Current State Assessment

### What works well (keep in all versions)
- Responsive table/cards via `useIsMobile`, 44px mobile tap targets
- 6 filter dimensions (status, location, category, brand, department, accessories toggle)
- Full-text search across 9 fields (assetTag, brand, model, serialNumber, name, notes, category, location, department)
- Sorting by 7 columns with URL state persistence
- Pagination (25/page default, configurable) with keyboard shortcuts (`/` to search, Escape to clear, arrow keys for pagination)
- Bulk actions: move location, change category, retire, maintenance
- Single-item actions: open, duplicate, maintenance, retire (with confirmation dialog)
- New Item sheet (serialized + bulk forms) with QR scanner on mobile
- Detail page: 7 tabs (Info, Bookings, Calendar, Insights, History, Accessories, Settings)
- Inline editing via `SaveableField` pattern on detail page
- Image upload to Vercel Blob
- Utilization insights with Recharts (30d/90d/1yr/all-time windows)
- Audit history feed with diff tracking
- Accessories attach/detach with search (D-023)
- 4 custom hooks: `use-url-filters`, `use-items-query`, `use-filter-options`, `use-bulk-actions`
- AbortController for race condition prevention on rapid filter changes
- Differentiated empty states (no inventory vs no matches vs load error)
- Loading skeleton matches actual table layout

### What's missing or incomplete
- `consumable` flag exists in schema — NOT surfaced in create form, list, or detail UI
- `primaryScanCode` field — not editable anywhere in UI
- Favorite toggle — API endpoint exists (`POST /api/assets/{id}/favorite`) but NO UI on list or detail
- `notes` field — not in serialized create form (fiscal year stored as JSON in notes field — hack)
- CSV export — import exists via `/import` but no export capability
- Column visibility — resets on page refresh (not persisted to localStorage)
- Kit membership display — `kitMemberships` relation exists but no UI (blocked by GAP-10)
- AREA_ITEMS.md spec mentions "Export visible to ADMIN/STAFF" but button doesn't exist
- Spec mentions "Flag" and "Kit status" filters — not implemented
- No inventory summary (e.g., "142 items · 12 checked out · 3 in maintenance")

### Schema data available but not surfaced
| Field | In Schema | In Create Form | In List | In Detail |
|-------|-----------|---------------|---------|-----------|
| `consumable` | ✅ | ❌ | ❌ | ❌ |
| `primaryScanCode` | ✅ | ❌ | ❌ | ❌ |
| `notes` | ✅ | ❌ | ❌ | ✅ (edit only) |
| `favoritedBy` | ✅ | n/a | ❌ | ❌ |
| `kitMemberships` | ✅ | n/a | ❌ | ❌ |

### Roles
- **ADMIN/STAFF**: Full CRUD, bulk actions, create/import, inline edit on detail
- **STUDENT**: View-only (list + detail), no create/edit/bulk actions

### Mobile viability
Good. Card view on <768px, bottom nav includes Items, 44px tap targets, QR scanner in create flow. Summary bar and export are the only gaps.

---

## V1 — Polish (complete the shipped V1)

**Principle:** Close the gap between what AREA_ITEMS.md specifies and what's actually built. No new paradigms. Achievable in 1-2 sessions.

### Features

#### 1. Notes textarea in create form
Add `notes` field to `SerializedItemForm` and `BulkItemForm` under a "Notes" section.
- **Component**: shadcn `Textarea`
- **File**: `src/app/(app)/items/new-item-sheet/SerializedItemForm.tsx`, `BulkItemForm.tsx`
- **API**: `POST /api/assets` already accepts `notes` field
- **Schema**: No changes — `notes String?` already exists on Asset

#### 2. Inventory summary bar
Show "X items total · Y checked out · Z maintenance" above the table.
- **Component**: Simple `div` with shadcn `Badge` variants for counts
- **File**: New component in `src/app/(app)/items/components/items-summary.tsx`
- **API**: Extend `GET /api/assets` response to include `statusBreakdown: { available: N, checkedOut: N, reserved: N, maintenance: N, retired: N }`
- **RBAC**: Visible to all roles

#### 3. CSV export
"Export" button in toolbar, ADMIN/STAFF only. Exports current filtered view.
- **Component**: shadcn `Button` with download icon
- **File**: Add to `ItemsToolbar`, new `GET /api/assets/export` endpoint
- **API**: New route reuses existing filter/query logic from `GET /api/assets`, returns `text/csv` stream
- **RBAC**: ADMIN/STAFF only
- **Mobile**: Hidden on mobile (not useful on phone in the field)

#### 4. Column visibility persistence
Save column visibility to localStorage on change, restore on mount.
- **Component**: No new components — wire existing `columnVisibility` state
- **File**: `src/app/(app)/items/page.tsx`
- **Key**: `items-column-visibility` in localStorage
- **Schema**: No changes

#### 5. Favorite star toggle
Star icon on list rows and detail page header. All roles.
- **Component**: `Star`/`StarOff` from lucide-react, wrapped in shadcn `Button` (ghost, icon size)
- **File**: `src/app/(app)/items/columns.tsx` (list), `src/app/(app)/items/[id]/page.tsx` (detail)
- **API**: `POST /api/assets/{id}/favorite` already exists. Extend `GET /api/assets` to include `isFavorited` boolean per item.
- **RBAC**: All roles (personal preference)
- **Mobile**: 44px tap target, positioned in card header

### NOT included in V1
- Consumable flag UI (needs design for how it affects checkout flow — defer to separate brief)
- Item kind column in list (serialized vs bulk are on separate pages: `/items` vs `/bulk-inventory`)
- Flag filter, Kit status filter (blocked by kit management GAP-10)
- React Query migration (V2)
- Saved filter presets (V2)
- Inline editing on list (V2)

### Loading, error, and empty states
- **Export**: Button shows spinner during download, toast on error
- **Favorite**: Optimistic toggle with rollback on error
- **Summary bar**: Skeleton strip while loading, hidden on load error

### Build order (Thin Slice Protocol)
1. API: Add `isFavorited` to `GET /api/assets` response + `statusBreakdown` metadata
2. API: Create `GET /api/assets/export` endpoint
3. UI: Notes textarea in create forms
4. UI: Favorite star on list + detail
5. UI: Column visibility localStorage persistence
6. UI: Export button in toolbar
7. UI: Summary bar above table

---

## V2 — Enhanced UX (reduce friction, faster workflows)

**Principle:** Make the page faster and smarter. Reduce clicks, improve discoverability, handle edge cases.

### Features

#### 1. Quick filter chips
Predefined filter shortcuts below search: "Checked Out", "Needs Maintenance", "My Favorites", "Recently Added".
- **Component**: shadcn `ToggleGroup` or clickable `Badge` components
- **Behavior**: Each chip applies a filter combination. Active chip is visually distinct. Mutually exclusive with manual filters (or additive — TBD).
- **RBAC**: All roles. "My Favorites" requires auth context.
- **Mobile**: Horizontally scrollable row below search input

#### 2. Saved filter presets
"Save current filters" action in toolbar dropdown. Named presets stored in localStorage. Max 5.
- **Component**: shadcn `Command` dropdown for preset selection
- **Storage**: `localStorage` key `items-filter-presets`
- **RBAC**: All roles (personal, client-side)

#### 3. Inline quick-edit on list
Click location or category cell to edit via popover with combobox. ADMIN/STAFF only.
- **Component**: shadcn `Popover` + existing `FormCombobox`
- **API**: Uses existing `PATCH /api/assets/{id}` endpoint
- **Behavior**: Optimistic update via React Query mutation
- **Mobile**: Opens full `Sheet` instead of popover (touch-friendly)

#### 4. React Query migration
Replace `use-items-query` manual fetch+useState with `@tanstack/react-query`.
- Fixes GAP-7 (pattern fragmentation) for this page
- Enables automatic background refresh, stale-while-revalidate
- Shared cache across components (GAP-11)
- **Package**: `@tanstack/react-query`
- **Files**: `use-items-query.ts` → rewrite, `use-bulk-actions.ts` → `useMutation`

#### 5. Cross-page deep links
- Dashboard overdue items link directly to `/items/{id}`
- Reports drill-down links to filtered items list (e.g., `/items?status=MAINTENANCE`)
- **Dependencies**: Coordinate with AREA_DASHBOARD and reports page

#### 6. Optimistic UI for all actions
Maintenance toggle, favorite, retire — update UI immediately, rollback on error.
- React Query `useMutation` with `onMutate`/`onError`/`onSettled`
- **Prerequisite**: React Query migration (#4)

#### 7. Bulk export with filters
Export button applies current search/filter/sort state.
- Shows "Exporting X items..." toast with progress
- **Enhancement to V1 export** — V1 exports all; V2 exports filtered view

#### 8. Keyboard shortcut: Cmd+N
Opens New Item sheet. Add to existing `use-keyboard-shortcuts` hook.

### What V1 features get enhanced
- Favorite star → gets optimistic update (was simple refetch)
- Export → applies current filters (was all items)
- Column visibility → also persists sort preference

### NOT included in V2
- Predictive suggestions (V3)
- Real-time updates (V3)
- Analytics/comparisons (V3)
- Smart grouping (V3)

### Schema changes
None.

### Build order
1. React Query setup + `use-items-query` migration
2. Optimistic mutations for all actions
3. Quick filter chips
4. Inline quick-edit cells
5. Saved filter presets
6. Cross-page deep links (coordinate with other pages)
7. Keyboard shortcut additions

---

## V3 — Advanced (predictive, automated, intelligent)

**Principle:** The page anticipates user needs. It surfaces the right information at the right time and automates repetitive workflows.

### Features

#### 1. Sport-based item suggestions
When creating a checkout, suggest items commonly used for the selected sport/event type.
- **API**: New `GET /api/assets/suggestions?sportId=X` — aggregates historical booking data
- **UI**: "Suggested for [Sport]" section in equipment picker
- **Note**: May be better placed on checkout page than items page — evaluate during design

#### 2. Low-stock alerts for consumables
Banner or badge on bulk items below `minThreshold`.
- **List**: Warning badge on low-stock rows
- **Dashboard**: Cron-triggered notification for ADMIN when stock drops below threshold
- **Prerequisite**: Consumable flag surfaced in UI

#### 3. Comparative analytics
Select 2-3 items → "Compare" bulk action → side-by-side utilization charts.
- **Component**: shadcn `ChartContainer` + Recharts
- **Data**: Reuses existing `/api/assets/{id}/insights` endpoint per item
- **UI**: Modal or new page with multi-item chart overlay

#### 4. Real-time status updates
Polling every 30s when tab is focused.
- Via React Query `refetchInterval` (V2 prerequisite)
- Shows subtle "updated X seconds ago" indicator
- **Alternative**: Server-Sent Events for instant updates (more complex)

#### 5. Smart grouping views
Toggle between flat list and grouped views: by location, by category, by utilization tier.
- **Component**: shadcn `Collapsible` for group headers with summary counts
- **UI**: View toggle in toolbar (flat | grouped)

#### 6. Batch QR label printing
Select items → "Print labels" bulk action → PDF with physical label layout.
- Layout: Black background, white text/QR, ~0.47 aspect ratio (per AREA_ITEMS spec)
- **Library**: `@react-pdf/renderer` or browser print API
- **RBAC**: ADMIN/STAFF only

#### 7. Item depreciation timeline
Insights tab: value depreciation curve from purchase price → residual value over time.
- **Prerequisite**: Purchase date and residual value populated on items
- **Component**: Recharts `AreaChart` within existing Insights tab

#### 8. Predictive maintenance
Flag items that may need maintenance based on usage patterns.
- Factors: checkout frequency vs historical average, time since last maintenance, total bookings
- Shows "Maintenance suggested" soft indicator (orange dot) on list and detail
- **Not blocking**: suggestion only, staff decides

### Schema changes
- Add `lastMaintenanceDate DateTime?` to Asset model
- Add `maintenanceIntervalDays Int?` to Asset model (optional per-item schedule)
- May need `ItemSuggestionCache` model for pre-computed sport→item mappings

### Dependencies
- V2 React Query migration (required for polling in #4)
- Kit management shipped (for kit-based grouping in #5)
- Consumable flag in UI (for #2)
- PDF generation library (for #6)

### Build order
1. Schema: Add maintenance tracking fields + migration
2. API: Suggestions endpoint, low-stock query
3. UI: Low-stock alerts on list
4. UI: Smart grouping views
5. UI: Comparative analytics view
6. UI: Batch label printing
7. UI: Real-time polling
8. UI: Predictive maintenance indicators
9. UI: Depreciation timeline chart

---

## Risks

### V1 scope creep
- **Consumable flag**: Temptation to add it — resist. It affects checkout flow logic (D-022) and needs a separate design brief.
- **Saved presets**: Don't build in V1. Column persistence via localStorage is sufficient.
- **Inline list editing**: Feels like polish but it's a UX paradigm shift. Keep in V2.

### V2 YAGNI
- **Saved filter presets**: May be underused if quick chips cover the common cases. Ship chips first, evaluate.
- **Cross-page deep links**: Requires coordination with 2+ other pages. Could slip scope. Start with dashboard → items only.

### V3 questionable ROI
- **Predictive maintenance**: Not enough historical data in the near term (system is new). Revisit after 6+ months of usage.
- **Sport-based suggestions**: Useful concept, but may belong on the checkout page, not items page. Validate placement.
- **Real-time polling**: With 2-3 concurrent users, polling adds server load for minimal benefit. SSE would be better but more complex.

### Tight coupling
- **React Query migration (V2)**: Big refactor with regression risk. Must be done as isolated slice with thorough testing.
- **Batch label printing (V3)**: Depends on physical label spec compliance. Needs user validation with actual printed labels.

---

## Summary

| Version | Theme | Key Deliverables | Sessions |
|---------|-------|-----------------|----------|
| V1 | Polish | Notes in create, summary bar, CSV export, column persistence, favorites | 1-2 |
| V2 | Speed | React Query, quick chips, inline edit, optimistic UI, cross-links | 3-4 |
| V3 | Intelligence | Suggestions, low-stock, compare, real-time, labels, predictive | 5-8 |

Each version is independently complete. V1 closes spec gaps. V2 makes daily operations faster. V3 makes the system proactive.
