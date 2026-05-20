# Gear Tracker Design Language

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-20
- Status: Active
- Purpose: Define the UI and UX rules that keep Gear Tracker cohesive, fast, dense, calm, and operationally clear.

## Highest-Impact Findings
1. Gear Tracker already has the right foundation: shadcn/ui primitives, semantic status colors, `PageHeader`, tag-first item identity, role-aware navigation, and operational queue surfaces.
2. The drift is route-level: pages solve the same problems with slightly different headers, metric cards, partial-result warnings, filter shells, and state copy.
3. Green misuse is the easiest trust bug to introduce. Green means available/free. Waiting, pending, maintenance, and pickup handoff states are orange.
4. Small icon controls are operational risk, not polish debt. Every action target needs a real label, visible focus, and at least a 40px target on web.
5. Future work should standardize shared surfaces before inventing page-local UI. Prefer `PageHeader`, `OperationalToolbar`, `OperationalMetricCard`, `OperationalPartialResultsAlert`, `Badge`, `Button`, `Input`, `Select`, `ToggleGroup`, `Switch`, `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Table`, and `Card`.

## Product Personality
Gear Tracker should feel:
1. **Operational**: every screen should answer what needs action, who owns it, and where to go next.
2. **Dense but readable**: favor compact rows, clear grouping, and restrained spacing over large promotional panels.
3. **Calm under pressure**: urgent work is obvious, but the app should not look noisy when nothing is wrong.
4. **Trustworthy**: status, color, and labels must match lifecycle truth. Never make pending work look complete.
5. **Fast**: high-frequency actions should be reachable without extra navigation or explanatory copy.
6. **Role-aware**: students see the work they can act on; staff and admins get global controls without hiding the state model.
7. **Repair-oriented**: admin surfaces should reduce daily checking by linking to the existing repair surface, not by adding another report.

Avoid:
- Marketing hero layouts, oversized cards, chart-first dashboards, decorative gradients, and copy that explains the obvious.
- Custom primitives when a shadcn/ui component exists.
- Green for anything that is not available/free in the gear lifecycle.
- Nested interactive controls, hidden hover-only controls on touch layouts, and text-only icon substitutes when a standard icon exists.

## Visual Language
### Layout
- Use `PageHeader` for page title, optional description, and right-side actions.
- Use page sections as full-width groups or direct content, not cards inside cards.
- Use `OperationalToolbar` for search, filters, quick toggles, and clear actions on operational list pages.
- Keep settings sub-pages under the Settings layout header and grouped Settings navigation; use `SettingsPageShell` for the compact section intro and main content, and do not render page-level `h1` inside sub-pages.

### Spacing And Density
- Default operational surfaces should use compact spacing: `gap-2` to `gap-4`, `p-2` to `p-4`, rows at 44px+ where clickable.
- Keep repeated list rows dense and stable. Hover, badges, thumbnails, and inline actions must not resize the row.
- Use cards for repeated items, modals, queue cards, and framed tools. Do not wrap whole pages in decorative cards.

### Typography
- Labels first, numbers second. Metric cards use small uppercase labels and tabular numbers.
- Use hero-scale type only for real top-level page headers.
- Use sentence-case table headers and action labels.
- Do not scale fonts with viewport width. Let layout adapt instead.

### Color
- Follow `docs/COLOR_SYSTEM.md`.
- Green = available/free.
- Blue = active use.
- Purple = reserved/claimed.
- Orange = warning/waiting/pending/maintenance.
- Red = overdue, destructive, blocked, or failed.
- Gray = inactive, terminal, draft, retired, or neutral.

### Borders And Shape
- Use `rounded-md` or smaller for operational controls and cards unless the shadcn primitive dictates otherwise.
- Use subtle borders and `shadow-xs` only when a surface needs separation.
- Left rails and alert tint should reinforce status semantics, not brand decoration.

### Icons And Motion
- Use lucide icons inside buttons when an icon exists.
- Icon-only buttons need accessible names and at least 40px targets.
- Motion should be short and functional: focus, hover, active press, refresh spin, loading skeleton. No decorative motion.

## Component Language
- **Buttons**: shadcn `Button`; primary action first; destructive actions use confirmations; icon buttons require `aria-label`.
- **Forms**: shadcn `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Combobox` where available; show form-level errors for API, validation, permission, and network failures.
- **Dialogs**: `Dialog` for create/edit flows; `AlertDialog` for destructive or irreversible choices; `Sheet` or `Drawer` for contextual details.
- **Tables**: shadcn `Table`; compact rows; sticky headers when useful; row click and row actions must be siblings, not nested.
- **Row actions**: use `OperationalRowActions` for icon overflow menus in operational rows; keep the trigger 40px, give it a specific accessible label, and use destructive menu variants for destructive actions.
- **Settings row actions**: use `OperationalRowActions` for Settings table/list rows with destructive actions, lifecycle changes, or multiple row commands. Direct inline buttons are only for primary page actions, toggles, and form submit/cancel controls.
- **Filters**: `OperationalToolbar` shell; search first, mode controls next, filter disclosure after; clear action visible when filters are active.
- **Active filters**: use `OperationalActiveFilterChips` under operational toolbars so users can see and remove individual filters without reopening the filter panel.
- **Badges**: use `Badge` semantic variants; do not define ad-hoc status color classes inline.
- **Cards**: use for repeated queue items and focused tools; avoid cards inside cards.
- **Nav**: role-aware, predictable, and stable; hidden routes must also be server-protected.
- **Empty states**: use `EmptyState`; explain the state and offer the next useful action when one exists. Use `inline` for card/table interiors so empty rows stay compact but still carry an icon, title, and recovery copy.
- **Alerts**: use warnings for partial data and stale reads; destructive alerts are for failed/blocking work.
- **Toasts**: use for completed background actions and refresh/save feedback; do not rely on toast as the only form error.

## Workflow Language
- **Create**: "Add {thing}" for starting; "Create {thing}" for final submit; show the post-submit handoff.
- **Edit**: inline edits should save with clear success/failure state; bulk edits need a visible pending/disabled state.
- **Delete**: avoid where history matters. Prefer "Cancel", "Deactivate", "Archive", or "Retire" when those are the true lifecycle actions.
- **Assign**: use "Assign" for staff choosing an owner or worker; use "Claim" only when the current user is taking something.
- **Scan**: app `/scan` is lookup-only. Pickup and return scans belong to kiosk flows.
- **Schedule**: use event, shift, and coverage language. Keep dashboard event widgets read-only unless the full management surface is intentionally opened.
- **Approve**: say what will happen after approval, especially for shift trades and requests.
- **Invite**: email is not assumed. User creation should expose the temporary-password handoff when mail delivery is not wired.
- **Recover**: drafts, skipped cleanup records, and partial results need a visible return path.

## Content Language
- Labels should name the object and action plainly: `Add item`, `New checkout`, `Pending pickup`, `Checked out`, `Reserved window`.
- Helper text should reduce mistakes, not explain the interface.
- Errors should say what failed and what to do next: `Could not load the admin queue. Retry.`
- Confirmation text should name the target and consequence.
- Success messages should be short: `Saved`, `Inventory hygiene refreshed`, `Checkout created`.
- Admin warnings should be direct: `Refresh before treating a clean result as final.`

## Accessibility Baseline
Non-negotiable for every page:
1. All controls are keyboard reachable.
2. Focus is visible and not clipped.
3. Icon-only controls have `aria-label`.
4. Interactive targets are at least 40px, and 44px where touch is primary.
5. Labels are programmatically connected to inputs.
6. Error and status changes are visible and announced when they affect the user's next action.
7. Color never carries the only meaning; pair color with labels, icons, or copy.
8. Avoid nested interactive elements.
9. Tables retain headers and row action labels for screen readers.
10. Loading and refreshing states preserve previous data when possible.

## Feature Improvement Pass
System rules, not feature ideas:
- Shared queue surfaces should use `OperationalMetricCard` and `OperationalPartialResultsAlert`.
- Shared list command surfaces should use `OperationalToolbar`.
- Shared page headings should use `PageHeader`.
- Status indicators should import the existing status-color helpers where available.

Feature ideas to consider separately:
- Authenticated visual regression smoke for dashboard, items, users, scan, settings, booking creation, Fix Today, and Hygiene.
- Apply the existing `OperationalRowActions` pattern to remaining operational menus instead of creating route-local dropdown wrappers.
- A reusable partial-results payload type for API routes returning `partialFailures`.
- Continue replacing local text-only empty rows with `EmptyState inline` in remaining admin tables when those surfaces are touched.

## Consistency Audit
- `/dashboard`: pending pickup previously used green row accent. Fixed to orange waiting semantics.
- `/checkouts/new` confirmation: checkout handoff previously looked complete. Fixed to pending kiosk pickup language.
- `/scan`: custom page heading and small controls drifted from shared page/header and target-size rules. Header and controls now align.
- `/items`: toolbar was the best existing command surface. It now uses `OperationalToolbar` and shared active-filter chips.
- `/items` row actions: table overflow actions now use `OperationalRowActions`.
- `/bookings`: table rows, mobile rows, and booking cards now use `OperationalRowActions` for overflow commands while preserving right-click context menus.
- `/schedule` Trade Board: claim and staff approval stay visible; cancel and decline now use `OperationalRowActions` as secondary/destructive row commands.
- `/schedule` Trade Board filters: active Area, Status, and My trades filters now use `OperationalActiveFilterChips`.
- `/users`: filter surface matched the idea but used smaller controls and its own frame. It now uses `OperationalToolbar`, 40px controls, and shared active-filter chips.
- `/settings/categories`: category row actions now use the shared row-action trigger instead of a page-local kebab button.
- `/settings/categories`, `/settings/departments`, `/settings/locations`, `/settings/allowed-emails`, `/settings/calendar-sources`, `/settings/venue-mappings`, `/settings/bookings`, and `/settings/kiosk-devices`: local text-only empty rows now use shared inline empty states.
- `/settings/departments`, `/settings/locations`, `/settings/allowed-emails`, `/settings/calendar-sources`, `/settings/venue-mappings`, and `/settings/kiosk-devices`: table/list row actions now use the shared row-action trigger for lifecycle and destructive commands.
- `/admin/fix-today` and `/items/hygiene`: duplicate metric and partial-results patterns now use shared primitives.
- `/settings`: uses `PageHeader` plus role-aware grouped navigation. Large desktop uses a left rail; smaller screens keep a horizontal section scroller. Sub-pages now share `SettingsPageShell` for the compact intro/main split.
- `/reports/checkouts`, `/reports/scans`, and `/reports/audit`: non-default period and phase filters now render removable shared active-filter chips through the report toolbar.
- `/items/[id]`: item detail secondary actions now use the shared dropdown wrapper instead of a route-local menu shell.
- `/bulk-inventory/[id]`: unit-tracked item-family units tab now uses shared inline empty states when no units exist.

## Implementation Roadmap
Quick wins:
- Keep replacing page-local metric cards and partial-result warnings with shared primitives.
- Convert route-local filter shells to `OperationalToolbar` when they match the search/filter/clear pattern.
- Audit icon-only buttons for labels and target size during each page pass.
- Keep Settings sub-pages on `SettingsPageShell`; new Settings pages should not copy local split-grid markup.

Medium slices:
- Keep active-filter chips shared through `OperationalActiveFilterChips`.
- Standardize remaining row action menus across Users and any future operational tables.
- Keep operational empty states on `EmptyState`, using the inline mode for table/card interiors.

Larger design-system work:
- Add authenticated browser visual smoke coverage for the main operational surfaces.
- Create a route-by-route design-system conformance checklist.
- Consider a small internal examples page only if component usage starts drifting again.

## Verification Plan
For every UI/design-language slice:
1. Read relevant `AREA_*`, `BRIEF_*`, `DECISIONS.md`, and current code before editing.
2. Cross-reference sibling pages before standardizing.
3. Run `npx tsc --noEmit`.
4. Run `git diff --check`.
5. Run `npx next build`.
6. Browser-smoke changed routes. If unauthenticated, verify clean protected-route redirect and no console errors. If authenticated credentials are available, inspect the actual signed-in surface.
7. Update the relevant `AREA_*` doc and task ledger.
