# Design Language Route Conformance Checklist

## Scope

Area 3 of the design-language goal covers the first route-by-route conformance pass for:

- `/`
- `/schedule`
- `/items`
- `/bookings`
- `/users`
- `/settings`

The 2026-05-21 follow-up extends the checklist to lower-traffic operational routes:

- `/kits`
- `/licenses`
- `/resources`
- `/labels`
- `/notifications`
- `/search`
- `/reports/*`
- `/bulk-inventory/batteries`
- `/bulk-inventory/[id]`
- high-traffic detail pages such as `/items/[id]`, `/kits/[id]`, `/users/[id]`, and booking detail sheets

This is a working checklist, not a redesign brief. Use it before future page-specific UI work so route fixes stay tied to the shared operational system.

## Checklist Keys

- **Header**: uses `PageHeader`, or a documented route-owned shell when the parent layout owns the title.
- **Toolbar and filters**: uses `OperationalToolbar` and `OperationalActiveFilterChips` when the route has the standard search/filter/clear pattern.
- **Rows and actions**: row open behavior and row actions are siblings. Overflow menus use `OperationalRowActions`.
- **Empty, loading, error**: uses shared `EmptyState`, skeletons, retryable errors, and previous-data-preserving refresh where possible.
- **Targets and focus**: action targets are 40px minimum, keyboard focus is visible, icon-only controls have names.
- **Status and color**: lifecycle labels and colors follow `docs/DESIGN_LANGUAGE.md`; green only means available/free.
- **Copy**: labels explain the operational state and next action without raw enum leakage.
- **Evidence**: current source or proof artifact checked during this pass.
- **Next fix**: only concrete follow-up work, not taste notes.

## Route Summary

| Route | Status | Finding | Next Fix |
|---|---|---|---|
| `/` | Mostly conforming | Uses `PageHeader`, shared empty state, role-aware actions, stable stat strip, and queue columns. Dashboard-specific `StatCard` is acceptable because it is tightly tied to the home queue, but any new cross-route metric card should use `OperationalMetricCard`. | No immediate code fix. Keep future queue cards out of nested-card layouts and preserve orange pending-pickup semantics. |
| `/schedule` | Mostly conforming, intentional exception | Uses `PageHeader`, shadcn `Sheet`, shared `EmptyState` in list/trade surfaces, shadcn `ToggleGroup` for view and venue command groups, Trade Board active chips, and `OperationalRowActions` for trade secondary/destructive commands. `ScheduleFilters` remains route-local because it controls schedule-specific modes rather than a generic list toolbar. | No immediate code fix. Keep future Schedule controls shadcn-backed and preserve the command-bar exception. |
| `/items` | Strong | Uses `PageHeader`, `OperationalToolbar`, `OperationalActiveFilterChips`, shadcn table, shared empty states, stable pagination, and documented tag-first identity. | No immediate code fix. Keep item-family rows and serialized rows in one discovery surface, but do not add item-family-only custom controls unless they also meet the shared toolbar/row-action rules. |
| `/bookings` | Strong | Uses `PageHeader`, shadcn tabs/toggles, shared `BookingListPage`, `OperationalToolbar`, shared active-filter chips, shared empty states, and `OperationalRowActions` in table rows, mobile rows, and cards. The list content is still framed in a route-level `Card`, which is acceptable because the card owns filters plus results, not a decorative page section. | No immediate code fix. Do not disturb unified checkout/reservation behavior. |
| `/users` | Strong | Uses `PageHeader`, `OperationalToolbar`, `OperationalActiveFilterChips`, shadcn table, shared empty states, URL state, roster stats, and role-aware actions. | No immediate code fix. If row-level user actions expand beyond navigation, use `OperationalRowActions` instead of adding local icon menus. |
| `/settings` | Strong | Uses `PageHeader`, role-aware grouped rail, horizontal smaller-screen scroller, search command, overview map, and `SettingsPageShell` for the shared sub-page split. Area 4 aligned high-confidence sub-page drift in Bookings, Kiosk Devices, Allowed Emails, and Database Health. | No immediate code fix. Keep new Settings pages on `SettingsPageShell` and shared inline empty states. |
| `/kits` | Mostly conforming | Uses `PageHeader`, URL-backed search/filter/sort, shared `EmptyState`, shared `OperationalMetricCard` summary metrics, and responsive table/card layouts. The route-local filter shell remains acceptable until it needs the full search/filter/clear toolbar pattern. | No immediate code fix. Re-evaluate the search/location/archived row only when Kits gets more filter complexity. |
| `/licenses` | Strong | Uses `PageHeader`, shared `EmptyState`, explicit admin/user actions, `OperationalMetricCard` summary metrics, and lifecycle copy that matches the 2-slot license model. Compact header/admin controls now meet the 40px target baseline. | No immediate code fix. If license row actions expand, keep destructive actions in shared menu or dialogs with target/consequence copy. |
| `/resources` | Intentional exception | Uses `PageHeader`, shared `EmptyState`, URL-backed search/sort/filter state, shared active-filter chips, shadcn `Select`, and 40px search/filter/sort/contact controls, but the sticky left rail is a knowledge-base navigation model rather than a standard operational toolbar. | No immediate code fix. Keep the rail as the documented resources exception; avoid adding a second competing toolbar. |
| `/labels` | Mostly conforming | Uses `PageHeader` and shared `EmptyState`, and the surface is a focused print tool rather than a data table. Compact print setup and row escape controls now meet the 40px target baseline. | No immediate code fix. Keep future print controls named and at 40px targets. |
| `/notifications` | Strong | Uses `PageHeader`, shared `EmptyState`, direct notification actions, and `OperationalMetricCard` summary metrics. Mark-read, destination, retry, and header actions now meet the 40px target baseline. It remains intentionally list-first and read/recovery oriented. | No immediate code fix. |
| `/search` | Mostly conforming | Uses `PageHeader` and shared `EmptyState`, but global search is a specialized command surface rather than an `OperationalToolbar` list page. Clear search, view-all links, and result rows now meet the 40px target baseline. | No immediate code fix. Keep result actions explicit links/buttons. |
| `/reports/*` | Mostly conforming | Reports use shared layout, toolbar helpers, active-filter chips on key pages, shared empty states, role gating, and an adapter over `OperationalMetricCard` for report metrics. | No immediate code fix. Keep future report metrics behind the report adapter instead of adding page-local cards. |
| `/bulk-inventory/batteries` | Mostly conforming | Uses `PageHeader`, shared empty states, shared `OperationalMetricCard` summary metrics, and clear battery operations sections. | No immediate code fix. Keep unit status controls named and audited. |
| `/bulk-inventory/[id]` | Strong | Item-family detail surfaces use shared inline empty states and the shared image modal handoff. | No immediate code fix. Keep item-family detail copy aligned with Units and Quantity user language. |
| Detail pages | Mostly conforming | Item detail, booking detail, user detail, and kit detail mostly use shared empty states, shared row actions where actions exist, and explicit operational copy. Kit detail member-removal rows now use shared row actions and confirmed destructive copy. | Low follow-up: add detail pages to future visual smoke coverage after any page-specific edit. |

## Route Detail

### `/`

- **Header**: pass. `src/app/(app)/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: route-specific pass. Dashboard filter chips sit in a compact refresh/filter command group because the home surface is a queue, not a searchable table.
- **Rows and actions**: pass. Existing action handlers are role-aware and route through shared booking detail or wizard flows.
- **Empty, loading, error**: pass. Uses `DashboardSkeleton`, shared `EmptyState`, and cached stat-first rendering.
- **Targets and focus**: pass based on current visual proof and prior 40px dashboard/event control passes.
- **Status and color**: pass. Pending pickup is documented as orange, not green.
- **Copy**: pass. Queue labels use operational language such as Due today, Checked out, Reserved, and draft recovery.
- **Evidence**: `src/app/(app)/page.tsx`; authenticated screenshot `tasks/design-language-proof-dashboard.png`.

### `/schedule`

- **Header**: pass. `src/app/(app)/schedule/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: pass with documented exception. `ScheduleFilters` is route-local because it controls view mode, venue, coverage, my shifts, past events, and schedule-specific filters. View and venue groups now use shadcn `ToggleGroup`.
- **Rows and actions**: pass for Trade Board. Trade secondary/destructive commands use `OperationalRowActions`; visible primary actions remain visible.
- **Empty, loading, error**: pass in Trade Board and list surfaces.
- **Targets and focus**: pass. Command targets stay at the 40px baseline and segmented controls are shadcn-backed.
- **Status and color**: pass. Trade status mapping uses semantic badges.
- **Copy**: pass with one note: trade cancellation confirmation should name the event or shift in a future copy pass.
- **Evidence**: `src/app/(app)/schedule/page.tsx`, `src/app/(app)/schedule/_components/ScheduleFilters.tsx`, `src/components/TradeBoard.tsx`.

### `/items`

- **Header**: pass. `src/app/(app)/items/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: pass. `ItemsToolbar` uses `OperationalToolbar`, `OperationalActiveFilterChips`, shadcn inputs, switches, toggles, and filter controls.
- **Rows and actions**: pass. Item row overflow uses the shared row-action pattern through the table columns.
- **Empty, loading, error**: pass. Uses shared `EmptyState`, shadcn skeletons, and table/card skeletons.
- **Targets and focus**: pass. Header actions, toolbar controls, row controls, and image controls were covered in prior slices.
- **Status and color**: pass. Status buckets match the design-language color contract.
- **Copy**: pass. Item-family labels distinguish Standard, Units, and Quantity without exposing implementation names.
- **Evidence**: `src/app/(app)/items/page.tsx`, `src/app/(app)/items/components/items-toolbar.tsx`, `docs/AREA_ITEMS.md`, authenticated screenshots `tasks/design-language-proof-items.png` and `tasks/design-language-proof-item-scan-identity.png`.

### `/bookings`

- **Header**: pass. `src/app/(app)/bookings/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: pass. `BookingFilters` now uses `OperationalToolbar` and `OperationalActiveFilterChips`.
- **Rows and actions**: pass. Booking rows, mobile rows, and cards use `OperationalRowActions`; context menus keep the same action policy.
- **Empty, loading, error**: pass. `BookingListPage` uses shared empty states, retryable filter-load warning, skeletons, and cached-data refresh handling.
- **Targets and focus**: pass from Area 2 for shared booking picker controls and prior booking row-action pass.
- **Status and color**: pass with one watch item. UI status copy uses user-facing labels, but route config still includes internal values behind the scenes.
- **Copy**: pass. Active/Past scope language is clear and not a raw data dump.
- **Evidence**: `src/app/(app)/bookings/page.tsx`, `src/components/BookingListPage.tsx`, `docs/AREA_CHECKOUTS.md`, `docs/AREA_RESERVATIONS.md`.

### `/users`

- **Header**: pass. `src/app/(app)/users/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: pass. `UserFilters` uses `OperationalToolbar` and shared active-filter chips.
- **Rows and actions**: pass. Current row behavior is primarily navigation; there is no extra local row-action menu to standardize.
- **Empty, loading, error**: pass. Uses shared `EmptyState`, shadcn skeletons, and retry copy.
- **Targets and focus**: pass. Toolbar actions and filters meet the 40px control baseline.
- **Status and color**: pass. Role badges and inactive handling avoid using green for non-availability states.
- **Copy**: pass. Add user and temp-password handoff are documented in the area source and prior implementation.
- **Evidence**: `src/app/(app)/users/page.tsx`, `src/app/(app)/users/UserFilters.tsx`, `docs/AREA_USERS.md`, authenticated screenshot `tasks/design-language-proof-users.png`.

### `/settings`

- **Header**: pass. Settings layout owns the page header via `PageHeader`.
- **Toolbar and filters**: pass for navigation. The settings command/search palette is a navigation affordance, not an operational list toolbar.
- **Rows and actions**: pass at the shell level; sub-pages need the Area 4 inventory.
- **Empty, loading, error**: pass at overview and shell level. Sub-pages need follow-through verification.
- **Targets and focus**: pass for rail, strip, command entry, and overview cards.
- **Status and color**: pass. Role badges use Staff+, Admin, and Everyone labels rather than hiding policy.
- **Copy**: pass. Overview explains control domains without marketing language.
- **Evidence**: `src/app/(app)/settings/layout.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/SettingsPageShell.tsx`, `docs/AREA_SETTINGS.md`, authenticated screenshot `tasks/design-language-proof-settings.png`.

## First Decision From This Pass

Do not force every route into `OperationalToolbar`. Use it when the route has the shared search/filter/clear pattern. Keep route-specific command bars only when the controls represent domain-specific modes or workflows, as with `/schedule`.

## Lower-Traffic Route Detail

### `/kits`

- **Header**: pass. `src/app/(app)/kits/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: route-specific pass. Kits has URL-backed search, location, archived, sort, and clear behavior; it does not need `OperationalToolbar` until the filter set gets more complex.
- **Rows and actions**: pass for the current row shape. Kit name/open actions are real links.
- **Empty, loading, error**: pass. Uses shared `EmptyState` for no kits and filtered empty states.
- **Targets and focus**: mostly pass. Future row menus should use `OperationalRowActions`.
- **Status and color**: pass. Kit states are Empty, Ready, and Archived, not overloaded green.
- **Copy**: pass. Creation handoff and filtered-empty language are operational.
- **Evidence**: `docs/AREA_KITS.md`, `src/app/(app)/kits/page.tsx`.

### `/kits/[id]`

- **Header**: pass. The detail page now uses `PageHeader` with a location/content-count summary and 40px back/archive/delete controls.
- **Toolbar and filters**: route-specific pass. Serialized member search is a local add-member search, not a list-page filter toolbar.
- **Rows and actions**: pass. Serialized and bulk member removal now use `OperationalRowActions` with specific row labels.
- **Empty, loading, error**: pass. Empty serialized members use shared `EmptyState`; bulk-empty copy remains compact inside the bulk card.
- **Targets and focus**: pass for the touched actions. Member row overflow triggers and the add-member search clear control now meet the named-control target baseline.
- **Status and color**: pass. Member status uses semantic badges.
- **Copy**: pass for destructive member removal. Bulk removal now names the quantity and item family, and clarifies that stock is not deleted.
- **Evidence**: `docs/AREA_KITS.md`, `src/app/(app)/kits/[id]/page.tsx`, `src/app/api/kits/[id]/bulk-members/route.ts`.

### `/licenses`

- **Header**: pass. `src/app/(app)/licenses/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: route-specific pass. License controls are pool management actions, not a general list filter shell.
- **Rows and actions**: pass. The page uses explicit claim/release/admin dialogs rather than hidden local row menus.
- **Empty, loading, error**: pass. Uses shared `EmptyState`.
- **Targets and focus**: pass. Header refresh, retired toggle, export, bulk add, renew, and add controls now meet the 40px target baseline.
- **Status and color**: pass. Open, 1/2, Full, Retired, expiring, and expired map to the license domain.
- **Copy**: pass. The area doc is explicit about masking, unknown occupants, and destructive actions.
- **Evidence**: `docs/AREA_LICENSES.md`, `src/app/(app)/licenses/page.tsx`.

### `/resources`

- **Header**: pass. `src/app/(app)/resources/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: intentional exception. The sticky left rail and mobile filter sheet are correct for a knowledge-base directory.
- **Rows and actions**: pass. Resource cards and reader/edit actions are role-aware.
- **Empty, loading, error**: pass. Uses shared `EmptyState` for empty and filtered-empty cases.
- **Targets and focus**: pass. Search, filter sheet trigger, shadcn sort select, rail buttons, active filter removals, resource cards, contact links, and profile links now have visible focus and target sizing.
- **Status and color**: pass. Freshness and featured states are content metadata, not operational availability.
- **Copy**: pass. The surface reads as internal reference, not marketing.
- **Evidence**: `docs/AREA_RESOURCES.md`, `src/app/(app)/resources/page.tsx`.

### `/labels`

- **Header**: pass. `src/app/(app)/labels/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: route-specific pass. Label printing is a tool surface, not a table/list command bar.
- **Rows and actions**: pass at the checklist level; future label item actions should stay sibling controls.
- **Empty, loading, error**: pass. Uses shared `EmptyState`.
- **Targets and focus**: pass for the audited controls. Header, clear search, queue controls, and row escape links meet the 40px target baseline.
- **Status and color**: not applicable.
- **Copy**: mostly pass. Keep labels focused on print outcome and selected item count.
- **Evidence**: `src/app/(app)/labels/page.tsx`.

### `/notifications`

- **Header**: pass. `src/app/(app)/notifications/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: route-specific pass. Notification center is a personal queue, not a general data grid.
- **Rows and actions**: mostly pass. Keep read/deep-link actions explicit.
- **Empty, loading, error**: pass. Uses shared `EmptyState`.
- **Targets and focus**: pass. Header actions, retry, destination links, and mark-read actions now meet the 40px target baseline.
- **Status and color**: pass. Unread and urgency are text/icon-backed, not color-only.
- **Copy**: pass. Notification copy is action-oriented.
- **Evidence**: `docs/AREA_NOTIFICATIONS.md`, `src/app/(app)/notifications/page.tsx`.

### `/search`

- **Header**: pass. `src/app/(app)/search/page.tsx` uses `PageHeader`.
- **Toolbar and filters**: route-specific pass. Search is a global command surface.
- **Rows and actions**: mostly pass. Search result actions should stay explicit links/buttons.
- **Empty, loading, error**: pass. Uses shared `EmptyState`.
- **Targets and focus**: pass for the audited controls. Clear search, view-all links, and result rows meet the 40px target baseline.
- **Status and color**: not applicable.
- **Copy**: pass. Empty copy says what query failed and what to try next.
- **Evidence**: `src/app/(app)/search/page.tsx`.

### `/reports/*`

- **Header**: pass. `src/app/(app)/reports/layout.tsx` uses `PageHeader`.
- **Toolbar and filters**: mostly pass. `ReportToolbar` owns report controls and uses shared active-filter chips where filters are removable.
- **Rows and actions**: pass. Reports are read-only and deep-link where appropriate.
- **Empty, loading, error**: pass. Uses shared `ReportEmptyState` wrapping `EmptyState`.
- **Targets and focus**: mostly pass by source shape.
- **Status and color**: pass. Report metrics now route through the shared operational metric primitive via the report adapter.
- **Copy**: pass. Reports are read-only and operational.
- **Next fix**: none.
- **Evidence**: `docs/AREA_REPORTS.md`, `src/app/(app)/reports/report-ui.tsx`, `src/app/(app)/reports/MetricCard.tsx`.

### `/bulk-inventory/batteries` And `/bulk-inventory/[id]`

- **Header**: pass for Battery Ops. Detail route uses a route-owned item-family shell.
- **Toolbar and filters**: route-specific pass. Battery Ops is a cockpit, not a generic filterable table.
- **Rows and actions**: pass. Unit actions are domain-specific and audited.
- **Empty, loading, error**: pass. Recent slices moved checked-out units and unit detail empty rows to shared inline `EmptyState`.
- **Targets and focus**: mostly pass; re-check unit status actions on future edits.
- **Status and color**: pass. Available, checked out, missing, retired, and low families follow inventory semantics.
- **Copy**: pass. Uses Units and Quantity language for users, with implementation terms only where precision is needed.
- **Next fix**: none.
- **Evidence**: `docs/AREA_BULK_INVENTORY.md`, `src/app/(app)/bulk-inventory/batteries/page.tsx`, `src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx`.

## Current Next Fixes

1. Audit remaining low-traffic detail routes after page-specific edits, not as a standalone redesign pass.
2. If Kits filters expand, evaluate `OperationalToolbar`; do not migrate it preemptively while the current compact filter shell remains simpler.
3. Keep future Labels, Search, Notifications, Licenses, Resources, and user-detail assignment additions on named 40px controls.
