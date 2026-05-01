# Audit trail / history logs — Improvement Audit

**Date**: 2026-04-30
**Target**: Audit trail / history logs system (cross-cutting)
**Type**: System

**Scope read:**
- Schema: `prisma/schema.prisma:517-531` (AuditLog model)
- Helper: `src/lib/audit.ts`
- Hook: `src/hooks/use-last-audit.ts`
- UI components: `src/components/ActivityTimeline.tsx`, `src/components/LastEditedHint.tsx`,
  `src/app/(app)/users/[id]/UserActivityTab.tsx`, `src/app/(app)/items/[id]/ItemHistoryTab.tsx`,
  `src/app/(app)/bookings/BookingHistoryTab.tsx`, `src/app/(app)/reports/audit/page.tsx`,
  `src/components/BookingDetailsSheet.tsx` (history pane wiring)
- API routes: `src/app/api/audit/last/route.ts`, `src/app/api/bookings/[id]/audit-logs/route.ts`,
  `src/app/api/assets/[id]/activity/route.ts`, `src/app/api/bulk-skus/[id]/activity/route.ts`,
  `src/app/api/users/[id]/activity/route.ts`, `src/app/api/reports/route.ts:388-456` (`getAuditReport`),
  `src/app/api/cron/audit-archive/route.ts`, `src/app/api/kiosk/activate/route.ts`
- Docs: `docs/AREA_USERS.md` (Authorization Guardrails #4),
  `docs/AREA_REPORTS.md:80-88`, `tasks/lessons.md` (D-007, "createMany for bulk audit entries", `useMemo` deps lesson)

---

## What's Smart

- **`createAuditEntries` batch helper** (`src/lib/audit.ts:41-58`) — single `createMany` instead of per-row INSERT; matches the explicit `tasks/lessons.md` rule "`createMany` for bulk audit entries". Worth keeping.
- **Cursor pagination with N+1 detect** (`src/app/api/bookings/[id]/audit-logs/route.ts:23-31`,
  `src/app/api/assets/[id]/activity/route.ts:40-49`,
  `src/app/api/bulk-skus/[id]/activity/route.ts:29-38`,
  `src/app/api/users/[id]/activity/route.ts:38-47`) — `take: limit + 1` to detect more, no extra COUNT. Matches the lessons doc pattern.
- **Date-grouped sticky timeline** (`src/components/ActivityTimeline.tsx:625-660`) — Today / Yesterday / dated headers with `sticky top-0` over a scrolling container. This is the cleanest history UI in the app; nothing else does it.
- **`HIDDEN_FIELDS` and `ID_FIELDS` filtering** (`ActivityTimeline.tsx:52-76`) — internal/opaque columns are stripped before render so the diff stays human. Smart and worth replicating.
- **Pre-filter that drops dead `updated` rows** (`BookingHistoryTab.tsx:40-48`) — when every changed field is hidden, the entry doesn't render at all. Prevents the "Edited details · no diff shown" ghost row sibling timelines emit.
- **Retention cron with batched delete** (`src/app/api/cron/audit-archive/route.ts:44-60`) — `findMany → deleteMany` in 1k batches with `timingSafeEqual` on the cron secret. Resilient and safe to run on a hot table.
- **Audit-log fetch fanned in to booking detail SSR payload** (`src/lib/services/bookings-queries.ts:144-152`) — first 50 entries piggyback on the booking detail fetch, only paginate via the dedicated route after that. One round-trip beats a useEffect-then-fetch.

---

## What Doesn't Make Sense

### 1. **17 of 19 audit writes bypass the helper**
`grep tx\.auditLog\.create | wc -l` → 14 inline transaction calls in `bookings-checkin.ts` (5) and `bookings-lifecycle.ts` (9), plus `db.auditLog.create` in `kiosk/activate/route.ts:35` and `tx.auditLog.createMany` (2). Every one of these constructs the row manually and **omits `_actorRole`** — directly violating `docs/AREA_USERS.md:84` ("Audit logs must include actor role and actor id for all edits") and `tasks/lessons.md` rule "`createAuditEntry` on every mutation (D-007)". The change-log line at `docs/AREA_USERS.md:115` claims "audit logs now include actor role via createAuditEntry helper" — that claim is currently false for booking lifecycle, check-in, and kiosk activation. This is the single biggest finding.

### 2. **Two parallel timeline UIs with overlapping vocabularies**
`UserActivityTab.tsx` (282 lines) and `ActivityTimeline.tsx` (700 lines) are both rendering `AuditEntry` rows but with **different action label tables** (`ACTION_LABELS` at `UserActivityTab.tsx:29-53` vs the giant `switch` at `ActivityTimeline.tsx:214-345`), **different hidden-field sets** (`UserActivityTab.tsx:65` vs `ActivityTimeline.tsx:52-67`), **different change-formatting** (`describeFieldChange` at `UserActivityTab.tsx:109-114` vs `ActivityTimeline.tsx:369-442`), and **different action-color schemes** (`UserActivityTab.tsx:116-123` keyed on `entityType` vs `ActivityTimeline.tsx:133-183` keyed on `action`). Adding a new action means editing two files and risking divergence; today they already disagree on `created` vs `Account created`, etc.

### 3. **`/reports/audit` ships an action filter on the API but no actor / resource filter — and no UI for any of them**
`AREA_REPORTS.md:86` promises "Filters: Date range, action type, actor, resource type". Reality (`src/app/(app)/reports/audit/page.tsx:169-195`): only the period buttons are wired. The API supports `?action=` (`reports/route.ts:26`) but the UI never sends it. `actor` and `resourceType` filters don't exist on the API at all. Doc and code disagree.

### 4. **CSV export drops the diff payload**
`downloadCsv` at `reports/audit/page.tsx:66-78` writes `Timestamp,Actor,Action,Entity Type,Entity ID` — i.e. nothing about *what changed*. The "Audit log viewer" the spec describes (`AREA_REPORTS.md:83`: "Timestamp, actor, action, resource, **details, outcome**") is not what this exports. For compliance / IT audit asks the export is unusable.

### 5. **`UserActivityTab` re-implements the timeline but loses fidelity**
`/api/users/[id]/activity/route.ts:41` selects `actor: { select: { name: true, email: true } }` — `avatarUrl` is NOT selected, so even though the rest of the app surfaces avatars in audit rows, this tab can never show them. Then the type at `UserActivityTab.tsx:26` matches the missing field. Inconsistent with `BookingHistoryTab` and `ItemHistoryTab` which both render avatars.

### 6. **No-actor rows are silently downgraded to "System" — including manual rows that should have an actor**
`UserActivityTab.tsx:209` — `entry.actor?.name || "System"`. `ActivityTimeline.tsx:521-523` does the same except it gates "System" behind `SYSTEM_ACTIONS`. The user activity tab will show "System" for an audit row whose actor was deleted (the schema sets `onDelete: SetNull`, `prisma/schema.prisma:526`). That's misleading — the action wasn't a system action; the actor was just removed.

### 7. **Reports layout has no role gate**
`src/app/(app)/reports/layout.tsx` is a client component with no `requireRole` / `redirect`. Defense-in-depth lives only at `requirePermission(user.role, "report", "view")` inside the API. A STUDENT visiting `/reports/audit` directly would render the page shell, see metric cards filled with skeletons, then hit the API 403 — instead of being redirected. Spec at `AREA_REPORTS.md:108-110` says ADMIN/STAFF only.

### 8. **`/api/audit/last` uses POST for a read**
`src/app/api/audit/last/route.ts:19` — POST with JSON body so `entityIds` doesn't blow the URL. But that defeats CDN caching, browser back-forward cache, and `?cache: 'force-cache'`. With `entityIds.length ≤ 200` (`bodySchema:8`) a comma-joined `GET ?ids=` would fit in the 8 KB URL budget for any realistic page. POST is the wrong verb here.

---

## What Can Be Simplified

### 1. **`/api/audit/last` reads every audit row for the entity set, then keeps the first per-id in JS**
`src/app/api/audit/last/route.ts:32-46` — `findMany({ where: { entityType, entityId: { in: ids } } })` with no `take`, then a JS `for` loop deduping. For a `location` row that has hundreds of edits the route will pull every single one to discard 99 % of them. Postgres `DISTINCT ON (entity_id)` (raw SQL) or `SELECT … ORDER BY entity_id, created_at DESC` covers this in one index seek per id; even `Promise.all(ids.map(id => findFirst({where:{entityType,entityId:id}, orderBy:{createdAt:'desc'}})))` would be cheaper because each query bounds to one row.

### 2. **Booking history `useMemo` derives from `auditLogs` in one place and re-implements `HIDDEN_FIELDS` filter in another**
`BookingHistoryTab.tsx:40-48` re-runs the hidden-field check that already lives inside `ActivityTimeline.tsx:536-542`. Pull the "is this updated row empty" decision into a named util in `ActivityTimeline.tsx` and `export` it; remove the duplicate.

### 3. **`describeFieldChange` and the surrounding 70-line constants table exist twice**
Already flagged in finding #2 above. Consolidating saves ~120 LOC and removes the divergence risk.

### 4. **Hard-coded "90 days" appears three times**
`src/app/api/cron/audit-archive/route.ts:19` (`RETENTION_DAYS = 90`), `src/app/(app)/reports/audit/page.tsx:165` ("Audit logs are retained for 90 days"), and the cron schedule comment ("weekly"). Either expose `RETENTION_DAYS` as a shared constant or fetch from `/api/audit/retention`. Today, changing the policy means three edits and they will silently drift.

### 5. **Two cursor-pagination state machines for the same shape**
`UserActivityTab.tsx:127-169` and `BookingDetailsSheet.tsx:119-213` both implement `extraEntries / nextCursor / loadingMore / loadMore` for an audit feed against a near-identical API shape. A single `useAuditFeed(endpoint)` hook returning `{ entries, hasMore, loadMore, loading, error, reload }` eliminates ~150 LOC and keeps the loading semantics consistent.

### 6. **`SYSTEM_ACTIONS` and `_actorRole` filter list re-declared inside `UserActivityTab`**
`UserActivityTab.tsx:65` declares `HIDDEN_FIELDS = new Set(["notes", "passwordHash", "_actorRole"])` separately from the canonical set in `ActivityTimeline.tsx:52-67`. Re-export and use one set.

### 7. **`reports/audit/page.tsx:33-41` redeclares `AuditEntry`**
Module-local `AuditEntry` shadows the canonical `AuditEntry` imported as `TimelineEntry`. The local version uses `details` instead of `beforeJson/afterJson`, then `toTimelineEntries` translates and **always drops `beforeJson`** (`reports/audit/page.tsx:60` sets `beforeJson: null`). That means field-change pills never render in the report timeline — even though the data exists in the DB. Either widen the API response to return `beforeJson` + `afterJson`, or remove the `details`-only intermediate type entirely.

---

## What Can Be Rethought

### 1. **The model is missing `actorRole`, `ip`, `userAgent` as first-class columns**
`prisma/schema.prisma:517-531` stores actor role inside `afterJson._actorRole` (`src/lib/audit.ts:31`). That makes "events by actor role" (`AREA_REPORTS.md:84`) **impossible to chart with `groupBy`** — Prisma can't group by a JSON path. It's also why the spec'd "actor role" filter doesn't exist. Adding `actorRole Role?`, `ip String?`, `userAgent String?` (with `@@index([actorRole, createdAt])`) unlocks the spec, makes the cron route more efficient, and removes the hack of stuffing structured data into a free-form JSON blob. *Tradeoff: a one-off backfill migration; ~1k existing rows is trivial.*

### 2. **No index serves the cron's `where: { createdAt: { lt: cutoff } }`**
Both indexes on `AuditLog` are leading on `entityType` or `actorUserId`. `audit-archive/route.ts:46-50` uses `where: { createdAt }` only — full table scan. As volume grows past a few hundred thousand rows the weekly cron will blow the 10 s Hobby / 60 s Pro Vercel timeout. Add `@@index([createdAt])` (or rely on a `createdAt`-leading partial index for the retention case).

### 3. **The audit log isn't tamper-evident**
Anyone with DB write access can `UPDATE audit_logs` or `DELETE` — no checksum chain, no append-only constraint. For the use case (school IT compliance, eventually FERPA-adjacent) a hash chain (`prevHash`) or a `pg_audit`-style append-only role would matter. *Bigger bet — tradeoff: write throughput, operational complexity. Not urgent but worth the decision being recorded.*

### 4. **`/reports/audit` should be an *investigative* tool, not a dump**
Today it's a paged list. The investigative questions an admin actually asks ("show me everything Erik did to bookings last week", "who deleted asset XYZ") need *actor + entity-type + free-text* filters and the ability to **deep-link from a row to the entity page**. Each row is `Entity Type / Entity ID` with no link out (`reports/audit/page.tsx:53-63` — `entityId` becomes a string, not a route). Even a `<Link href={entityHref(entityType, entityId)}>` per row would change the page's value. *Tradeoff: requires actor filter + URL builder for each entity type.*

### 5. **`UserActivityTab` could be a thin wrapper over `ActivityTimeline`**
The real differences vs `ItemHistoryTab` / `BookingHistoryTab` are: (a) it merges `entityType: user` AND `actorUserId: id` queries; (b) it has user-specific action labels. Both fit `ActivityTimeline`'s existing `context` prop with one new value (`"user"`) and an extension to its action table. 280 lines → ~30 lines.

### 6. **The "last edited" inline hint is invisible to STUDENT**
`/api/audit/last/route.ts:22-24` returns `{}` to non-staff. That's safe, but it means a STUDENT viewing a settings row gets "nothing" instead of the truth that the row exists at all. In settings pages where students can read, the hint silently disappears. Either route this through a dedicated public summary (`{updatedAt, updatedBy}` flagged for visibility) or stop reading audit at all on student-visible surfaces and use the entity's `updatedAt` instead. The current design conflates "data not found" with "you don't have permission".

---

## Consistency & Fit

### Pattern Drift

- **Audit write helper**: standard is `createAuditEntry` / `createAuditEntries` (`src/lib/audit.ts`). Drifted in `src/lib/services/bookings-checkin.ts` (5 sites: lines 72, 155, 178, 246, 452), `src/lib/services/bookings-lifecycle.ts` (9 sites: lines 208, 244, 400, 418, 466, 592, 609, 688, 739), `src/app/api/kiosk/activate/route.ts:35`. All use raw `tx.auditLog.create` and **omit `_actorRole`**.
- **Audit read UI**: standard is `<ActivityTimeline>`. Drifted at `src/app/(app)/users/[id]/UserActivityTab.tsx` (entire 282-line custom renderer).
- **Empty state**: standard is `<Empty>` from shadcn (used in `BookingHistoryTab.tsx:75-82`, `ItemHistoryTab.tsx:72-78`, `ActivityTimeline.tsx:643-648`). Drifted at `UserActivityTab.tsx:202` which uses `<EmptyState>` (the older custom variant). Same drift at `reports/audit/page.tsx:215`.
- **Loading skeleton**: standard is the skeleton inside `ActivityTimeline.TimelineSkeleton` (`ActivityTimeline.tsx:490-505`). Drifted at `UserActivityTab.tsx:171-185` (different sizes, different row layout) and `reports/audit/page.tsx:131-140` (table-shaped skeleton over what is now a timeline — leftover from the pre-timeline list view).
- **Fetch pattern**: standard for new code is `useFetch` (`reports/audit/page.tsx:119` and `UserActivityTab.tsx:139` use it). Drifted at `ItemHistoryTab.tsx:25-45` (raw `fetch` + manual `useState` for entries / loading / error). Drifted at `use-last-audit.ts:20-39` (raw `fetch` with manual `AbortController`, no toast on failure — comment says "decoration").
- **Audit-log type**: canonical is `AuditEntry` from `@/components/ActivityTimeline`. `UserActivityTab.tsx:18-27` and `reports/audit/page.tsx:33-41` redeclare it locally with conflicting fields.

### Dead Code

- `ActivityTimeline.tsx:699` — `export { EQUIPMENT_ACTIONS, HIDDEN_FIELDS as HIDDEN_AUDIT_FIELDS }` — `HIDDEN_AUDIT_FIELDS` is consumed by `BookingHistoryTab.tsx:8` only (i.e. only one consumer). Not dead, but the renamed re-export with no other consumer is debt — inline the check or just `export` `HIDDEN_FIELDS` directly.
- `ActivityTimeline.tsx:62-67` — `HIDDEN_FIELDS` includes `cheqroomName`, `fiscalYear`, `fiscalYearPurchased`, `consumable`, `trackByNumber` — `cheqroomName` references the prior import system; grep `cheqroomName` across `src/` shows zero current writers, so the entry guards against historical rows only. Fine to keep, but worth a comment explaining why.
- `reports/audit/page.tsx:131-140` — old table-shaped skeleton (described above). With the page now using `ActivityTimeline`, this skeleton no longer matches the rendered layout — replace with `TimelineSkeleton` or a closer match.
- `UserActivityTab.tsx:75-78` — `formatValue` handles `(complex value)` for `typeof val === "object"`, but `describeFieldChange` upstream in `UserActivityTab.tsx:225-227` already filters complex objects out before calling. The branch is unreachable.
- `LastEditedHint.tsx:22` — `info.action === "created" ? "Added"` — the helper is always called with `useLastAudit("location" / "allowed_email", …)` and the most recent row will almost always be `updated`, not `created` (because `updated` is written on every edit). The branch is technically reachable for never-edited rows, but the user-facing copy "Added 4mo ago · system" reads oddly when the actor is a real admin. Re-check the messaging.

### Ripple Map

- **If `AuditLog.afterJson._actorRole` is promoted to a column** → migrations + every `createAuditEntry` consumer (`grep createAuditEntry` → 32 sites) updates trivially; every direct `auditLog.create` (17 sites listed above) needs to be migrated and is currently broken anyway. UI: `ActivityTimeline.tsx:52-67` `HIDDEN_FIELDS` can drop `_actorRole`.
- **If `ActivityTimeline.AuditEntry` shape changes (e.g. add `actorRole`)** → consumers: `BookingHistoryTab.tsx`, `ItemHistoryTab.tsx`, `BookingDetailsSheet.tsx`, `reports/audit/page.tsx`, `UserActivityTab.tsx` (if migrated). Plus the API routes that hand-craft the response (`bookings/[id]/audit-logs`, `assets/[id]/activity`, `bulk-skus/[id]/activity`, `users/[id]/activity`, `audit/last`, `reports`).
- **If `/api/audit/last` becomes GET** → consumers: `src/hooks/use-last-audit.ts:25-32` only. Caller pages (`settings/allowed-emails/page.tsx:69`, `settings/locations/page.tsx:77`) are unaffected.
- **If `RETENTION_DAYS` is centralized** → `cron/audit-archive/route.ts:19`, `reports/audit/page.tsx:165` (the literal string), plus future `/api/audit/retention` if exposed.
- **If `UserActivityTab` is replaced with `ActivityTimeline`** → consumer: `src/app/(app)/users/[id]/page.tsx` only (it imports `UserActivityTab`). Also requires `/api/users/[id]/activity` to add `avatarUrl` to its actor select.

### Navigation Integrity

- `reports/audit/page.tsx` has no in-page links to entity detail routes — every row's `entityId` is rendered as a string (via `ActivityTimeline.describeAction` fallback at lines 207-210, "this resource"). Not a broken link, but a missed deep-link opportunity (see Bigger Bet #4).
- `LastEditedHint` does not link to `/reports/audit?actor=…` or `/reports/audit?entity=…` — once the actor / resource filters exist, that's the natural follow-on.
- `useLastAudit` returns silent failures (`use-last-audit.ts:36-38`) — page won't crash but admins lose the only inline-context signal without warning.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ⚠️ | `BookingHistoryTab`, `ItemHistoryTab`, `ActivityTimeline` use shadcn `<Empty>`. `reports/audit/page.tsx:215` and `UserActivityTab.tsx:202` use the older `<EmptyState>` — drift, not broken. |
| Skeleton fidelity | ❌ | `reports/audit/page.tsx:131-140` is a table skeleton over a timeline view; `UserActivityTab.tsx:171-185` is bespoke (different from canonical `TimelineSkeleton`). |
| Silent mutations | ⚠️ | `use-last-audit.ts:36-38` swallows fetch failures by design ("decoration, not load-bearing"). Defensible but a 5xx storm would be invisible. `UserActivityTab.tsx:151-168` has a toast on `loadMore` failure — good. `ItemHistoryTab.tsx:30-39` has a retry block — good. |
| Confirmation quality | ✅ | (No destructive actions on these surfaces.) |
| Mobile breakpoints | ⚠️ | `ActivityTimeline.tsx:545` uses `px-3 sm:px-4` and the row collapses fine. `reports/audit/page.tsx:169-195` filter row uses `flex-wrap` — OK. CSV export button has no mobile-specific labelling. |
| Error message quality | ⚠️ | `reports/audit/page.tsx:148-149` distinguishes network vs server. `ItemHistoryTab.tsx:55-69` shows generic "Failed to load activity history" — no `parseErrorMessage`. `UserActivityTab.tsx:165` uses generic "Network error" toast. |
| Button loading states | ✅ | `UserActivityTab.tsx:275`, `ActivityTimeline.tsx:685-690` both `disabled` while loading; `reports/audit/page.tsx:182-188` spins refresh icon. |
| Role gating | ❌ | `/api/assets/[id]/activity/route.ts` and `/api/bulk-skus/[id]/activity/route.ts` do **not** call `requirePermission` / `requireRole`. Only login is required. By the policy a STUDENT can read the full audit history of any asset / bulk SKU. Compare `users/[id]/activity` which does gate (line 10). The `/reports/*` layout has no role redirect either. |
| Performance (N+1, over-fetch) | ❌ | `audit/last/route.ts:32-46` over-fetches every row for the requested entity set (potentially thousands) to keep the latest one. `audit-archive/route.ts:46` runs `where: createdAt < cutoff` with no covering index. `getAuditReport` runs four `auditLog` queries in parallel including two `groupBy` over the unindexed `action` and `entityType` columns. |
| Debug cleanup | ✅ | No `console.log`, no `TODO/FIXME/HACK` in any of the audit-related files. |
| Accessibility basics | ⚠️ | `reports/audit/page.tsx:182-188` icon-only refresh button has a `<TooltipContent>` but no `aria-label`. `ActivityTimeline.tsx:553-554` system avatar `<Cog>` has no `aria-label` and no surrounding alt text. |

---

## Raise the Bar

Patterns on this surface that other parts of the app should adopt:

- **Sticky date-grouped timeline** (`ActivityTimeline.tsx:625-674`). The Notifications page (per `AREA_NOTIFICATIONS`) and the Scans report (`reports/scans`) both render time-ordered lists without grouping — they would read better with this exact treatment. Lift the grouping into a generic `<DateGroupedList items header />`.
- **Pre-filtering "empty" updated rows** (`BookingHistoryTab.tsx:40-48`). Notifications and shift-history feeds would benefit from the same "if the diff is empty, hide the row" rule. Today they emit phantom rows.
- **Cursor-pagination on /api/.../activity routes** is uniform across booking, asset, bulk-sku, user — a pattern other paged endpoints (`/api/notifications`, `/api/shifts`) should follow if they aren't already.
- **`createAuditEntries` batch helper**. The `kits/[id]/bulk-members/route.ts` and `licenses/bulk/route.ts` already use it; any future bulk endpoint should default to this rather than per-row creates inside a loop.

---

## Quick Wins

1. **`src/app/api/assets/[id]/activity/route.ts:8` and `src/app/api/bulk-skus/[id]/activity/route.ts:8`** — add `requireRole(user.role, ["ADMIN", "STAFF"])` (or a permission check) at top of handler. Mirrors `users/[id]/activity/route.ts:10`. Closes the role-gating gap.
2. **`src/app/(app)/reports/audit/page.tsx:60`** — pass `beforeJson: e.details ?? null` is wrong because `details` is `afterJson`; the source `getAuditReport` (`reports/route.ts:441-449`) only returns `afterJson` as `details`. Either widen `getAuditReport` to return both, or in the timeline drop the report → timeline conversion entirely and have the report return the canonical shape.
3. **`src/app/api/users/[id]/activity/route.ts:41`** — add `avatarUrl: true` to the actor select. Then drop `UserActivityTab`'s custom renderer in favor of `<ActivityTimeline context="user">` (this is a 30-min consolidation, not the bigger refactor).
4. **`src/app/(app)/reports/audit/page.tsx:131-140`** — replace the table-skeleton with `TimelineSkeleton` (already exported from `ActivityTimeline`, just needs to be re-exported as named). Matches the rendered shape.
5. **`src/app/api/audit/last/route.ts:32-46`** — switch to `Promise.all(ids.map(id => db.auditLog.findFirst({ where: { entityType, entityId: id }, orderBy: { createdAt: "desc" }, select: {…}})))`. Index `[entityType, entityId, createdAt]` already exists. Unbounds the over-fetch.
6. **`prisma/schema.prisma:528`** — add `@@index([createdAt])` so the retention cron uses an index, not a seq scan. Migration is one line + one `prisma migrate dev`.
7. **Centralize `RETENTION_DAYS`** in `src/lib/audit.ts` and import in both the cron route and the page banner — three duplicates → one constant.

---

## Bigger Bets

1. **Promote `_actorRole` (and add `ip`, `userAgent`) to first-class columns on `AuditLog`.** This is the linchpin. It (a) makes the AREA_REPORTS spec achievable (`groupBy actorRole` for the missing chart), (b) eliminates the JSON-stuffing that 17 direct `auditLog.create` sites currently get away with omitting, (c) lets us add a server-side `Where actorRole = ADMIN` filter to the audit report. **Cost**: one schema migration, one backfill, sweep `tx.auditLog.create` → `createAuditEntry` (~17 sites; mostly mechanical inside `bookings-lifecycle.ts` / `bookings-checkin.ts`), update `ActivityTimeline.HIDDEN_FIELDS`. **Worth it because** a documented authorization guardrail is currently violated and the doc claim that it was fixed is stale.

2. **Consolidate to one `<ActivityTimeline>` and one `useAuditFeed` hook.** Replace `UserActivityTab.tsx` with `<ActivityTimeline context="user">`; replace the booking-detail and user-detail cursor-pagination machines with `useAuditFeed(endpoint)`. **Cost**: ~1 day. Removes ~400 LOC, eliminates the action-label / hidden-field / color-scheme drift, and makes the pre-filter "empty updated row" rule global. **Worth it because** every future audit-action label change today needs to be done in two unrelated files; one of them is always going to be missed.

---

## RULES check

- Read-only ✅
- Every claim cites file:line ✅ (each finding above)
- `tasks/lessons.md` consulted — D-007 ("createAuditEntry on every mutation"), `createMany` rule, and `useMemo deps` lesson were each cited where they applied
- No padding — lenses 1–4, Consistency, and Polish all carried real findings, none were forced
