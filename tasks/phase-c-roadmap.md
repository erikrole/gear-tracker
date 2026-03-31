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

### 6. Calendar Multi-Day Enhancement
**Goal:** Seamless bars across the grid for multi-day events (not split per day), hover actions
**Current state:** `CalendarView` component in schedule page (`src/components/CalendarView.tsx`) renders events per-day. Multi-day events likely repeat or truncate.
**What's needed:**
- UI: Implement spanning bars across calendar grid cells (CSS grid with `grid-column: span N`)
- Logic: Group multi-day events, calculate start column + span within week rows
- Handle events that cross week boundaries (split into continued bars with visual indicators)
- Hover actions: Popover or tooltip on hover showing event details + quick actions (reserve gear, view shifts)
- Consider existing libraries: `@fullcalendar/react` or custom implementation
- **Files:** `src/components/CalendarView.tsx`, potentially new `CalendarEventBar.tsx`
- **Complexity:** L

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
