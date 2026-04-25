# Mobile Operations Area Scope (V1 Student-First)

## Document Control
- Area: Mobile Operations
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-25
- Status: Active
- Version: V1

## Direction
Make mobile the fastest path for student daily work while keeping staff and admin controls available without cluttering student flows.

## Why This Exists
Cheqroom mobile patterns show useful primitives but too much menu depth and too many admin actions mixed into student workflows. Gear Tracker mobile should be role-adaptive, action-first, and low-friction for checkout and reservation execution.

## Core Rules
1. Mobile is a first-class operational surface, not a reduced desktop clone.
2. Student flows prioritize `My check-outs`, `My reservations`, due/overdue handling, and scan.
3. Role-adaptive actions apply everywhere:
   - `STUDENT`: own mutations only, broad read visibility.
   - `STAFF` and `ADMIN`: global mutation access per `AREA_USERS.md`.
4. Overdue is always visually red and sorted to the top.
5. Event sync supports booking context and prefill, but V1 mobile does not require an Upcoming Events dashboard section.
6. Tap targets stay at 44px or larger.

## Mobile Navigation Contract (V1)
1. Primary destinations:
   - Dashboard
   - Items
   - Reservations
   - Check-outs
   - Scan entry point
2. Navigation can use drawer or tab patterns, but must expose scan in one tap.
3. Student view should hide admin-only create/manage affordances outside allowed ownership scope.
4. Badge counts can appear on Reservations and Check-outs for overdue or due-today urgency.

## Dashboard on Mobile
1. Keep same dashboard information architecture as desktop (`AREA_DASHBOARD.md`).
2. Prioritize:
   - Overdue banner
   - Action lanes (Check-outs, Reservations)
   - My Gear in Custody
   - Drafts
3. Do not add chart-first widgets in V1.
4. Do not add standalone Upcoming Events section in V1.

## List and Row Interaction Contract
1. Reservation and check-out rows use card-like compact summaries:
   - Time window
   - Title
   - Owner
   - Status with color dot
   - Item thumbnail strip with overflow count
2. Primary row tap opens details.
3. Secondary actions open in action sheet.
4. Search and quick filters stay pinned near top for long lists.

## Scan Experience Contract
1. Scan entry is always reachable in one tap from mobile shell.
2. Camera permission failure path must include clear fallback instructions.
3. Scan results should route directly to item or booking context when possible.
4. Failed scans must show retry without losing workflow state.

## Performance and Reliability Expectations
1. First useful mobile list content should load without heavy dashboard widgets.
2. List read models should support lightweight pagination and filter updates.
3. Offline/intermittent network states should preserve drafts and pending intent where feasible.

## Edge Cases
- Student deep-linking into admin-only mutation paths.
- Camera permission denied or revoked after first use.
- Slow network causing stale list counts versus detail state.
- Event-linked booking where event later changes or disappears.
- Mixed-location returns requiring exception handling on mobile.

## Acceptance Criteria
- [x] AC-1: Student can find and act on own due or overdue check-outs within two taps from dashboard.
- [x] AC-2: Mobile reservations and check-outs views support search, status scope, and row-to-detail navigation.
- [x] AC-3: Overdue visual treatment is red across dashboard and list contexts.
- [x] AC-4: Scan entry point is always one tap from primary mobile navigation.
- [x] AC-5: Role-based action visibility on mobile matches `AREA_USERS.md` and server authorization.
- [x] AC-6: Dashboard remains chart-light and action-first in V1.

## Dependencies
- `AREA_DASHBOARD.md`
- `AREA_CHECKOUTS.md`
- `AREA_RESERVATIONS.md`
- `AREA_ITEMS.md`
- `AREA_USERS.md`
- `AREA_EVENTS.md`

## Out of Scope (V1)
1. Native mobile app build requirements.
2. Customizable widget dashboards per user.
3. Full offline-first booking mutation queue.

## Developer Brief (No Code)
1. Define a shared mobile interaction contract for row tap, action sheet, and quick actions.
2. Ensure dashboard and list surfaces prioritize due/overdue execution over reporting widgets.
3. Keep scan entry global and fast, with explicit permission and failure handling.
4. Enforce role-adaptive visibility so student mobile stays uncluttered and policy-safe.
5. Add mobile regression coverage for ownership gating, overdue styling, and row action parity.

## Breadcrumb Roadmap

Navigation breadcrumb versioned roadmap: `tasks/breadcrumbs-roadmap.md`

All versions shipped (2026-03-25):
- **V1**: ✅ Fixed duplicate breadcrumbs, mobile text truncation
- **V2**: ✅ Entity name display on detail pages, collapsible ellipsis for deep paths
- **V3**: ✅ Sibling quick-jump dropdown, recently visited entities
- **Polish**: ✅ Loading skeleton on detail pages, parent-level sibling dropdown

## Sidebar Roadmap

Navigation shell versioned roadmap: `tasks/sidebar-roadmap.md` (revised 2026-03-25)

- **V1 (shipped)**: `SidebarMenuBadge` on Bookings (overdue) + Notifications (unread), nav groups, quick-create — closes §4 of Mobile Navigation Contract
- **V2 (next)**: Scan nav item, Settings sub-nav, due-today badge, keyboard shortcuts
- **V3 (later)**: Bottom nav badge counts via live `/api/nav-counts` polling, game-day/shift context cards

## Change Log
- 2026-04-24: **iOS bookings audit fixes** — closes 1 P0 + 6 P1 + 3 P2 from `tasks/audit-bookings-ios.md`. P0/P1: (1) Tab switch cancels in-flight load via stored `Task` handle; (2) AC-5 hardening — toolbar `+`, requester picker, and edit pencil all role/ownership-gated; (3) pagination errors render inline Retry instead of forever-spinner; (4) Create + Edit sheets show "Discard changes?" + disable interactive dismiss while submitting; (5) FormCard / AssetPickerRow switched off hardcoded black for dark-mode parity. P2: (6) `nextCleanHour` rewritten with explicit `addingHours:` semantics; (7) toolbar Picker uses `maxWidth: 260` + `fixedSize` so it shrinks instead of clipping on narrow devices; (8) trailing pagination row uses `.task(id:)` instead of `.onAppear`. Two parity items deferred as GAP-34 (status filters/sort) and GAP-35 (conflict badges). Files: `ios/Wisconsin/Views/BookingsView.swift`, `BookingDetailView.swift`, `CreateBookingSheet.swift`. Build verification pending in Xcode.
- 2026-03-02: Initial mobile operations area scope created from Cheqroom mobile analysis and Gear Tracker role model.
- 2026-03-15: Student Mobile Hardening V1 shipped — STUDENT added to checkout.scan permission with server-side ownership gating, sidebar hides Users/Kits/Settings for STUDENT, team activity hidden on mobile for STUDENT, ownership border accent on My Gear rows.
- 2026-03-22: iPhone polish pass — (1) Fixed iOS input zoom: Input/Textarea/SelectTrigger use `text-base md:text-sm` (16px mobile, 13px desktop). (2) Global `-webkit-tap-highlight-color: transparent` on all interactive elements. (3) `overscroll-behavior-y: none` on body. (4) Booking detail header stacks title above action buttons on mobile (`flex-col sm:flex-row`). (5) Equipment card header stacks title above return buttons on mobile. (6) Row action menus always visible on mobile (hover-reveal only on sm+).
- 2026-03-23: Scan page hardening (5-pass) — Skeleton loading states, shadcn Alert for errors, optimistic checklist updates, auto-clear feedback, processingRef guards on all scan handlers, network drop recovery via try/catch/finally.
- 2026-03-24: Sidebar V1 badges shipped — closes §4 of Mobile Navigation Contract. Overdue badge on Checkouts, unread badge on Notifications nav item (both from AppShell parallel fetch). Semantic nav groups (Operations / Admin) with STUDENT seeing no Admin group. Kits moved to Admin group with "Soon" badge. GAP-10 closed. Hardening (5-pass): dead old-sidebar CSS removed (107 lines), AbortController cleanup on badge fetch, isLoggingOut guard on logout button, logout network-failure recovery, profile nav item removed (redundant with header avatar), group separators, count-aware collapsed tooltips. Stress test: fixed overdue badge always showing 0 (wrong response path dashJson.stats vs dashJson.data.stats); fixed system-wide overdue being shown to STUDENT (added user-scoped myOverdueCount to dashboard response).
- 2026-03-25: Doc sync — standardized ACs to checkbox format, all 6 checked.
- 2026-04-09: **Sidebar redesign** (commit ed6e2eb) — UW Athletics brand identity. Gotham brand font applied to nav labels for program-specific identity. Trailing item index numbers (01–09) in Geist Mono; turn Wisconsin Red on active. User role (ADMIN/STAFF/STUDENT) displayed in mono under name in user card. Section separator replaced with centered `─── ADMIN ───` rule. UW Athletics subtitle in mono above Gear Tracker wordmark. Active background tint reduced to 10% so left-border red does the signaling. File modified: `Sidebar.tsx` (262→165 lines net due to visual restructuring).
- 2026-04-09: **Booking list migrated to shadcn Table** (commit d1bbc8d) — Unified status visual system. `getStatusVisual` now returns Tailwind classes (`rowClass`/`titleClass`) instead of legacy CSS class names (`status-overdue`, etc.). `BookingRow` uses `TableRow`/`TableCell` instead of native tr/td. Dead CSS removed: `.hide-mobile`, `.row-link`, `.status-*` rules (37 lines). Cancelled gets `line-through`, completed gets `opacity-60`, overdue gets `text-destructive` — now consistent on mobile and desktop (previously mobile had no status styling). Files modified: `BookingListPage.tsx`, `BookingRow.tsx` (+66 lines, +rules → Tailwind), `SortHeader.tsx`, `BookingCard.tsx` (status styling). Globals.css cleaned (37 lines removed).
- 2026-04-09: **Linear/Notion design refresh** (commit 425a698) — Phases 0–3 of design refresh. Phase 0 (globals.css): WCAG AA contrast fixes on text-secondary/text-muted; deduplicate keyframes; remove legacy radius vars; touch target scoping; add login-bg utility. Phase 1 (components): button disabled:grayscale, tooltip delayDuration 200ms, skeleton shimmer in both themes, alert/alert-dialog semantic variants, select separator bg-border, card remove hover translate, motion reduce durations. Phase 2 (critical pages): calendar-sources, labels, database, allowed-emails, venue-mappings, categories, bulk-inventory → shadcn Table; remove inline styles; standardize headings. Phase 3 (medium-priority): import Alert, sports/escalation/notifications wrap in FadeUp, text-secondary → text-muted-foreground sweeps across search/badge/scan. Overall: 30+ files touched, legacy CSS marked DEPRECATED.
