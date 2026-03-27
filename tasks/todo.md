# Task Queue

Last updated: 2026-03-27

**Current release**: Beta (2026.03.27.1) — CalVer versioning adopted.
**Release workflow**: `npm run release` creates CalVer tag + GitHub Release.

---

## P0 — Critical (bugs, broken features, data integrity)

### Notifications
- [x] **Fix icon type mapping** — Removed dead UPPER_CASE type cases from `notifIcon()` and `notifIconClass()`. Only service-created snake_case types remain.
- [x] **Fix cron schedule mismatch** — Daily 8AM is correct for Hobby plan (once/day limit). Sub-hourly escalation requires Pro plan upgrade. Documented constraint in AREA_NOTIFICATIONS.md.

### Importer
- [x] **Add `sourcePayload` to schema + importer** — Field existed in schema. Fixed `buildAssetData()` to store only unmapped CSV columns in `sourcePayload` (D-014 lossless parsing), not mixed with notes-style fields.
- [x] **Fix BulkSku routing** — Verified: `Kind=Bulk` rows correctly route to BulkSku + BulkStockBalance via `consumable` flag. Cheqroom preset maps `Kind` column. Audit was outdated.

### Items
- [x] **Wire Export button** — Already wired: Export button in items page header, visible to ADMIN/STAFF, downloads filtered CSV via `/api/assets/export`.
- [x] **Add assetTag uniqueness check on create** — Added onBlur check in SerializedItemForm. Inline error shown when duplicate tag detected.

### Dashboard
- [x] **Fix reservation 7-day window filter** — Added `startsAt: { gte: now, lte: sevenDaysFromNow }` to stats count query. AC-4 now enforced.

### Events
- [x] **Harden Events list page** — Old `/events` list removed. Unified `/schedule` page is 117 lines, fully decomposed with hooks + leaf components.
- [x] **Harden Event detail page** — 606 lines, fully hardened: AbortController, error differentiation, high-fidelity skeleton, manual refresh.

### Settings
- [x] **Auth guard verified** — Layout (ADMIN+STAFF) and Sidebar (ADMIN+STAFF) both enforce correctly. Updated AREA_SETTINGS.md to reflect ADMIN+STAFF policy (was incorrectly documented as ADMIN-only).

---

## P1 — High (hardening, security, UX gaps)

### Notifications
- [x] **Harden notification center** — Full rewrite: pre-shadcn CSS → Tailwind, skeleton loading, error state with retry (network/server differentiation), shadcn Switch for filter, proper CardContent structure.
- [x] **Add Zod + audit to nudge endpoint** — Added `z.object({ assignmentId: z.string().cuid() })` schema + `createAuditEntry` with action `nudge_sent`.
- [x] **Add audit logging to mark-as-read** — Added `createAuditEntry` for both `mark_all_read` (with count) and `mark_read` actions.

### Settings
- [x] **Harden Categories page** — Error state UI with retry, skeleton loading, inline styles → Tailwind, pre-shadcn CSS → Tailwind.
- [x] **Harden Sports page** — Error state UI (network/server differentiation) with retry, skeleton loading, consistent error handling.
- [x] **Harden Escalation page** — pre-shadcn `data-table` → shadcn Table components, toggle buttons → shadcn Switch, inline styles → Tailwind, error state with retry, skeleton loading.
- [x] **Fix layout double breadcrumb** — Settings pages render own breadcrumb + AppShell breadcrumb. Fixed: removed settings layout `.breadcrumb` div, events detail custom breadcrumb, and items detail duplicate `<PageBreadcrumb />`. Added `events→Schedule` route alias + mobile truncation.

### Shifts
- [x] **Harden schedule page** — Decomposed 1,012→117 lines + 4-pass hardening (2026-03-25).
- [x] **Wrap decline/remove in transactions** — `declineRequest()` and `removeAssignment()` now use `db.$transaction()` to prevent TOCTOU races.

### Reservations
- [x] **Harden BookingListPage** — Already hardened: AbortController, skeleton, error handling, double-submit guards all present.

### Items
- [x] **Harden item detail page** — Already hardened: AbortController, comprehensive skeleton, error states with retry, double-submit guards. Fixed 2 remaining inline styles → Tailwind `size-[120px]`.
- [x] **Add double-submit guard to NewItemSheet** — Already implemented: `submitting` flag disables button, shows "Adding..." text.

### Importer
- [x] **Add Zod validation on mapping JSON** — Added `z.record(z.string().min(1), z.string().min(1))` schema to validate user-provided column mapping.
- [x] **Harden import page** — Full rewrite: pre-shadcn CSS (`data-table`, `summary-grid`, `metric-value`, `alert-error`) → shadcn Table + Tailwind. Hardcoded `#fffbeb` → dark-mode-safe `bg-amber-50 dark:bg-amber-950/20`. All inline styles → Tailwind. `<a href>` → Next.js `<Link>`. `useToast` → sonner.

### Mobile/Scan
- [x] **Fix dark mode unit picker** — Replaced `bg-white`/`bg-blue-100` with `bg-background`/`text-foreground` + `dark:bg-blue-900/40` tokens.

### Events
- [x] **Resolve duplicate source management** — Added URL uniqueness check in POST handler. Returns 409 if source URL already exists.

### Dashboard
- [x] **Implement student role-adaptive dashboard** (AC-3) — Students see only "My Gear" column (full width), no stat strip, no quick actions. Team activity hidden.
- [x] **Add owned-booking visual distinction** (AC-5) — My Gear checkout/reservation rows show `border-l-2 border-l-primary` accent to distinguish from team rows.

### Users
- [x] **Add audit logging to avatar upload/delete** — Added `createAuditEntry` for `avatar_uploaded` and `avatar_deleted` actions.

---

## P2 — Medium (polish, tests, doc completion)

### Notifications
- [x] **Implement dashboard badge counts** — Already implemented: AppShell fetches unread count, Sidebar shows SidebarMenuBadge.

### Events
- [x] **Replace `<a href>` with `<Link>`** — Already done. All events pages use Next.js `<Link>`.
- [x] **Add server-side eventId filter for shift groups** — Added `eventId` query param to `/api/shift-groups`. Events detail page now fetches by eventId directly.

### Items
- [x] **Verify numbered bulk item UI end-to-end** — Verified: bulk-inventory page supports `trackByNumber` toggle, unit grid with status cycling, scan flow unit picker works.
- [x] **Add audit to favorite toggle** — Added `createAuditEntry` for `favorite_added` and `favorite_removed` actions.

### Reservations
- [ ] **Resolve equipment conflict badges** (AC-8) — Conflict detection exists in EquipmentPicker; booking detail display pending.
- [ ] **Expand test coverage** — Reservation lifecycle transitions (deferred to test sprint).

### Shifts
- [x] **Add pagination to shift groups + trade board** — Added `limit`/`offset` to shift-groups API via `parsePagination`. Trade board already bounded.
- [x] **Tighten trade claim area eligibility** — Already implemented: `claimTrade()` validates claimant's `primaryArea` against shift area.

### Settings
- [x] **Clean up legacy CSS** — Verified: no dead CSS found. All classes actively referenced.

### Users
- [x] **Add user deactivation brief** — Written: `docs/BRIEF_USER_DEACTIVATION_V1.md` with V1 scope, ACs, and technical notes.
- [ ] **Add sport/area assignment CRUD** — Currently read-only. Needs new API endpoints + edit UI (deferred to V2 per users roadmap).
- [ ] **Write authorization integration tests** — Role escalation, ownership gating (deferred to test sprint).
- [x] **Add pagination to activity endpoint** — Already implemented: cursor-based pagination with `DEFAULT_LIMIT=50`, `MAX_LIMIT=100`.

### Dashboard
- [x] **Fix `defaultLocationId()` error handling** — Changed `throw Error` to `throw HttpError(500)` with user-facing message.

### Importer
- [x] **Add progress indicator** — Importing step now shows item counts and mode breakdown.
- [x] **Add import mode toggle** — Added create-only vs upsert mode selector. Server skips updates in create_only mode.

### Mobile/Scan
- [x] **Improve camera permission UX** — QrScanner detects `NotAllowedError` and shows specific permission instructions.

---

## P3 — Low (future planning, nice-to-haves)

### Events
- [x] **Better opponent/venue normalization** — Opponent names extracted as-is from ICS. Venue mapping via admin regex patterns works. Further normalization (dedup "Purdue" vs "PU") deferred — low impact, admin can manage via venue mappings.

### Items
- [x] **Implement draft recovery or descope** — Descoped. Item creation does not persist drafts. Users must complete entry in one session. Booking drafts (DRAFT status) serve this need for checkouts/reservations.

### Shifts
- [x] **Clean up inline styles** — Removed `style={{ minWidth: 160 }}` from CalendarView (→ `min-w-[160px]`). Coverage dot kept as inline style (dynamic computed color). Search page inline border → Tailwind `border-b`.

### Importer
- [x] **Implement dry-run mode** — Descoped. Preview mode (`?mode=preview`) already fulfills this: validates CSV, predicts create/update/skip counts, shows errors — all without writing to DB.

### Mobile/Scan
- [x] **Plan Phase B scan telemetry** — Written: `docs/BRIEF_SCAN_TELEMETRY_V1.md` with 7 events, KPIs, and Vercel Analytics approach.
- [x] **Deduplicate statusColor helper** — Created `src/lib/status-colors.ts` with `statusBadgeVariant()` and `statusColorClasses()`. Replaced duplicates in ItemPreviewSheet and search page.

### Notifications
- [x] **Write BRIEF for Phase B escalation work** — Written: `docs/BRIEF_ESCALATION_PHASE_B.md` covering sub-hourly cron, shift notifications, repeat offender policy.

---

## Phase B Backlog (needs briefs before implementation)

- [x] **Kit management UI** (D-020) — shipped 2026-03-24
- [x] **Dashboard filter chips** (Sport, Location) — shipped 2026-03-23/24
- [x] **Dashboard saved filters** — shipped 2026-03-24
- [x] **Department filter/display** (D-019) — shipped 2026-03-21
- [ ] **Shift email notifications** — V1 = in-app only
- [ ] **Student availability tracking** — Declare unavailable dates
- [ ] **Date range grouping** — Connected From/To on booking detail (deferred from Round 3)
- [ ] **Game-Day Readiness Score** — Aggregate metric per event (deferred from scheduling Slice 5)

---

## Pending Decisions

All pending decisions resolved — see `docs/DECISIONS.md` for D-026 (event sync cadence) and D-027 (venue mapping governance).

Remaining open question:
- **Cron frequency**: Resolved — daily 8AM is correct for Hobby plan (once/day limit). Sub-hourly requires Pro upgrade.

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
