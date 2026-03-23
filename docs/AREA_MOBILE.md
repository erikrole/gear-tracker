# Mobile Operations Area Scope (V1 Student-First)

## Document Control
- Area: Mobile Operations
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-02
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
1. Student can find and act on own due or overdue check-outs within two taps from dashboard.
2. Mobile reservations and check-outs views support search, status scope, and row-to-detail navigation.
3. Overdue visual treatment is red across dashboard and list contexts.
4. Scan entry point is always one tap from primary mobile navigation.
5. Role-based action visibility on mobile matches `AREA_USERS.md` and server authorization.
6. Dashboard remains chart-light and action-first in V1.

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

## Change Log
- 2026-03-02: Initial mobile operations area scope created from Cheqroom mobile analysis and Gear Tracker role model.
- 2026-03-15: Student Mobile Hardening V1 shipped — STUDENT added to checkout.scan permission with server-side ownership gating, sidebar hides Users/Kits/Settings for STUDENT, team activity hidden on mobile for STUDENT, ownership border accent on My Gear rows.
- 2026-03-22: iPhone polish pass — (1) Fixed iOS input zoom: Input/Textarea/SelectTrigger use `text-base md:text-sm` (16px mobile, 13px desktop). (2) Global `-webkit-tap-highlight-color: transparent` on all interactive elements. (3) `overscroll-behavior-y: none` on body. (4) Booking detail header stacks title above action buttons on mobile (`flex-col sm:flex-row`). (5) Equipment card header stacks title above return buttons on mobile. (6) Row action menus always visible on mobile (hover-reveal only on sm+).
- 2026-03-23: Scan page hardening (5-pass) — Skeleton loading states, shadcn Alert for errors, optimistic checklist updates, auto-clear feedback, processingRef guards on all scan handlers, network drop recovery via try/catch/finally.
