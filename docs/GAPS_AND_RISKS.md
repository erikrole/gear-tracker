# Gear Tracker — Gaps, Pending Decisions, and Risks

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-27
- Status: Living registry — update when shipping features or resolving decisions
- Purpose: Single file listing every open gap, pending decision, and known risk across all docs

---

## Pending Decisions

| ID | Description | Owner Area | Priority | Blocker? |
|---|---|---|---|---|
| ~~PD-1~~ | ~~D-009: Escalation recipient model~~ | ~~AREA_NOTIFICATIONS~~ | ~~Resolved~~ | ~~Requester + all admins; admin-configurable fatigue controls~~ |
| ~~PD-2~~ | ~~Venue mapping governance — who owns regex-to-location mapping table?~~ | ~~AREA_EVENTS~~ | ~~Resolved~~ | ~~D-027: Admin-only, pattern validation, longest-match tie-breaking~~ |
| ~~PD-3~~ | ~~Event sync refresh cadence — Vercel Cron schedule and staleness thresholds~~ | ~~AREA_EVENTS~~ | ~~Resolved~~ | ~~D-026: Daily cron (6 AM UTC) + manual refresh, staleness indicator, admin failure alerts~~ |
| ~~PD-4~~ | ~~B&H metadata cache TTL target~~ | ~~AREA_ITEMS~~ | ~~N/A~~ | ~~No — D-005 withdrawn~~ |
| ~~PD-5~~ | ~~Student mobile KPI definitions~~ | ~~AREA_MOBILE~~ | ~~Resolved~~ | ~~Taps-to-checkout ≤3, scan success ≥95%, task completion <30s~~ |

---

## Open Gaps

| ID | Description | Owner Area | Status | Notes |
|---|---|---|---|---|
| ~~GAP-1~~ | ~~`BRIEF_STUDENT_MOBILE_V1.md` not written~~ | ~~AREA_MOBILE~~ | ~~Closed~~ | ~~Brief written, V1 hardening shipped 2026-03-15~~ |
| ~~GAP-2~~ | ~~Draft persistence model underspecified~~ | ~~AREA_DASHBOARD~~ | ~~Closed~~ | ~~Shipped 2026-03-16: DRAFT booking CRUD + dashboard section + auto-save on cancel~~ |
| ~~GAP-3~~ | ~~Equipment guidance: only 3 rules in production~~ | ~~AREA_CHECKOUTS~~ | ~~Closed~~ | ~~3 rules shipped: body-needs-batteries, lens-needs-body, audio-with-video. Admin-config deferred to Phase C per D-016~~ |
| GAP-4 | Phase C features unscoped and unbriefed | NORTH_STAR | Expected | Kiosk, templates, analytics — intentionally deferred |
| ~~GAP-5~~ | ~~D-009 alert fatigue controls undefined~~ | ~~AREA_NOTIFICATIONS~~ | ~~Closed~~ | ~~Admin-configurable intervals + per-booking caps; D-009 accepted~~ |
| ~~GAP-6~~ | ~~Email notification channel not wired~~ | ~~AREA_NOTIFICATIONS~~ | ~~Closed~~ | ~~Resend email service wired; dual-channel (in-app + email) shipped 2026-03-16~~ |
| ~~GAP-7~~ | ~~No shared data-fetching pattern — 3 different URL state implementations, manual fetch+useState everywhere~~ | ~~CROSS-CUTTING~~ | ~~Closed (partial)~~ | ~~`useFetch`, `useUrlState`, `classifyError` hooks extracted 2026-03-24. Pages not yet migrated to use them (Sprint 2).~~ |
| ~~GAP-8~~ | ~~Reports page is a navigation dead end — no drill-down to individual bookings/items~~ | ~~AREA_DASHBOARD~~ | ~~Closed~~ | ~~Drill-down links added to MetricCard in checkouts, overdue, and utilization reports 2026-03-24~~ |
| ~~GAP-9~~ | ~~Dashboard is a monolithic client component — blocks location filter, inline actions, saved filters~~ | ~~AREA_DASHBOARD~~ | ~~Closed~~ | ~~Decomposed: `useDashboardData`, `useDashboardFilters` hooks + 7 leaf components (avatars, chart, overdue, filters, columns, skeleton). Page.tsx reduced from 1004 to ~170 lines (2026-03-24)~~ |
| ~~GAP-10~~ | ~~Kit management page exists but is empty — confusing for users navigating via sidebar~~ | ~~AREA_CHECKOUTS~~ | ~~Closed~~ | ~~Placeholder card shipped; Kits moved to Admin group with "Soon" badge in sidebar (2026-03-24)~~ |
| GAP-11 | No cross-page data cache — every navigation triggers full re-fetch | CROSS-CUTTING | Expected | V2 `useFetch` migration complete (all pages use Visibility API refresh). V3: adopt React Query for shared cache + stale-while-revalidate. |
| ~~GAP-12~~ | ~~No stale-data detection across browser tabs or after backgrounding~~ | ~~CROSS-CUTTING~~ | ~~Closed~~ | ~~`useFetch` hook includes Page Visibility API refresh; item detail page refreshes on tab focus 2026-03-24~~ |
| ~~GAP-13~~ | ~~`BRIEF_KIT_MANAGEMENT_V1.md` not written — blocks kit UI implementation (D-020)~~ | ~~AREA_CHECKOUTS~~ | ~~Closed~~ | ~~Brief written 2026-03-24; V1 scope: kit CRUD + member management + derived availability~~ |
| ~~GAP-14~~ | ~~Scan page is 1,038 lines — monolithic, blocks feature additions~~ | ~~AREA_CHECKOUTS~~ | ~~Closed~~ | ~~Decomposed 2026-03-25: page.tsx 1,038→251 lines. Extracted `useScanSession`, `useScanSubmission` hooks + 4 leaf components (`ScanControls`, `ScanChecklist`, `UnitPickerSheet`, `ItemPreviewSheet`) + shared types~~ |
| ~~GAP-15~~ | ~~Schedule page is 1,012 lines — monolithic, blocks feature additions~~ | ~~AREA_SHIFTS~~ | ~~Closed~~ | ~~Decomposed 2026-03-25: page.tsx 1,012→117 lines. Extracted `useScheduleData` hook + 3 leaf components (`ScheduleFilters`, `CalendarView`, `ListView`) + shared types~~ |
| ~~GAP-16~~ | ~~Shared hooks extracted but not adopted — some pages still use inline fetch+useState~~ | ~~CROSS-CUTTING~~ | ~~Closed~~ | ~~All pages migrated: notifications (`useFetch`+`useUrlState`), labels (`useFetch`+`useDebounce`), search (`useUrlState`), users list (`useFetch`+`useDebounce`), user detail (`useFetch`), UserActivityTab (`useFetch`). Profile redirect uses AbortController.~~ |
| ~~GAP-17~~ | ~~Labels page not linked from item workflows~~ | ~~AREA_ITEMS~~ | ~~Closed~~ | ~~Already shipped: "Print label" action in item detail context menu → `/labels?items=id`~~ |
| ~~GAP-18~~ | ~~Kit-to-booking integration missing — kits can't be checked out as a group~~ | ~~AREA_CHECKOUTS~~ | ~~Closed~~ | ~~Shipped 2026-03-25: `kitId` FK on Booking (migration 0018), kit selector in CreateBookingSheet (location-filtered), kit badge on booking detail page, validation + service + API route wiring~~ |
| ~~GAP-19~~ | ~~`useFormSubmit` hook extracted but only adopted by 1 form (Create User) — checkout/reservation/kit creation still use ad-hoc fetch+validation~~ | ~~CROSS-CUTTING~~ | ~~Closed~~ | ~~All create/edit forms migrated to `useFormSubmit` 2026-03-27: auth forms (login, register, forgot-password, reset-password), kit creation, bulk inventory. `skipAuthRedirect` option added for auth pages.~~ |
| ~~GAP-20~~ | ~~Events list page is 817 lines — monolithic, no loading states, no error recovery, no AbortController~~ | ~~AREA_EVENTS~~ | ~~Closed~~ | ~~Event detail page hardened 2026-03-26: AbortController on all fetches + onUpdated, error differentiation, skeleton loading, nudge toast feedback, color-coded avatars. Page reduced from 817→607 lines in prior pass, 6-pass audit complete.~~ |
| GAP-21 | `SystemConfig` model has zero UI — key-value config store with no admin surface | AREA_SETTINGS | Expected | Low priority. Used internally for escalation config. Admin UI deferred until more config keys are needed. |
| ~~GAP-22~~ | ~~`FavoriteItem` model has API but no UI surface — no favorites filter on items list, no favorites page~~ | ~~AREA_ITEMS~~ | ~~Closed~~ | ~~Fully shipped: star column in items DataTable, optimistic toggle on item detail page, "Favorites" filter chip in toolbar, `favorites_only` query param in API. Batched favorite lookup (no N+1).~~ |
| ~~GAP-23~~ | ~~`StudentSportAssignment` and `StudentAreaAssignment` are read-only display — no CRUD UI for editing assignments~~ | ~~AREA_USERS~~ | ~~Closed~~ | ~~Full CRUD shipped in UserInfoTab.tsx: sport popover multi-select + area popover with primary toggle. Permission-gated (admin/staff can edit, students read-only). APIs: POST/DELETE sport roster + POST/DELETE student-areas.~~ |
| ~~GAP-24~~ | ~~No dashboard reservation date filter — AC-4 not enforced~~ | ~~AREA_DASHBOARD~~ | ~~Closed~~ | ~~Fixed 2026-03-25: Added 7-day window filter to stats count query. AC-4 enforced.~~ |
| ~~GAP-25~~ | ~~Importer drops unmapped columns silently~~ | ~~AREA_IMPORTER~~ | ~~Closed~~ | ~~Fixed 2026-03-25: `buildAssetData()` stores unmapped CSV columns in `sourcePayload` per D-014.~~ |
| ~~GAP-26~~ | ~~Settings pages accessible to non-admin users~~ | ~~AREA_SETTINGS~~ | ~~Closed~~ | ~~Verified 2026-03-25: Layout (ADMIN+STAFF) and Sidebar (ADMIN+STAFF) both enforce correctly.~~ |

---

## Phase B Deferred Features

| Feature | Owner Area | Decision Ref | Notes |
|---|---|---|---|
| ~~Asset financial fields UI~~ | ~~AREA_ITEMS~~ | ~~D-018~~ | ~~Shipped 2026-03-16: Procurement section in item detail Info tab~~ |
| ~~Department filter/display~~ | ~~AREA_ITEMS~~ | ~~D-019~~ | ~~Shipped 2026-03-21: department FK, combobox filter on items page~~ |
| ~~Kit management UI + kit-based checkout~~ | ~~AREA_CHECKOUTS~~ | ~~D-020~~ | ~~V1 shipped 2026-03-24: CRUD + member management + search + archive. V2 shipped 2026-03-25: kit-to-booking integration (kitId FK, selector, display).~~ |
| ~~Dashboard saved filters~~ | ~~AREA_DASHBOARD~~ | ~~—~~ | ~~Shipped 2026-03-24: Save view button + localStorage presets + apply/delete~~ |
| ~~Dashboard filter chips (Sport, Location)~~ | ~~AREA_DASHBOARD~~ | ~~—~~ | ~~Sport filter shipped 2026-03-23; Location filter shipped 2026-03-24~~ |
| ~~Notification center polish (pagination, mark-as-read)~~ | ~~AREA_NOTIFICATIONS~~ | ~~—~~ | ~~Shipped: pagination, mark-as-read, unread filter all implemented~~ |
| ~~Multi-recipient escalation~~ | ~~AREA_NOTIFICATIONS~~ | ~~D-009~~ | ~~Shipped 2026-03-15: +24h escalation reaches requester + all admins; admin-configurable fatigue controls~~ |
| ~~Picker improvements (multi-select, scan-to-add)~~ | ~~AREA_CHECKOUTS~~ | ~~—~~ | ~~Shipped 2026-03-15~~ |
| ~~Calendar source health UI~~ | ~~AREA_EVENTS~~ | ~~—~~ | ~~Shipped 2026-03-19: /settings/calendar-sources — enable/disable, sync status, health badges, error display, add/delete~~ |
| ~~Shift scheduling (replaces Asana/WhenToWork)~~ | ~~AREA_SHIFTS~~ | ~~—~~ | ~~Shipped 2026-03-16: sport configs, auto-generation, assignment, trade board. V2 shipped 2026-03-26: per-event shift editing, universal assignment, avatar picker (see BRIEF_SHIFT_REDESIGN_V2)~~ |
| Shift notification channel (email for trade claims) | AREA_SHIFTS | — | V1 = in-app audit only; email deferred |
| Student availability tracking | AREA_SHIFTS | — | Students declare unavailable dates; deferred to Phase B |
| ~~Scheduling + gear deep linking (shiftAssignmentId FK on Booking)~~ | ~~AREA_SHIFTS / AREA_CHECKOUTS~~ | ~~—~~ | ~~Shipped 2026-03-18: shiftAssignmentId FK on Booking, wired through creation APIs~~ |

---

## Phase C Deferred Features

| Feature | Owner Area |
|---|---|
| Kiosk mode (self-serve scan station) | AREA_CHECKOUTS |
| Reservation and checkout templates | AREA_RESERVATIONS |
| Board / ops view for game-day coordinators | AREA_DASHBOARD |
| Advanced analytics | NORTH_STAR |
| Multi-source event ingestion beyond UW Badgers ICS | AREA_EVENTS |
| Database-configurable equipment guidance rules | AREA_CHECKOUTS (D-016) |

---

## Active Risks

| Risk | Early Signal | Defense | Owner |
|---|---|---|---|
| Analytics creep | Chart widget requests before workflows solid | Invoke Phase C deferral; link NORTH_STAR.md | Product |
| Status drift | Any PR writing to `status` as authoritative | D-001 is a hard gate; block at review | Engineering |
| Generic inventory thinking | Features that fit any business but not athletics ops | Decision filter: "would Cheqroom have this by default?" | Product |
| Mobile as afterthought | Dashboard/list changes without AREA_MOBILE.md review | Scope rule: mobile review mandatory | Engineering |
| Scope expansion without brief | Features shipped without BRIEF_*.md or Decision record | CLAUDE.md rule 12: no brief = no implementation | Product |
| Premature Phase C | Kiosk/templates work before Phase A/B solid | Roadmap sequencing enforced by NORTH_STAR.md | Product |
| ~~Missing SERIALIZABLE on cancel transactions~~ | ~~`cancelBooking()` and `cancelReservation()` used READ_COMMITTED~~ | ~~Fixed 2026-03-24: both upgraded to SERIALIZABLE. Grep `db.$transaction(async` for remaining cases.~~ | ~~Engineering~~ |
| Equipment guidance stagnation | Only 3 guidance rules in production | Quarterly rule audit with operator input | Product |
| Alert fatigue from escalation | Repeated overdue notifications overwhelm staff | D-009 fatigue controls required before Phase B | Engineering |
| ~~Pattern fragmentation~~ | ~~New pages copy-paste fetch/URL/error patterns instead of reusing hooks~~ | ~~Closed 2026-03-25: all data-loading pages migrated to shared hooks (`useFetch`, `useUrlState`, `useDebounce`). Pattern is now consistent.~~ | ~~Engineering~~ |
| ~~Monolithic page files~~ | ~~Scan (1,038) and schedule (1,012) grew with each feature~~ | ~~Closed 2026-03-25: scan decomposed (1,038→251), schedule decomposed (1,012→117)~~ | ~~Engineering~~ |
| ~~Dashboard monolith~~ | ~~Dashboard page grows with each feature (filters, actions, sections)~~ | ~~Closed 2026-03-24: decomposed into hooks + 7 leaf components~~ | ~~Engineering~~ |
| Audit log unbounded growth | Audit table has no retention policy or archival | Monitor table size quarterly; implement archival at 10x scale | Engineering |
| ~~Events page monolith~~ | ~~Events list page is 817 lines with no hardening~~ | ~~Closed 2026-03-26: GAP-20 hardening complete (AbortController, error differentiation, skeleton, toast feedback). 817→607 lines.~~ | ~~Engineering~~ |
| ~~Form pattern fragmentation~~ | ~~`useFormSubmit` adopted by 1 form; rest use ad-hoc fetch+validation~~ | ~~Closed 2026-03-27: all create/edit forms migrated to `useFormSubmit` (auth forms, kit, bulk inventory). `skipAuthRedirect` option added for auth pages.~~ | ~~Engineering~~ |
| ~~Importer data loss~~ | ~~Unmapped CSV columns silently dropped (D-014 violation)~~ | ~~Closed 2026-03-25: `sourcePayload` now stores unmapped columns per D-014~~ | ~~Engineering~~ |
| ~~TOCTOU on unique constraints~~ | ~~findUnique pre-check before create/update~~ | ~~Closed 2026-03-23: catch P2002 instead of manual pre-check~~ | ~~Engineering~~ |
| ~~STAFF editing ADMIN profiles/roles~~ | ~~Role guard only checks grant, not revoke/edit~~ | ~~Closed 2026-03-23: target.role === ADMIN guard on all mutation endpoints~~ | ~~Engineering~~ |

---

## Closed Items (for reference)

| ID | Description | Closed Date | Resolution |
|---|---|---|---|
| ~~GAP-A~~ | AREA_NOTIFICATIONS.md missing | 2026-03-11 | File exists, escalation schedule documented |
| ~~GAP-B~~ | DRAFT booking state not formally specced | 2026-03-11 | D-017 accepted, documented in AREA_CHECKOUTS.md |
| ~~GAP-C~~ | Calendar source enable/disable not specced | 2026-03-11 | Implemented: enabled toggle + sync health UI shipped |
| ~~GAP-D~~ | Sync health dashboard no admin UI | 2026-03-11 | Implemented: source table shows event count, last synced, error badge |
| ~~GAP-E~~ | Bulk items lack individual loss tracking | 2026-03-14 | D-022: numbered bulk units with trackByNumber flag, unit picker, and per-unit status |

---

## Change Log
- 2026-03-11: Initial registry created from docs hardening pass. Consolidated from NORTH_STAR.md gaps, DECISIONS.md pending items, and scattered AREA file TODOs.
- 2026-03-14: Closed GAP-E (bulk items lack individual loss tracking) — D-022 shipped.
- 2026-03-15: Picker improvements shipped — multi-select, per-section search, availability preview, scan-to-add.
- 2026-03-15: Closed PD-1 (escalation recipients: requester + all admins), PD-5 (student KPIs defined), GAP-5 (fatigue controls: admin-configurable). D-009 formally accepted.
- 2026-03-15: Closed GAP-1 (student mobile brief written, V1 hardening shipped).
- 2026-03-16: Closed GAP-6 (email notification channel wired via Resend + Vercel Cron every 15min).
- 2026-03-16: Sentry error tracking wired (optional DSN, source maps, global error boundary). Vercel Blob image upload wired (POST/DELETE /api/assets/:id/image).
- 2026-03-16: UI overhaul — modern minimal design system. Removed liquid glass, warm neutrals, #202020 dark sidebar, Wisconsin red for brand moments only, neutral dark primary buttons.
- 2026-03-16: Closed GAP-2 (draft persistence). D-017 shipped: DRAFT CRUD API, dashboard Drafts section, auto-save on cancel, resume pre-fill. D-018 marked shipped (financial fields already in UI).
- 2026-03-18: Closed scheduling + gear deep linking. shiftAssignmentId FK on Booking shipped, Event Command Center with missing gear detection.
- 2026-03-18: Audit logging hardening — added createAuditEntry to 8 mutation endpoints (asset create, accessory attach/move/detach, image upload/delete, escalation config/rule update, profile update, draft discard). Per D-007.
- 2026-03-19: Department filter/display on items page. Calendar source health UI shipped (/settings/calendar-sources). Notification center polish confirmed already shipped. Archived 8 completed plan files.
- 2026-03-18: Security & data integrity hardening pass — 13 fixes: seed endpoint auth gating, STAFF→ADMIN privilege escalation blocked (role change + user creation), markCheckoutCompleted status guard (prevents double bulk stock return), bulk adjust Serializable isolation, shift trade TOCTOU races wrapped in transactions, scan session race condition fixed, booking route permission checks added, calendar source delete wrapped in transaction, escalation PATCH zod validation, shift trade status param validated, bulk scan quantity overflow guard, Booking.requesterUserId index, Notification→User FK with cascade delete.
- 2026-03-20: Full shadcn/ui migration (Slices 1–5.4 + Deep Integration A–F). Replaced all custom primitives with shadcn components across 20+ pages.
- 2026-03-21: Items page rebuilt with shadcn DataTable — sorting, row actions, context menu, column visibility, enhanced pagination. Department FK + combobox filter. Insights tab with legends, empty states, punctuality accuracy. Item detail page overhauled with shadcn inputs and save feedback.
- 2026-03-21: MVP polish pass — audit logging added to departments and notifications/process routes, skeleton components standardized to shadcn, inline styles replaced with Tailwind utilities.
- 2026-03-22: Unified booking detail page — checkout and reservation detail pages merged into single `BookingDetailPage` component. Old GET/PATCH API routes redirect to `/api/bookings/[id]`. Extracted shared hooks and `InlineTitle` component. PATCH returns enriched detail with before-snapshot audit diffs. Dark mode and accessibility hardening.
- 2026-03-22: Items list page hardening (5-pass audit): AbortController race condition fix, refresh-preserves-data pattern, toast feedback on all mutations, high-fidelity skeleton, actionBusy double-click guard, shimmer progress bar.
- 2026-03-22: Booking detail UX polish (3 rounds) — auto-select returnable items, optimistic checkin, progress bar, success toasts, shadcn component replacements (Breadcrumb, Collapsible, ToggleGroup, Alert, Progress). Status vocabulary (D-025): OPEN→"Checked out", BOOKED→"Confirmed". Action buttons redesigned. Equipment row context menus. Avatar initials on people fields. Due-back countdown as urgency Badge. Natural-language activity labels. InlineTitle save feedback.
- 2026-03-23: Scan page hardening (5-pass) — design system alignment, data flow hardening, resilience, UX polish. No new gaps opened.
- 2026-03-23: Profile page hardening (5-pass) — merged profile into user detail page, fixed student self-edit permissions, optimistic avatar removal, high-fidelity skeletons. No new gaps opened.
- 2026-03-23: Reports page hardening (6-pass) — shadcn/ui migration (Table, Badge, Alert), data flow hardening (AbortController, 401, null-safe arrays), resilience (error differentiation), UX polish (refresh-without-replacement, loading spinners). Features: data freshness indicator, URL-persisted filters, MetricCard tooltips. No new gaps opened.
- 2026-03-23: System roadmap review — added GAP-7 through GAP-13 (systemic gaps: pattern fragmentation, reports dead end, dashboard monolith, kits placeholder, cross-page cache, stale-data detection, kit brief missing). Added 3 new active risks (pattern fragmentation, dashboard monolith, audit log growth). Updated GAP-3 to reflect 3 shipped rules. See `tasks/system-roadmap.md` for full analysis.
- 2026-03-23: Unified Schedule page (V1) shipped. Events + Schedule merged into `/schedule`. Old events list page removed. Venue Mappings moved to `/settings/venue-mappings`. System roadmap updated — calendar merge is item #1 in V1 order.
- 2026-03-23: Schedule V2 enhancements shipped — "My Shifts" filter (student-first, localStorage-persisted), inline coverage expansion (per-area breakdown with avatars + assign), Trade Board as Sheet overlay with open-trade count badge, view mode persistence, auto-scroll to today.
- 2026-03-23: Schedule page hardened (4-pass) — design system alignment, AbortController race prevention, 401 redirect, network vs server error differentiation, refresh-preserves-data pattern, filtered count indicator.
- 2026-03-24: Closed GAP-13 (`BRIEF_KIT_MANAGEMENT_V1.md` written — V1 scope: kit CRUD, member management, derived availability). Resolved PD-2 (D-027: admin-owned venue mappings with pattern validation) and PD-3 (D-026: hourly cron sync with staleness indicator).
- 2026-03-24: V1 Cohesive Foundation completion — Dashboard decomposed into `useDashboardData`, `useDashboardFilters` hooks + 7 leaf components (GAP-9 closed). Empty state audit across search, scan, bulk-inventory, data-table. `useFormSubmit` hook extracted for standardized form handling (Zod validation → fetch → error classification → toast). Applied to Create User dialog as reference implementation.
- 2026-03-24: V2 system roadmap revision. Added GAP-14 (scan page 1,038 lines needs decomposition), GAP-15 (schedule page 1,012 lines needs decomposition), GAP-16 (shared hooks extracted but not adopted by most pages), GAP-17 (labels not linked from item workflows), GAP-18 (kit-to-booking integration missing). Added active risk: monolithic page files (scan/schedule). Updated GAP-11 timeline (React Query deferred to V3; V2 focuses on `useFetch` migration). See `tasks/system-roadmap.md` for full V2 plan.
- 2026-03-25: Doc sync pass — closed GAP-3 (3 equipment guidance rules shipped, not 1). Struck through multi-recipient escalation row (D-009 shipped 2026-03-15). Verified all AREA doc dates, cross-referenced audit findings. No new gaps or pending decisions opened.
- 2026-03-25: Closed GAP-14 (scan page decomposed). `page.tsx` reduced from 1,038→251 lines (76% reduction). Extracted: `useScanSession` hook (status, polling, completion), `useScanSubmission` hook (scan processing, feedback, unit picker), 4 leaf components (`ScanControls`, `ScanChecklist`, `UnitPickerSheet`, `ItemPreviewSheet`), shared types module.
- 2026-03-25: Closed GAP-15 (schedule page decomposed). `page.tsx` reduced from 1,012→117 lines (88% reduction). Extracted: `useScheduleData` hook (fetch, merge, filter, user info), 3 leaf components (`ScheduleFilters`, `CalendarView`, `ListView`), shared types module. Monolithic page files risk closed — both pages decomposed.
- 2026-03-25: Closed GAP-16 (shared hooks fully adopted). All data-loading pages migrated to `useFetch`, `useUrlState`, `useDebounce`. Pattern fragmentation risk closed.
- 2026-03-25: Closed GAP-18 (kit-to-booking integration). `kitId` FK on Booking model (migration 0018, index, SET NULL cascade). Kit selector in CreateBookingSheet (location-filtered, optional). Kit badge display on booking detail page. Validation schemas + service + API routes updated.
- 2026-03-26: System roadmap V3 revision. Added GAP-19 (`useFormSubmit` not adopted across forms), GAP-20 (events list 817-line monolith), GAP-21 (SystemConfig zero UI), GAP-22 (FavoriteItem no UI surface), GAP-23 (student assignment CRUD missing), GAP-24 (dashboard reservation date filter bug), GAP-25 (importer sourcePayload not wired), GAP-26 (settings auth guard missing). Added 3 active risks (events page monolith, form pattern fragmentation, importer data loss). Updated GAP-11 to reflect V2 `useFetch` migration complete.
- 2026-03-27: Alpha → Beta release. Closed GAP-24 (reservation 7-day filter shipped), GAP-25 (sourcePayload wired per D-014), GAP-26 (settings auth guard verified). Removed importer data loss from active risks. All P0 gaps resolved — system enters Beta.
- 2026-03-27: Database performance audit complete — P0-P3 fixes shipped (SERIALIZABLE on all scan/booking mutations, 6 indexes, dashboard query consolidation 17→9, audit log batching, notification pre-fetch fix, pg_trgm GIN indexes). Search-on-type equipment picker shipped — form-options no longer loads all assets (unbounded query eliminated). New `/api/assets/picker-search` endpoint with section filtering, text search, QR lookup, and pagination.
- 2026-03-27: Form pattern fragmentation closed — all create/edit forms migrated to `useFormSubmit`. API security audit: rate limiting on all auth endpoints (login/register/forgot/reset), timing-safe CRON_SECRET comparison, asset activity cursor pagination.
- 2026-03-27: Backlog audit pass — centralized duplicate `getInitials` in BookingCard (now imports from `@/lib/avatar`), deleted dead `CreateBookingCard` component + barrel export, booking audit log cursor pagination (initial 50 + "Load older entries" via `/api/bookings/[id]/audit-logs`).
