# Current Task Queue

Last updated: 2026-03-22

---

## Active Work

### Booking Detail Page Redesign — Round 3 (Shipped 2026-03-22)

- [x] **1. Fix double breadcrumb** — removed duplicate, global PageBreadcrumb handles it
- [x] **2. Status vocabulary** — D-025: `statusLabel()` helper. OPEN→"Checked out", BOOKED→"Confirmed"
- [x] **3. Status strip** — Due-back as urgency-colored Badge with clock icon
- ~~**4. Remove Title from info card**~~ — keeping per user preference
- [x] **5. Avatars on people fields** — Avatar initials on Requester and Created by
- [x] **6. Action buttons redesign** — `[Actions ▼] [Edit] [Extend] [Check in]`
- [x] **7. Equipment rows: context menu** — hover-reveal "..." with View item, Select for return
- [x] **8. Equipment: hide qty "1"** — only show status for serialized items
- [x] **9. Activity formatting** — tighter spacing, natural-language labels
- [ ] **10. Date range grouping** — deferred (From/To as connected range)

### shadcn/ui Final Migration

- [x] **Slice A**: CommandDialog — replace search overlay with live fuzzy command palette (2026-03-20)
- [x] **Slice B**: FilterChip → Popover — rewrite internals, zero consumer changes (2026-03-20)
- [x] **Slice C**: StatusDot + BulkActionBar → Popover (2026-03-20)
- [x] **Slice D**: BookingContextMenu → ContextMenu + DropdownMenu (2026-03-20)
- [x] **Slice E**: DateTimePicker — Calendar + Popover + time selects, replaces all datetime-local (2026-03-20)
- [x] **Slice F**: Tooltips on icon-only buttons (2026-03-20)
- [x] **Slice 8**: CSS cleanup — remove dead `.search-overlay*`, `.popover`, `.filter-chip-dropdown*` + fix datetime timezone bug + fix MenuItems type (2026-03-20)

### Scheduling + Gear Integration (Research: `tasks/scheduling-gear-integration-research.md`)

**Persona priority**: Student-first | **Gear suggestion**: Event pre-fill only

- [x] Research: competitive analysis + integration strategy (2026-03-17)
- [x] **Slice 1**: Shift context banner on checkout creation form (2026-03-17)
- [x] **Slice 2**: "My Shifts" dashboard widget with gear status (2026-03-17)
- [x] **Slice 3**: "Gear Up" notification on shift assignment approval (2026-03-17)
- [x] **Slice 4**: Event Command Center — unified staff view (2026-03-18)
- [ ] **Slice 5** (future): Game-Day Readiness Score
- [x] **Slice 6**: Shift-Checkout linking (shiftAssignmentId FK) (2026-03-18)

---

## Recently Shipped

- [x] **Users Page Improvements + Hardening** — Create user dialog, activity cursor pagination, member since date. Hardening: dead CSS removal, refresh-preserves-data, form reset on reopen, error differentiation, manual refresh with tooltip. (2026-03-23)
- [x] **Schedule Page Hardening (4-pass)** — Design system (inline styles → Tailwind classes). Data flow (AbortController race prevention, 401 redirect on all fetches, trade count refreshes on sheet close). Resilience (network vs server error differentiation, refresh preserves existing data). UX polish (filtered "N of M" count indicator, skeleton column fix). (2026-03-23)
- [x] **Schedule V2 Enhancements** — "My Shifts" filter (student-first, default ON for students, localStorage-persisted). Inline coverage expansion (click badge → per-area breakdown with avatars + assign button). Trade Board as Sheet overlay with open-trade count badge. View mode persistence in localStorage. Auto-scroll to today's date on list load. Shift status badges (Confirmed/Pending) on event rows. (2026-03-23)
- [x] **Unified Schedule Page (V1)** — Merged `/events` + `/schedule` into single `/schedule` page. List view with date-grouped events + coverage badges. Calendar view with month grid + coverage dots. Unified filters (sport, area, coverage, past events). Trade Board tab. `/events` list page removed; detail page unchanged. Venue Mappings moved to `/settings/venue-mappings`. (2026-03-23)
- [x] **Dashboard Sport Filter Chips** — Toggleable sport code chips below stat strip, URL-persisted (`?sport=MBB`), scopes all sections client-side. Contextual empty states. Overdue banner unfiltered. Auto-hides with <2 sports. (2026-03-23)
- [x] **Reports Page Hardening (6-pass)** — Design system alignment (Table, Badge, Alert, Card; -23 lines dead CSS). Data flow hardening (AbortController, 401 redirect, null-safe arrays, race condition prevention, refresh-without-replacement). Resilience (error differentiation: network vs server, retry with loading state). UX polish (Loader2 spinners, high-fidelity skeletons, varied widths). Features: data freshness indicator (RefreshCw + "Updated X ago" tooltip), URL-persisted filters (shareable report URLs), MetricCard tooltips. (2026-03-23)
- [x] **Profile Page Hardening (5-pass)** — Merged profile into user detail page (`/profile` → redirect to `/users/{id}`). Avatar upload + password change integrated into user detail when viewing self. Fixed student self-edit permissions (name/location via `/api/profile`). Optimistic avatar removal. High-fidelity skeletons. Removed 50 lines dead CSS. (2026-03-23)
- [x] **Scan Page Hardening (5-pass)** — Design system (Progress, Badge, Alert, Skeleton; -35 lines dead CSS). Data flow (refresh-preserves-data, 401 on all endpoints, ref guards). Resilience (auto-clear feedback, try/catch/finally numbered bulk, spam-click guards). UX (optimistic checklist update, Loader2 spinners). (2026-03-23)
- [x] **Login Page Hardening (5-pass)** — Design system alignment (Card, Alert, CardHeader/CardDescription; -78 lines dead CSS from all 4 auth pages). Data flow hardening (safe JSON parse, network error differentiation, double-submit guard, error-clears-on-typing). Resilience (disabled inputs during submit, aria-invalid/aria-describedby for accessibility). UX polish (Loader2 spinner on buttons, WifiOff icon for network errors, auto-focus first invalid field, card entrance animation). All 4 auth pages (login, register, forgot-password, reset-password) hardened consistently. (2026-03-23)
- [x] **Users Page Hardening (5-pass)** — Design system alignment (shadcn tokens, dead CSS removal), data flow hardening (AbortController, race condition prevention), resilience (retry buttons, 401 redirect on all endpoints), UX polish (high-fidelity skeletons, refresh-without-replacement, result count). (2026-03-22)
- [x] **Items List Page Hardening** — 5-pass audit: design system alignment (Badge/Spinner migration), data flow hardening (AbortController, race condition fix, silent failure elimination, double-click guard), resilience (refresh-preserves-data, shimmer progress bar, error differentiation), UX polish (high-fidelity skeleton, toast feedback on all mutations, confirmation clarity), doc sync. (2026-03-22)
- [x] **Dashboard Reliability + UX Polish** — shadcn/ui component migration (Avatar, AvatarGroup, Badge, Skeleton, Progress; -140 lines CSS). AbortController fetch race prevention. Refresh-failure-preserves-data pattern. Null-safe API response guards. Optimistic draft delete with rollback. Manual refresh button with "Updated X ago" tooltip. Varied skeleton widths. Differentiated error states (offline vs server). Draft delete double-click guard + 401 handling. Toast ref pattern prevents infinite re-fetch loops. (2026-03-22)
- [x] **Booking Detail Unification** — Unified checkout + reservation detail into single `BookingDetailPage` with `kind` prop. Extracted `useBookingDetail` + `useBookingActions` hooks. Shared `InlineTitle` component. Old GET/PATCH routes redirect to `/api/bookings/[id]`. PATCH returns enriched detail with before-snapshot audit diffs. Accessibility + dark mode fixes. (2026-03-22)
- [x] **MVP Polish Pass** — Audit logging gaps (departments, notifications/process), skeleton→shadcn, inline style→Tailwind, text-destructive (2026-03-21)
- [x] **Item Detail Overhaul** — shadcn inputs, save feedback, department combobox, collapsible sections, UserInfoTab parity (2026-03-21)
- [x] **Items Page DataTable Rebuild** — Sorting, row actions, context menu, column visibility, enhanced pagination, department FK filter (2026-03-21)
- [x] **Insights Tab Hardening** — Legends, empty states, punctuality accuracy fix (2026-03-21)
- [x] **shadcn/ui Deep Integration (A-F)** — Command palette, Popover migration, ContextMenu, DateTimePicker, Tooltips (2026-03-20)
- [x] **shadcn/ui Slice 5.4** — Tabs migration + btn/badge CSS cleanup (2026-03-20)
- [x] **shadcn/ui Slice 5.3** — Sheet migration (BookingDetailsSheet, ShiftDetailPanel, scan page) (2026-03-20)
- [x] **shadcn/ui Slice 5.2** — Card migration across 20+ pages (2026-03-20)
- [x] **shadcn/ui Slice 5.1** — Button migration (182+ usages), Badge migration (2026-03-20)
- [x] **shadcn/ui Slice 4** — Form components (Input, Label, Textarea, Checkbox) (2026-03-20)
- [x] **shadcn/ui Slice 3** — Empty, Spinner, Item, Separator (2026-03-20)
- [x] **shadcn/ui Slice 2** — Dialog, AlertDialog, Sonner migration (2026-03-20)
- [x] **shadcn/ui Slice 1.5** — Avatar & AvatarGroup (2026-03-20)
- [x] **shadcn/ui Slice 1** — Foundation + Button/Badge/Skeleton (2026-03-20)
- [x] **Dashboard Drafts (D-017 / GAP-2)** — DRAFT booking CRUD, dashboard section, auto-save on cancel, resume pre-fill (2026-03-16)
- [x] **D-018 Doc Sync** — Asset financial fields already in UI; docs updated to reflect shipped (2026-03-16)
- [x] **Dark mode contrast sweep** — 14 elements fixed across 2 commits (2026-03-16)
- [x] **Equipment Picker: shadcn + perf + a11y + 4-pass hardening** — shadcn components, O(1) Map + Set lookups, full ARIA keyboard nav, AbortController, scan feedback, availability retry, dead CSS cleanup (2026-03-24)
- [x] **Equipment Picker V2** — Multi-select, per-section search, availability preview, scan-to-add (2026-03-15)
- [x] **Dashboard V2/V3** — Ops-first split layout with live countdown timers (2026-03-11/12)
- [x] **Item Detail: UW Asset Tag Mirror** — uwAssetTag shown in page header (2026-03-11)
- [x] **Item Detail: Calendar Grid** — Month-view calendar with booking blocks (2026-03-11)
- [x] **Item Detail: Booking Refresh Fix** — BookingDetailsSheet onUpdated wired to reload data (2026-03-11)
- [x] **Duplicate/Clone Action** — Duplicate button on reservation detail + list context menu (2026-03-14)

---

## Phase B Remaining

- [ ] **Dashboard filter chips** (Sport, Location) — deferred from V1
- [ ] **Dashboard saved filters** — deferred from V1
- [ ] **Kit management UI** (D-020) — full schema, zero UI
- [x] **Department filter/display** (D-019) — shipped 2026-03-21
- [ ] **Notification center pagination** — list grows unbounded
- [ ] **Shift email notifications** — V1 = in-app audit only
- [ ] **Student availability tracking** — students declare unavailable dates

---

## Pending Decisions

See `docs/GAPS_AND_RISKS.md` for the full registry. Key items:

1. **PD-2**: Venue mapping governance — who owns regex-to-location mapping table?
2. **PD-3**: Event sync refresh cadence — Vercel Cron schedule and staleness thresholds

---

## Notes

- Always write a BRIEF_*.md or Decision record before implementing any new feature
- Run `npm run build` before any commit — build failures are avoidable
- Every mutation endpoint needs audit logging — do not skip
- NORTH_STAR.md is the first read for any new Claude session
- When shipping a feature, update the relevant AREA file and GAPS_AND_RISKS.md (CLAUDE.md rule 12)
