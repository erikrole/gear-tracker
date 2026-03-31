# Phase C+ Feature Roadmap

## Context

Gear Tracker has completed Phase A (core workflows) and Phase B (polish, decomposition, security hardening). The system is in Beta with 330 passing tests, solid architecture, and clean code patterns. This roadmap captures 10 new features the product team wants to plan for future development, organized into logical phases based on dependencies, complexity, and value delivery.

---

## Feature Inventory

### 1. User Pages Enhancement
**Goal:** Central hub for contact info, clothing sizes, sport assignments, badges
**Current state:** User detail page exists (`src/app/(app)/users/[id]/page.tsx`) with Info + Activity tabs, avatar, role, location, sport/area assignments (GAP-23 closed). No clothing sizes, no badges.

**What's needed:**
- Schema: Add clothing size fields to `User` model (shirtSize, pantsSize, shoeSize, hatSize enums or strings)
- Schema: New `Badge` model (id, name, icon, description) + `UserBadge` join table (userId, badgeId, awardedAt, awardedBy)
- UI: Extend UserInfoTab with "Sizes" section (inline-editable SaveableField rows)
- UI: New "Badges" section or tab on user detail page
- API: PATCH `/api/users/[id]` already exists — extend for size fields; new badge CRUD endpoints
- **Files:** `prisma/schema.prisma`, `src/app/(app)/users/[id]/page.tsx`, `src/app/(app)/users/[id]/UserInfoTab.tsx`, `src/app/api/users/[id]/route.ts`
- **Complexity:** M

**Schema design:**
```prisma
// Strings, not enums — sizes vary by brand; free text avoids migration churn
model User {
  // ... existing fields ...
  shirtSize  String? @map("shirt_size")
  pantsSize  String? @map("pants_size")
  shoeSize   String? @map("shoe_size")
  hatSize    String? @map("hat_size")
  title      String? // job title, e.g. "Lead Photographer" — also used by Org Chart (#4)
}

model Badge {
  id          String      @id @default(cuid())
  name        String      @unique
  icon        String      // emoji or lucide icon name
  description String?
  createdAt   DateTime    @default(now()) @map("created_at")
  awardedTo   UserBadge[]
  @@map("badges")
}

model UserBadge {
  userId     String   @map("user_id")
  badgeId    String   @map("badge_id")
  awardedAt  DateTime @default(now()) @map("awarded_at")
  awardedById String? @map("awarded_by_id")  // null = system-awarded
  note       String?
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge      Badge    @relation(fields: [badgeId], references: [id], onDelete: Cascade)
  awardedBy  User?    @relation("BadgeAwarder", fields: [awardedById], references: [id], onDelete: SetNull)
  @@id([userId, badgeId])  // one badge per user; revoke + re-award updates the row
  @@map("user_badges")
}
```
*Note: `title` field added here feeds Feature #4 (Org Chart) — add both in one migration.*

**Intended UX flows:**

*Sizes (inline edit, SaveableField pattern):*
1. Staff/Admin opens any user's detail page → Info tab
2. "Sizes" section appears below contact info with 4 rows: Shirt, Pants, Shoe, Hat
3. Each row shows current value (or "—") with pencil icon on hover
4. Click pencil → inline text input, press Enter or click checkmark → PATCH `/api/users/[id]`
5. Student viewing their own page can edit their own sizes; viewing another user's page: read-only

*Badge award flow:*
1. Admin/Staff clicks "+ Award Badge" button in Badges section of any user's page
2. Sheet/popover opens with list of all defined badges (name + icon + description)
3. Optional: "Note" text field for context (e.g. "Awarded for covering all home games")
4. Submit → POST `/api/users/[id]/badges` → badge appears in user's list with awarded date + awarder avatar
5. Badge can be revoked: Admin only, confirmation dialog, DELETE `/api/users/[id]/badges/[badgeId]`

*Badge management (Admin settings):*
- `/settings/badges` page: create/edit/delete badge definitions
- Deleting a badge definition cascades to remove all UserBadge rows (CASCADE on delete)

**Edge cases:**
- **Duplicate badge award:** Composite PK `[userId, badgeId]` prevents it at DB level; UI should disable already-awarded badges in the picker (show as "awarded" with checkmark)
- **Award to deactivated user:** Allow — a user's badge history should persist. Warn in UI if user is inactive.
- **Badge definition deleted while user has it:** CASCADE removes the UserBadge rows. Soft-delete badges instead? Decision: use soft-delete (`active` flag on Badge) so existing awards display as "[Archived Badge]" rather than disappearing.
- **Student edits own sizes:** Permitted. Student editing another user's sizes: blocked at API (check `session.user.id !== params.id && session.user.role === STUDENT`).
- **Sizes as free text:** Risk of inconsistent values ("XL" vs "X-Large"). Mitigate: placeholder shows format hint ("e.g. M, L, XL, 32x30, 10.5")
- **`title` field length:** Cap at 100 chars in API validation.

**API changes:**
- `PATCH /api/users/[id]`: extend zod schema to accept `shirtSize`, `pantsSize`, `shoeSize`, `hatSize`, `title` (all optional strings)
- `GET /api/users/[id]`: include `userBadges` with badge name/icon in the response
- `POST /api/users/[id]/badges`: body `{ badgeId, note? }`, ADMIN/STAFF only
- `DELETE /api/users/[id]/badges/[badgeId]`: ADMIN only
- `GET /api/badges`: list all badge definitions (for award picker)
- `POST /api/badges`: create badge definition, ADMIN only
- `PATCH /api/badges/[id]`: edit badge definition, ADMIN only
- `DELETE /api/badges/[id]`: soft-delete (set `active = false`), ADMIN only

**Hardening:**
- Authorization: size edits allowed by ADMIN, STAFF, or the user themselves. STUDENT cannot edit other users.
- Badge awards/revocations: ADMIN/STAFF only — never self-award
- API validates string fields are not excessively long (sizes ≤ 50 chars, title ≤ 100)
- AuditLog entry on badge award/revoke (actor, target user, badge name)
- `npm run build` must pass after schema migration — check for type propagation in any place that spreads the User type

### 2. Guides Sidebar Section
**Goal:** Walkthrough tutorials, guides, contact info, FAQ housed under a new sidebar item
**Current state:** No guides/help/FAQ pages exist. Onboarding banner on dashboard only.

**What's needed:**
- **Decision: Static MDX** — version-controlled markdown files, devs update via PRs
- New route group: `src/app/(app)/guides/` with sub-pages (getting-started, faq, contacts, etc.)
- Sidebar: Add "Guides" item to `src/lib/nav-sections.ts` (visible to all roles)
- UI: Left sidebar TOC within guides section for navigation between articles
- Use `@next/mdx` or `next-mdx-remote` for rendering
- **Files:** `src/lib/nav-sections.ts`, `src/app/(app)/guides/` (new), `src/components/Sidebar.tsx`
- **Complexity:** S-M

**Content structure (file-based routing):**
```
src/app/(app)/guides/
  layout.tsx              ← shell with left TOC sidebar
  page.tsx                ← redirects to /guides/getting-started
  getting-started/page.tsx
  faq/page.tsx
  contacts/page.tsx
  equipment-care/page.tsx
  shift-scheduling/page.tsx

content/guides/           ← MDX source files (co-located with routes or separate)
  getting-started.mdx
  faq.mdx
  contacts.mdx
  equipment-care.mdx
  shift-scheduling.mdx
```
*Prefer `next-mdx-remote` over `@next/mdx` — allows MDX files outside `app/` dir, cleaner separation of content from routes.*

**Intended UX flows:**

*Navigation:*
1. User clicks "Guides" in sidebar → lands on Getting Started article (default)
2. Left TOC sidebar (within guides layout, separate from app sidebar) lists all articles with active-state highlight
3. On mobile: TOC collapses to a dropdown/sheet above article content
4. Each article renders as a full-width readable column (max-w-3xl, centered)
5. Code blocks, callout components, and images supported via MDX custom components

*TOC within an article:*
- Auto-generated from headings (h2, h3) in the MDX
- Sticky on desktop, scrolls with page on mobile
- Smooth-scroll to section on click

**Edge cases:**
- **Broken MDX frontmatter:** Build fails loudly at `npm run build` — this is acceptable (it's a dev error, not a runtime error). Static MDX means errors are caught pre-deploy.
- **Missing slug route:** `/guides/nonexistent` → Next.js 404 page. No custom handling needed since routes are file-based (only real files get routes).
- **No articles yet:** Guides landing page should have a meaningful empty state, not a blank page — at minimum a "Coming soon" placeholder that still satisfies the nav link.
- **Long article with no headings:** In-article TOC simply renders empty/hidden. Not an error.
- **Contacts page with PII:** Contacts are staff/org contacts (names, emails, roles) — not user data. Keep it general (role names + shared email aliases, not personal phones).
- **Search within guides:** Deferred. Static content search (e.g. Pagefind) is a Phase C3 enhancement if demand exists.

**MDX component toolkit:**
- `<Callout type="info|warning|tip">` — styled alert boxes
- `<Steps>` — numbered step list (common in setup guides)
- `<CodeBlock>` — syntax-highlighted code (uses shadcn's approach)
- Standard prose: h1-h4, ul/ol, table, blockquote — all styled via Tailwind Typography (`@tailwindcss/typography`)

**Hardening:**
- All MDX renders at build time — zero runtime DB queries, zero auth requirements
- Guides are visible to all authenticated roles (ADMIN, STAFF, STUDENT)
- No user-generated content; no XSS surface
- Add `guides` to nav-sections with `roles: ['ADMIN', 'STAFF', 'STUDENT']` (or omit roles to mean "all")
- Validate MDX files compile cleanly in CI (`npm run build`)
- TOC sidebar must not conflict visually with the app's main sidebar — use a different visual weight (border-r vs full sidebar treatment)

### 3. Smart Gear Frequency Surfacing
**Goal:** Identify most-used gear and surface those items near the top of actions
**Current state:** Equipment picker (`src/components/EquipmentPicker.tsx`) uses sections defined in `src/lib/equipment-sections.ts`. Items page has favorites. Dashboard has "My Gear" column. No usage frequency tracking.

**What's needed:**
- Analytics: Query `AssetAllocation` (or `BookingBulkUnitAllocation`) to compute per-asset checkout frequency (count of allocations in last 90 days)
- API: New endpoint or extend `/api/assets/picker-search` with `sort=frequency` option
- UI: "Frequently Used" section at top of equipment picker, or sort-by-frequency option on items page
- Consider per-user vs. org-wide frequency (per-user = "your frequently used", org-wide = "most popular")
- No schema changes needed — derived from existing `AssetAllocation` data
- **Files:** `src/app/api/assets/picker-search/route.ts`, `src/lib/equipment-sections.ts`, `src/components/EquipmentPicker.tsx`
- **Complexity:** M

**Frequency model decision — per-user vs. org-wide:**
- **Recommended: both, layered.** Show "Your Recent" first (per-user, last 30 days, max 5 items), then "Most Used" org-wide (last 90 days, max 5 items) as a secondary section. Per-user is more actionable for repeat workflows; org-wide helps new users discover popular gear.
- If the current user has <3 personal allocations, skip "Your Recent" and show only org-wide.

**Query design:**
```sql
-- Per-user recent (last 30 days, top 5 assets by count)
SELECT asset_id, COUNT(*) as freq
FROM asset_allocations
WHERE booking_id IN (
  SELECT id FROM bookings WHERE requester_id = :userId
)
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY asset_id
ORDER BY freq DESC
LIMIT 5

-- Org-wide popular (last 90 days, top 5)
SELECT asset_id, COUNT(*) as freq
FROM asset_allocations
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY asset_id
ORDER BY freq DESC
LIMIT 5
```
Add DB index on `asset_allocations(created_at)` if not already present. Both queries are fast aggregations on a bounded time window.

**Intended UX flows:**

*Equipment picker:*
1. Picker opens (from checkout/reservation creation)
2. Top section: "Your Recent" — horizontal scroll row or compact list of up to 5 assets with asset tag + name
3. Below that: "Most Used" (org-wide) — same compact format, deduplicated against "Your Recent"
4. Below that: existing category sections (unchanged)
5. If user types in search box → frequency sections collapse, search results take over
6. If a "frequent" item is already added to the booking → show it with a checkmark, still tappable to remove

*Items page (secondary surface):*
- Add "Sort by: Frequency" option to the sort dropdown alongside Name/Tag/Status
- Frequency sort uses org-wide 90-day count; no UI for per-user sort here

**Edge cases:**
- **New asset with zero history:** Never appears in frequency sections. Still discoverable via search and category sections. No suppression needed.
- **Archived/retired asset in frequency list:** Filter out assets where `status = RETIRED` or `active = false` from frequency results.
- **User with no checkout history:** Skip "Your Recent" section entirely. Show only org-wide.
- **Frequency section item already selected:** Show with checkmark + visual dim, remain clickable (to deselect).
- **Tie-breaking in org-wide frequency:** Secondary sort by `asset_tag` for determinism.
- **Picker used in bulk/reservation context:** Same frequency logic applies — allocations from either BookingKind count.
- **90-day window returns 0 results:** Skip that section silently. Don't render an empty "Most Used" header.

**Hardening:**
- Frequency queries run on picker open — add a brief loading skeleton for the frequency sections (separate from the main picker load)
- Cache frequency results per-user for 5 minutes (use `unstable_cache` or memoize in the API handler) — these don't need real-time accuracy
- Frequency section capped at 5 items each — no pagination, no "show more"
- Graceful degradation: if frequency query throws, log error and render picker without frequency sections (don't break the whole picker)
- Deduplication: an asset in "Your Recent" must not also appear in "Most Used" in the same open picker session

### 4. Creative Org Chart
**Goal:** Visual, drag-and-drop org chart that auto-updates backend on changes
**Current state:** No hierarchy model exists. Users have role (ADMIN/STAFF/STUDENT) and primaryArea (ShiftArea enum: VIDEO/PHOTO/GRAPHICS/COMMS). No reporting relationships.

**What's needed:**
- **Decision: Hybrid** — area/team groupings (VIDEO/PHOTO/GRAPHICS/COMMS) with reporting lines within each area
- Schema: Add `managerId` self-referential FK on `User` (nullable, SET NULL on delete) + `title` field
- Schema: Leverage existing `primaryArea` (ShiftArea) for top-level grouping; `managerId` for within-area hierarchy
- API: New `/api/org-chart` endpoint returning grouped tree structure; PATCH to update `managerId` via drag-drop
- UI: New page `src/app/(app)/org-chart/page.tsx` — area columns with tree hierarchy within each
- Library: Consider `reactflow` or `@xyflow/react` for drag-and-drop canvas
- Sidebar: Add "Org Chart" to nav-sections (ADMIN/STAFF visible)
- Permission: Only ADMIN can edit; STAFF/STUDENT can view
- **Files:** `prisma/schema.prisma`, `src/lib/nav-sections.ts`, `src/app/(app)/org-chart/` (new), `src/app/api/org-chart/` (new), `src/app/api/users/[id]/route.ts`
- **Complexity:** L

**Schema design:**
```prisma
model User {
  // ... existing fields ...
  title      String?  // added in Feature #1 migration — reused here
  managerId  String?  @map("manager_id")
  manager    User?    @relation("UserReports", fields: [managerId], references: [id], onDelete: SetNull)
  reports    User[]   @relation("UserReports")
}
```
*`title` and `managerId` ship in the same migration as Feature #1's clothing sizes and Badge models. One migration, no orphaned schema drift.*

**Library decision — skip reactflow:**
- `@xyflow/react` (reactflow v12) is 180KB+ and built for general-purpose node graphs. Overkill for a fixed area-column layout.
- **Recommended: CSS-only tree layout** — area columns rendered as flex/grid, hierarchy within each column using indentation + connecting lines via CSS borders. Drag-and-drop via `@dnd-kit/core` (already likely in the project or lightweight to add).
- Revisit reactflow only if the layout requirement becomes truly graph-like (cross-area reporting lines, non-tree structures).

**API design:**
```
GET  /api/org-chart         → grouped tree: { VIDEO: [...tree], PHOTO: [...tree], ... }
PATCH /api/org-chart/[userId] → body: { managerId: string | null }
```

Tree node shape:
```ts
type OrgNode = {
  id: string
  name: string
  title: string | null
  avatarUrl: string | null
  role: Role
  primaryArea: ShiftArea | null
  reports: OrgNode[]  // recursive
}
```

`GET /api/org-chart` query: fetch all active users, build tree in-memory (single DB query, recursive assembly in JS). No recursive CTE needed — org depth is shallow (≤4 levels).

**Intended UX flows:**

*View mode (all roles):*
1. Page loads with 4 area columns: VIDEO / PHOTO / GRAPHICS / COMMS
2. Users with no `primaryArea` appear in an "Unassigned" column at the right
3. Within each column: root nodes (no manager, or manager in a different area) at the top; direct reports indented below, connected by a vertical line
4. Each node: avatar + name + title badge. Click node → navigates to `/users/[id]`
5. Inactive users excluded from the chart

*Edit mode (ADMIN only):*
1. "Edit" button in top-right toggles edit mode — nodes get drag handles
2. Drag a node onto another node → sets `managerId` via PATCH, updates tree optimistically
3. Drag a node to the column header or an empty area → sets `managerId = null` (becomes a root node)
4. "Save" is implicit — each drop triggers an API call immediately
5. Exit edit mode → drag handles disappear, back to view mode

**Edge cases:**
- **Circular reporting chain** (A manages B manages A): Must be caught at the API layer before writing. Algorithm: when setting `managerId = X` for user U, walk X's ancestor chain — if U appears anywhere in it, reject with 400 "Would create a circular reporting chain."
- **User with no `primaryArea`:** Renders in "Unassigned" column. Their reports still render under them in Unassigned.
- **Manager in a different area than their reports:** Allowed — the tree groups by the *report's* `primaryArea`, not the manager's. A VIDEO manager can have a PHOTO direct report; the PHOTO person appears in the PHOTO column with a note or visual indicator that their manager is in VIDEO.
- **Self-assignment as manager:** API rejects `managerId === userId` with 400.
- **User deleted while set as manager:** `onDelete: SetNull` on the FK handles this — their reports become root nodes automatically.
- **Deactivated user as manager:** Filtered from the chart display. Their reports show as root nodes (or show a "manager inactive" indicator). API should skip inactive users in tree assembly.
- **Very deep tree (5+ levels):** Indented layout becomes visually cramped. Cap displayed depth at 3; show "Show N more levels" expand for deeper trees. In practice, org depth should be ≤3.
- **Drag race condition (two admins editing simultaneously):** Last write wins (no locking needed at this scale). Both see the updated chart on next load.

**Hardening:**
- Cycle detection is non-negotiable — implement before any write is accepted
- ADMIN-only writes; STAFF/STUDENT get read-only view (no edit button rendered, PATCH endpoint returns 403 for non-ADMIN)
- `PATCH /api/org-chart/[userId]` validates that the target user exists and is active
- AuditLog entry on every `managerId` change (actor, target user, old managerId → new managerId)
- Page is ADMIN+STAFF visible in sidebar; STUDENT role cannot access the route (middleware guard)
- Empty state: if no users have `primaryArea` set, show a prompt directing admins to set areas on user profiles

### 5. Bookings View Options (List, Card, Calendar)
**Goal:** Toggle between list view, card view, and calendar view on the bookings page
**Current state:** Bookings page (`src/app/(app)/bookings/page.tsx`) has card-style layout with tabs for Checkouts/Reservations. No list/table view or calendar view.

**What's needed:**
- UI: Add view toggle (icons: list/grid/calendar) with localStorage persistence (pattern exists in schedule page)
- List view: Reuse DataTable pattern from items page (shadcn Table with sorting/filtering)
- Card view: Current layout (already exists)
- Calendar view: Month grid showing bookings by date range (reuse `CalendarView` component pattern from schedule)
- URL state: `?view=list|card|calendar` via `useUrlState`
- **Files:** `src/app/(app)/bookings/page.tsx`, new `BookingListView.tsx`, `BookingCalendarView.tsx` components
- **Complexity:** M-L

**View toggle architecture:**
- View state lives in URL: `?view=list|card|calendar` (via `useUrlState`) — shareable/bookmarkable
- localStorage mirrors the last-used view as the default when no `?view` param is present
- The existing Checkouts/Reservations tab (BookingKind filter) persists across all views — it's orthogonal to the view toggle
- All three views consume the same data fetch; no separate API endpoints per view

**List view columns (DataTable):**
| Column | Sortable | Notes |
|--------|----------|-------|
| Ref # | yes | link to booking detail |
| Kind | no | CHECKOUT / RESERVATION badge |
| Status | yes | color-coded badge |
| Requester | yes | avatar + name |
| Items | no | count badge, e.g. "3 items" |
| Starts | yes | formatted date |
| Ends | yes | formatted date |
| Location | yes | |
| Actions | no | "View" button, context menu |

Default sort: `startsAt DESC`. Row click navigates to booking detail.

**Calendar view behavior:**
- Month grid (same structure as schedule CalendarView)
- Each booking appears as a colored bar on its `startsAt` date, spanning to `endsAt` — multi-day bookings span cells (requires Feature #6 for full fidelity, but basic single-day pins work without it)
- Color by status: ACTIVE=blue, OVERDUE=red, COMPLETED=gray, DRAFT=muted
- Click a bar → navigates to booking detail
- Click an empty day → opens CreateBookingSheet pre-filled with that date (optional, Phase C2+)
- Calendar shows the current month by default; prev/next month navigation

**Intended UX flows:**

*Switching views:*
1. User lands on `/bookings` → default view (card, or last-used from localStorage)
2. View toggle row: three icon buttons (List / Grid / Calendar) at top-right of the page header
3. Clicking a view icon updates `?view=` in the URL, re-renders the active view component
4. All active filters (kind tab, search, date range) carry through the view switch

*List view — bulk selection (future):*
- Checkbox column for future bulk actions (export, bulk status change) — scaffold the column now, wire actions later

**Edge cases:**
- **Draft bookings in calendar view:** Show as a dashed/muted bar. Don't hide them — admins need to see drafts.
- **Bookings with no `endsAt`** (open-ended checkouts): In calendar view, show a bar with an open-ended arrow indicator on the right edge of the month. In list view, show "—" in Ends column.
- **Very dense calendar day** (10+ bookings): Show first 3 bars, then "+N more" overflow chip. Clicking the chip opens a popover listing all bookings that day.
- **Filter state preservation across view switch:** Search query, kind tab, date range filter all persist in URL params — they're view-agnostic.
- **Calendar view + kind filter:** Calendar only shows bookings matching the active kind tab (CHECKOUT or RESERVATION). "All" tab shows both.
- **Bookings spanning month boundary in calendar:** Show bar from start through end of visible month; "continued →" indicator on the last cell of the month. Requires Feature #6 multi-day bars for full implementation.
- **Student user on bookings page:** Should only see their own bookings (existing authorization rule). All three views respect this filter.
- **Long requester name in list view:** Truncate with ellipsis at 20 chars, full name on hover tooltip.
- **Empty state per view:** List = "No bookings found" with DataTable empty state. Card = existing empty state. Calendar = empty month grid (no special message needed).

**Hardening:**
- View toggle is purely presentational — no new API endpoints, no auth changes
- DataTable in list view must support keyboard navigation (shadcn Table already does)
- Calendar view must not load ALL bookings — use the same date-windowed query as the existing card view (current month ± 1 month buffer)
- `BookingCalendarView` and `BookingListView` are dumb display components — all data fetching stays in the parent page via `useFetch`
- `npm run build` check: DataTable columns must be typed; no `any` in column definitions

### 6. Calendar Multi-Day Enhancement
**Goal:** Seamless bars across the grid for multi-day events (not split per day), hover actions
**Current state:** `CalendarView` component in schedule page (`src/app/(app)/schedule/_components/CalendarView.tsx`) renders events per-day. Multi-day events likely repeat or truncate.

**What's needed:**
- UI: Implement spanning bars across calendar grid cells (CSS grid with `grid-column: span N`)
- Logic: Group multi-day events, calculate start column + span within week rows
- Handle events that cross week boundaries (split into continued bars with visual indicators)
- Hover actions: Popover or tooltip on hover showing event details + quick actions (reserve gear, view shifts)
- **Decision: custom CSS grid implementation** — `@fullcalendar/react` is 400KB+, and the existing `CalendarView` is already custom. Extending it is far less disruptive than replacing it.
- **Files:** `src/app/(app)/schedule/_components/CalendarView.tsx`, new `src/app/(app)/schedule/_components/CalendarEventBar.tsx`
- **Complexity:** L

**Layout algorithm:**

The month grid is a 7-column CSS grid. Each week is a row. Multi-day events span columns within a row.

```
Week row: Mon  Tue  Wed  Thu  Fri  Sat  Sun
          [col1][col2][col3][col4][col5][col6][col7]

Event A:  ████████████████████  (spans col2–col5, Wednesday-Saturday)
Event B:            ████        (col4 only, Thursday)
```

For each week row:
1. Collect all events that overlap that week (start ≤ weekEnd AND end ≥ weekStart)
2. For each event, compute `startCol` = max(1, dayOfWeek(event.start)) and `endCol` = min(7, dayOfWeek(event.end))
3. Assign a "track" (vertical slot/row within the day cells) to avoid visual overlap — greedy track assignment
4. Render as absolutely-positioned bars within the week row using `left` + `width` percentages, or CSS `grid-column: startCol / endCol+1`

**Week-boundary splits:**
- Event spanning Mon–Wed of week 1 AND Thu–Sun of week 2 renders as:
  - Week 1 row: bar from Mon to Sun with a `→` continuation indicator on the right edge
  - Week 2 row: bar from Mon to Wed with a `←` continuation indicator on the left edge
- Visual style: continuation bars get a slightly lighter/dashed left or right border

**New component: `CalendarEventBar`**
```tsx
type CalendarEventBarProps = {
  event: CalendarEvent
  startCol: number   // 1-7
  endCol: number     // 1-7
  track: number      // vertical slot index (0, 1, 2...) for stacking
  isContinuedFrom: boolean  // ← indicator
  continuesInto: boolean    // → indicator
  onClick: () => void
}
```

**Hover popover content:**
- Event title (full, not truncated)
- Date range: "Mar 15 – Mar 18"
- Location (if set)
- Quick actions: "Reserve Gear →" (links to create reservation tied to this event), "View Shifts →" (links to event detail)
- Popover appears on hover after 200ms delay, disappears on mouse-leave with 100ms grace period

**Intended UX flows:**

*Viewing multi-day events:*
1. Month grid renders with colored bars spanning multiple columns
2. Event title shown truncated within bar (ellipsis); full title in hover popover
3. Up to 3 event tracks visible per day row; overflow shows "+N more" chip
4. "+N more" chip click → day popover listing all events that day

*Interacting:*
1. Hover bar → popover appears (200ms delay)
2. Click bar → navigate to event detail page
3. Click "Reserve Gear" in popover → CreateBookingSheet opens with event pre-selected
4. Click date cell (not a bar) → existing behavior (day view or create event, TBD)

**Edge cases:**
- **Event spans entire month (30+ days):** Show as a single full-width bar across every week row with continuation indicators. Cap bar title to first week only; subsequent weeks show only the colored bar.
- **Two events on the same days:** Stacked in tracks 0 and 1. If 3+ events overlap, track 2 used, then "+N more" for remaining.
- **Single-day event:** `startCol === endCol`. Renders as a short bar in one cell — same as current behavior but now using the new bar component for visual consistency.
- **Event starts Saturday, ends Sunday (2-day event across weekend):** `startCol=6, endCol=7`. Renders within one week row, no split needed.
- **Event starts Sunday, ends next Monday:** Splits across two week rows. Sunday week gets a `→` tail; next Monday week gets a `←` head.
- **All-day vs timed events:** All-day events always render as bars. Timed events (e.g. 2pm–11pm) should also render as bars at the day level (time-of-day is not shown in month view).
- **Track overflow** (more than 3 events on one day): Render 3 bars + "+N more" chip. The chip opens a popover list. N = total events on that day minus 3.
- **Event with no end date:** Treat as single-day. Show with a `→` open-end indicator on the right edge.

**Hardening:**
- Track assignment algorithm must be deterministic — same data always produces same layout (sort events by start date then id for stable ordering)
- Accessibility: each bar needs `aria-label` with event title + date range; keyboard focus should work (tab through bars)
- Performance: track assignment runs in-component on each render — should be O(n log n) at worst; memoize with `useMemo` keyed on the events array
- CalendarEventBar is a pure presentational component — no data fetching, no side effects
- Existing CalendarView tests (if any) must still pass; new unit tests for the track assignment algorithm
- The component is shared between the schedule page and the new BookingCalendarView (#5) — design it to accept a generic event shape via generics or an adapter pattern

### 7. Slack Integration
**Goal:** Replace/supplement email and SMS notifications with Slack
**Current state:** Notifications use in-app + email (Resend). No SMS exists. No Slack integration.
**What's needed:**
- **Decision: Webhook-based** — post to a shared Slack channel via incoming webhook (simplest)
- Schema: Add `slackWebhookUrl` to `SystemConfig` (or env var)
- Integration: Simple `fetch()` POST to Slack webhook URL — no OAuth, no per-user DMs
- Notification service: Extend `src/lib/services/notifications.ts` with Slack webhook channel (overdue alerts, shift changes, escalations posted to shared channel)
- Settings: Admin config for webhook URL + which notification types post to Slack
- No per-user Slack mapping needed — all notifications go to one channel
- Future: Upgrade to Slack Web API with per-user DMs if webhook proves insufficient
- **Files:** `src/lib/services/notifications.ts`, `src/app/(app)/settings/integrations/` (new), `src/app/api/settings/slack/` (new)
- **Complexity:** M (down from XL with webhook approach)

### 8. Better Events/Schedules UI
**Goal:** More intuitive UI surrounding events and schedules
**Current state:** Schedule page (`src/app/(app)/schedule/page.tsx`) has calendar + list views with shift management. Event detail page (`src/app/(app)/events/[id]/page.tsx`) has Command Center. Both are functional but could be more intuitive.
**What's needed:**
- UX audit: Identify specific pain points (this is broad — needs user feedback to scope)
- Potential improvements:
  - Timeline/Gantt view for shift coverage visualization
  - Drag-to-assign shifts directly on calendar
  - Inline event creation from calendar (click empty day → create)
  - Quick filters: "This week", "Next week", sport-specific views
  - Event cards with at-a-glance gear readiness indicator
- Depends on: Calendar multi-day enhancement (#6) as foundation
- **Files:** `src/app/(app)/schedule/page.tsx`, `src/components/CalendarView.tsx`, `src/components/ListView.tsx`, `src/app/(app)/events/[id]/page.tsx`
- **Complexity:** L-XL (scope-dependent)

### 9. Availability Tracking
**Goal:** Users declare availability (daily, weekly, 'until XX' patterns)
**Current state:** No general availability model. Listed as Phase B deferred feature in GAPS_AND_RISKS.md.

**What's needed:**
- Schema: New `Availability` model (userId, dayOfWeek or specificDate, startTime, endTime, recurrence type: DAILY/WEEKLY/UNTIL, untilDate, notes)
- API: CRUD `/api/availability` — users manage own, admins view all
- UI: "My Availability" page or section in profile — weekly grid editor, date-range blocks
- UI (admin): Availability overlay on shift assignment — see who's available before assigning
- Integration: Shift assignment reads the assignee's role automatically — assigning a student makes it a student shift, assigning staff makes it a staff shift. Badge accordingly.
- Integration: Warn when assigning someone who has marked themselves unavailable
- **Files:** `prisma/schema.prisma`, `src/app/(app)/availability/` (new) or extend profile page, `src/app/api/availability/` (new), `src/components/ShiftDetailPanel.tsx`
- **Complexity:** L

**Scope clarification — what this feature covers:**
Availability here means *unavailability declarations* ("I can't work these dates/times"), not a full scheduling preference system. Users mark when they're NOT available; absence of a block = assumed available. This is simpler to implement and matches the stated use case (students declare unavailable dates before assignment).

**Schema design:**
```prisma
enum AvailabilityKind {
  UNAVAILABLE  // "I cannot work this time"
  // PREFERRED / AVAILABLE could be added later; keep it simple for V1
}

enum RecurrenceType {
  ONCE      // specific date only
  WEEKLY    // repeats every week on this dayOfWeek
  UNTIL     // repeats weekly until untilDate
}

model Availability {
  id            String          @id @default(cuid())
  userId        String          @map("user_id")
  kind          AvailabilityKind @default(UNAVAILABLE)
  recurrence    RecurrenceType  @default(ONCE)
  // For ONCE: specificDate is set. For WEEKLY/UNTIL: dayOfWeek is set.
  specificDate  DateTime?       @map("specific_date")   // date only (normalize to midnight UTC)
  dayOfWeek     Int?            @map("day_of_week")     // 0=Sun, 1=Mon ... 6=Sat
  startTime     String?         @map("start_time")      // "HH:MM" — null = all day
  endTime       String?         @map("end_time")        // "HH:MM" — null = all day
  untilDate     DateTime?       @map("until_date")      // for UNTIL recurrence
  note          String?
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([specificDate])
  @@map("availability")
}
```

**API design:**
```
GET    /api/availability?userId=&from=&to=   → list blocks (own or all if ADMIN/STAFF)
POST   /api/availability                      → create block (own only for STUDENT)
PATCH  /api/availability/[id]                → edit own block (own only for STUDENT)
DELETE /api/availability/[id]                → delete own block (own only for STUDENT)

GET    /api/availability/check?userId=&date= → boolean: is this user available on this date?
```

**Intended UX flows:**

*Student declares unavailability ("My Availability" tab on profile page):*
1. New "Availability" tab on user detail page (alongside Info + Activity)
2. Weekly grid: 7 columns (Mon–Sun), 3 rows (Morning / Afternoon / Evening) — click a cell to mark unavailable
3. "Add date block" button → sheet with: date picker (or date range), recurrence (Once / Weekly / Until), time range (optional, defaults to "All day"), note field
4. Existing blocks shown as red chips on the grid with delete button
5. STUDENT can only manage their own; page shows own availability by default

*Admin views availability during shift assignment:*
1. In `ShiftDetailPanel`, when opening the user picker / assignment dialog, show availability status next to each candidate
2. Green dot = available, red dot = has a block covering this shift's date, gray = unknown
3. If admin selects an unavailable user → inline warning banner: "This person marked themselves unavailable on [date]. Assign anyway?"
4. Admin can proceed — it's a warning, not a hard block

*Admin views a user's availability:*
1. Navigate to any user's detail page → Availability tab
2. Shows that user's availability grid read-only (STUDENT viewing another user's page: tab hidden)

**Edge cases:**
- **Overlapping blocks (same user, same date):** Allowed — two blocks can cover the same date/time. The check endpoint returns `unavailable` if ANY block covers the queried date. No deduplication needed.
- **Block in the past:** Allow creating historical blocks (audit trail). Delete them normally. The check endpoint ignores blocks with `specificDate < today` to avoid false warnings.
- **Recurring block with no `untilDate` (type=WEEKLY):** Treated as indefinitely recurring. UI should warn the user: "This will repeat every [day] indefinitely. Add an end date?" — soft prompt, not required.
- **Recurring block `untilDate` in the past:** Effectively expired. Check endpoint treats it as no-longer-active. UI shows it as dimmed/expired, not deleted.
- **User deactivated with pending availability blocks:** Cascade delete via `onDelete: Cascade`. No orphaned blocks.
- **All-day vs. timed blocks on the same date:** If a shift is 2pm–6pm and the user has an all-day UNAVAILABLE block, they show as unavailable. If the user has a "9am–12pm" block only, a 2pm–6pm shift should show them as available. The check endpoint must compare time ranges, not just dates.
- **Time range validation:** `startTime < endTime` enforced at API. Overnight blocks ("10pm–2am") not supported in V1 — reject with a clear error message.
- **Timezone:** Store all times in the org's local timezone (no UTC conversion for time-of-day strings). Document this assumption. Revisit if multi-timezone orgs become a requirement.
- **STUDENT views another student's availability:** Tab is hidden. ADMIN/STAFF can view any user's availability tab.

**Integration with shift assignment:**
- The warning is a soft block — admins can override. Never hard-block an admin.
- Warning message includes the specific conflicting availability block's note (if set), so admin has context: "Unavailable: 'Spring break'"
- Warning shown inline in `ShiftDetailPanel`, not as a modal interrupt

**Hardening:**
- `POST /api/availability` enforces: STUDENT can only create for `userId === session.user.id`; ADMIN/STAFF can create for any user
- `specificDate` and `untilDate` are normalized to date-only (strip time component) on write
- `dayOfWeek` must be 0–6 if set; API validates range
- Recurring UNTIL blocks: `untilDate` must be after today if creating new; warn but allow if editing
- Index on `(userId, specificDate)` for fast per-user date lookups
- The availability check in shift assignment must not add a significant query — it runs once per candidate user when the assignment panel opens, not on every keystroke

### 10. Performance Enhancements
**Goal:** Perf improvements across the board
**Current state:** GAP-11 notes no cross-page cache (every navigation re-fetches). DB perf audit shipped 2026-03-27 (indexes, query consolidation). `useFetch` with Page Visibility API refresh is standard.
**What's needed:**
- React Query migration: Replace `useFetch` with `@tanstack/react-query` for shared cache, stale-while-revalidate, background refetch, optimistic updates (GAP-11 V3)
- Bundle analysis: Run `@next/bundle-analyzer` (already in devDeps), identify heavy chunks, add dynamic imports
- Image optimization: Ensure all images use `next/image` with proper sizing
- API route optimization: Identify remaining N+1 queries, add `select` clauses to Prisma queries
- Consider RSC (React Server Components) migration for data-heavy pages
- Lighthouse audit for Core Web Vitals baseline
- **Files:** All pages using `useFetch`, `package.json`, `next.config.ts`
- **Complexity:** L (incremental, spread across codebase)

---

## Recommended Phasing

### Phase C1 — Quick Wins & Foundations (2-3 weeks)
| # | Feature | Why now |
|---|---------|---------|
| 2 | Guides sidebar section (static MDX) | Low complexity, high user value, no schema changes |
| 1 | User pages enhancement | Extends existing page, moderate schema additions |
| 3 | Smart gear frequency surfacing | No schema changes, queries existing data |

### Phase C2 — Core Experience (3-4 weeks)
| # | Feature | Why now |
|---|---------|---------|
| 5 | Bookings view options | Reuses existing patterns (DataTable, CalendarView) |
| 6 | Calendar multi-day enhancement | Foundation for better events UI (#8) |
| 9 | Availability tracking | Deferred from Phase B, unblocks better shift assignment |

### Phase C3 — Advanced Features (3-5 weeks)
| # | Feature | Why now |
|---|---------|---------|
| 8 | Better events/schedules UI | Builds on #6 calendar improvements |
| 4 | Creative org chart | Self-contained, new capability |
| 7 | Slack integration (webhook) | Simplified to webhook — can ship quickly alongside other work |

### Continuous — Performance
| # | Feature | Approach |
|---|---------|----------|
| 10 | Performance enhancements | Incremental across all phases; React Query migration is the big win |

---

## Dependencies

```
#6 Calendar Multi-Day ──> #8 Better Events UI
#9 Availability Tracking ──> #8 Better Events UI (availability overlay on shifts)
#1 User Pages ──> #4 Org Chart (managerId on User)
```

All other features are independent and can be parallelized.

---

## Existing Patterns to Reuse

| Pattern | Source | Reuse in |
|---------|--------|----------|
| `useFetch` + `useUrlState` hooks | `src/lib/` | All new pages |
| `useFormSubmit` hook | `src/lib/hooks/useFormSubmit.ts` | All new forms |
| `SaveableField` + `useSaveField` | `src/components/`, `src/lib/hooks/` | User sizes, availability |
| DataTable (shadcn) | `src/app/(app)/items/page.tsx` | Bookings list view |
| CalendarView component | `src/components/CalendarView.tsx` | Bookings calendar, multi-day |
| InlineTitle component | `src/components/InlineTitle.tsx` | Any new detail pages |
| Detail page playbook | `tasks/lessons.md` | Org chart node detail, guide pages |
| View toggle + localStorage | Schedule page | Bookings view options |
| Nav sections config | `src/lib/nav-sections.ts` | Guides, Org Chart sidebar items |

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Guides content model | Static MDX | Version-controlled, simpler, no schema changes. CMS upgrade path available later. |
| Org chart hierarchy | Hybrid (area groups + reporting lines) | Leverages existing `primaryArea` for top-level grouping; `managerId` for within-area hierarchy. |
| Slack integration approach | Webhook-based | Post to shared channel via incoming webhook. No OAuth, no per-user mapping. Upgradeable to Web API later. |
| Shift type derivation | Role-based auto-detect | Assigning a user reads their role — student assignment = student shift, staff = staff shift. Badged accordingly. |

---

## Verification Plan

Each feature follows the Thin Slice Protocol (CLAUDE.md rule 10):
1. Schema/migration first (if applicable)
2. API/service layer
3. UI wiring
4. Tests
5. Hardening

Before marking any feature complete:
- `npm run build` passes
- Existing 330+ tests still pass
- New feature has at least smoke tests
- AREA docs updated per rule 12
- GAPS_AND_RISKS.md updated to close relevant gaps

---

## Doc Updates Required

When features begin shipping:
- Create `BRIEF_*.md` for each feature before implementation (rule 10)
- Create `AREA_GUIDES.md` and `AREA_ORG_CHART.md` for new system areas
- Update `AREA_USERS.md` for clothing sizes + badges
- Update `AREA_SHIFTS.md` for availability tracking + role-derived shift type
- Update `AREA_NOTIFICATIONS.md` for Slack channel
- Update `GAPS_AND_RISKS.md` — GAP-4 (Phase C unscoped) gets partially closed
- Move completed plan files to `tasks/archive/`
