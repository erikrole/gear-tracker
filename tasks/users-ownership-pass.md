# Users Ownership Pass - 2026-05-06

## Sweeping Users Pass - 2026-07-10

### Goal
- Make Users feel like one coherent people operations area across the roster, onboarding, org chart, and profile handoff, with truthful roles, fast discovery, clear secondary tools, and reliable state recovery.

### Plan
- [x] Audit roster, onboarding, org chart, profile flows, APIs, permissions, docs, tests, and peer pages.
- [x] Simplify roster hierarchy, filters, summary, row identity, and secondary navigation.
- [x] Fix high-confidence role, loading, empty, pagination, and action-state issues across Users surfaces.
- [x] Add focused tests and synchronize Users documentation.
- [x] Run repository gates and record the authenticated browser boundary.

### Contract boundaries
- Preserve invite-first onboarding, STUDENT directory visibility, STAFF/ADMIN editing, hidden-user rules, inactive-user lifecycle, and URL-backed roster state.

### Review
- Shipped a clearer roster hierarchy with one primary onboarding action, grouped secondary tools, an operational summary rail, canonical role badges, accessible sort state, direct empty-state recovery, and truthful active/inactive roster metrics.
- Onboarding now deep-links into the invite dialog, the dialog stays within the viewport, and onboarding status has a responsive card layout. Availability deletion requires confirmation, org-chart cycles stay visible, profile photo focus and password-copy failure states are explicit, deactivation cannot be bundled with other edits, and avatar blob cleanup follows database success.
- Verified 40 focused Users/onboarding/privacy tests, focused ESLint, TypeScript, all 93 migration prefixes, codemap/docs, whitespace, and `npm run build:app`.
- Authenticated browser proof is not repeated or claimed because Dia continues to block local app routes with `ERR_BLOCKED_BY_CLIENT`, the same environment boundary confirmed on the immediately preceding Settings and Notifications passes.

---

## Goal
- Make the Users list read like an operator roster: quick roster counts, clear search, contained advanced filters, and a calmer desktop/mobile command surface.

## Peer patterns checked
- `items`: strongest pattern for command-bar hierarchy, search clear affordance, filter disclosure, active filter count, and summary metrics.
- `guides`: simpler search plus category filtering works when the data set is lightweight, but Users has enough filters to need disclosure.
- `bookings`: tab/view controls are useful for major workflow modes, but Users does not need tabs for this slice.

## Plan
- [x] Structure: Keep the page route and list rows intact, but make the list header surface read as roster summary, then commands, then results.
- [x] UX: Add visible roster stats, make search easier to clear, keep secondary filters behind a Filters control, and include inactive state in active filter count.
- [x] UI: Match Items command-bar rhythm with a framed toolbar, 40px-ish controls, icons, exact transition properties, and tabular count chips.
- [x] Consistency: Keep existing user query params and export filters; avoid introducing new primitives.
- [x] Hardening: Extend `/api/users` with bounded stats from the same filtered query shape.
- [x] Verification: Run TypeScript, migration-prefix, whitespace, local Next build, and browser checks after the slice.
- [x] Docs: Sync `AREA_USERS.md` and this task review after implementation.

## Propagation candidates
- [ ] `guides`: consider replacing raw category buttons with shadcn button/toggle styling in a later UI pass.
- [ ] `bookings`: keep separate because tabs are core workflow modes there, not just filters.

## Review
- Shipped: Users list now has filtered roster stats, a framed search and filter command bar, search clear, filter disclosure, active filter count, and chips for every secondary filter including inactive visibility.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, authenticated Chrome DevTools desktop check, and mobile viewport screenshot at `/private/tmp/users-list-mobile-tight.png`.
- Deferred: Bulk operations and a user gear tab remain roadmap work, not part of this list-surface slice.

## Users Detail and Tabs - 2026-05-07

### Goal
- Make `/users/[id]` behave like the stronger detail pages: breadcrumb label stays human-readable, tabs deep-link cleanly, action buttons are grouped by intent, and assignment controls avoid nested click targets.

### Peer patterns checked
- `items/[id]`: URL-backed tabs, overflow-safe Wisconsin-red active tab rail, detail header as the main identity surface.
- `bookings/[id]`: clear primary and secondary action grouping, explicit action menu, global breadcrumb ownership.
- `ActivityTimeline`: canonical audit-feed renderer already matches the Users activity tab and avoids a custom timeline fork.

### Plan
- [x] Structure: Keep Info, Activity, and Availability as the stable detail-tab model.
- [x] UX: Make tabs URL-backed so Activity and Availability can be shared and survive refresh.
- [x] UI: Match the current Items detail tab rail and tighten the admin action button with clearer label, icon, disabled state, and dropdown affordance.
- [x] Layout: Reduce hero/tab/content spacing so the detail page reads as one connected surface instead of separate stacked blocks.
- [x] Buttons: Add missing copy-button accessibility and prevent rapid status toggles from reopening action work.
- [x] Breadcrumbs: Keep global breadcrumb behavior and verify the user name is the terminal crumb.
- [x] Tab scope: Show Availability only for student profiles.
- [x] Consistency: Remove nested interactive controls from assignment badges while preserving add, remove, and primary-area actions.
- [x] Permissions: Keep admin direct-report editing available on self profile.
- [x] Verification: Run type/build/browser checks after the slice.
- [x] Docs: Sync `AREA_USERS.md` after verification.

### Propagation candidates
- [ ] `items/[id]`: this confirms URL-backed tabs should remain the detail-page default.
- [ ] `ActivityTimeline`: keep Users Activity on the shared component rather than reintroducing a custom feed.

### Scope note
- Web detail-page polish prioritizes desktop and tablet. Phone-width web checks are smoke tests only because phone workflows belong in the iOS app.

### Review
- Shipped: Users detail tabs now deep-link like Items detail, use the same red active tab rail, hide Availability for non-students, and normalize invalid Availability links back to Info.
- Shipped: Admins can edit their own direct report, admin actions have clearer button affordance, and assignment controls no longer place remove buttons inside popover triggers.
- Shipped: Hero/tab/content spacing is tighter, password copy has an accessible label, and the Users page ownership skill now treats phone-width web as smoke-only.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools checks for non-student, current-admin, and student Availability routes.

## Add User - 2026-05-07

### Goal
- Make Add User feel like an operator-safe account creation flow: clear role scope, generated temporary password support, visible failure feedback, and direct handoff into profile completion.

### Peer patterns checked
- `licenses/AddLicenseDialog`: concise dialog description, predictable footer, and direct submit feedback.
- `items/new-item-sheet`: post-create handoff pattern for completing the newly created record.
- `settings/allowed-emails`: role-aware account access wording and bounded bulk/single-add behavior.

### Plan
- [x] Structure: Keep Add User as the existing Users list dialog and avoid adding a separate route.
- [x] UX: Generate a temporary password, support copying it before submit, and route to the created profile for detail completion.
- [x] UI: Add description, grouped account/access fields, role helper text, visible form-level error, and icon affordances.
- [x] Consistency: Use existing shadcn dialog, form, select, alert, button, and POST `/api/users` flow.
- [x] Hardening: Mirror server role restrictions in the client and trim/lowercase email at the API boundary.
- [x] Verification: Run type/build/browser checks after the slice.
- [x] Docs: Sync `AREA_USERS.md` after verification.

### Propagation candidates
- [ ] `settings/allowed-emails`: consider using the same role helper copy if allowlist role selection gets redesigned.

### Review
- Shipped: Add User now opens as a clearer account-creation dialog with description copy, generated temporary password, copy/regenerate controls, role guidance, and visible form-level API errors.
- Shipped: Successful creation routes to the new user detail page for profile completion, while the Users list reloads in the background.
- Shipped: Client role options now mirror the server restriction that only Admins can create Admin users, and the API trims email before validation/lowercasing.
- Polished: Dialog text uses balanced wrapping, the temporary-password surface has softer depth, and primary controls use 40px hit targets.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools Add User dialog check with no console issues.

## Users Ship Polish - 2026-05-10

### Goal
- Close the remaining Users-page data and navigation gaps before ship: roster views should survive reload/share, and direct-report edits should not be able to create invalid reporting loops.

### Peer patterns checked
- `items`: URL-backed filter and pagination state is the strongest roster/list pattern in the app.
- `kits`: simple scalar `useUrlState` filters fit Users better than Items' set-heavy table filters.
- `users/org-chart`: the tree renderer defensively breaks cycles, but the write route should prevent those cycles instead of relying on display-time cleanup.

### Plan
- [x] Structure: Keep the existing Users list and filter components, but persist search, filters, sort, inactive visibility, and page in the URL.
- [x] UX: Preserve the current command surface while making filtered empty states and result counts include inactive visibility.
- [x] Backend: Enforce direct-report target existence and cycle prevention in `PATCH /api/users/[id]`.
- [x] Tests: Add route coverage for valid direct-report assignment, missing managers, and cycle rejection.
- [x] Docs: Sync `AREA_USERS.md` and this review after verification.

### Review
- Shipped: Users list state is now URL-backed for search, role, location, year, sport, area, inactive visibility, sort, and page. Stale out-of-range page params normalize back to the last valid page.
- Shipped: Filtered empty states and result counts now treat `active=all` as a real active filter, so inactive-only visibility no longer reads like an unfiltered roster.
- Shipped: `PATCH /api/users/[id]` now rejects missing linked managers and circular direct-report chains before saving.
- Verified: `npx vitest run tests/users-route.test.ts tests/role-escalation.test.ts tests/user-pii-scope.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and Chrome DevTools smoke at `/users?role=STUDENT&active=all&page=1`.
