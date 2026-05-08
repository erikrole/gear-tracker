# API Hardening Audit — 2026-05-08

> Comprehensive sweep of all 182 routes under `src/app/api/**`.
> Builds on `tasks/owasp-api-audit.md` (2026-05-03) which closed the OWASP Top-10 access-control P0/P1s.
> This pass covers the next layer: TOCTOU windows, audit-log gaps, fault-tolerance, PII scope, and quality polish.

## Method

12 parallel Explore-agent sweeps, one per domain, plus one cross-cutting audit. Spot-checked every P0/P1 by reading the actual file before promoting it. **Two findings rejected** as fabricated/inaccurate (devices route wrapper, kit bulk-members DELETE).

Audit dimensions: auth wrapper, RBAC + ownership, CSRF, Zod validation, SERIALIZABLE on multi-write, audit log on mutations, pagination caps, rate limiting, fault tolerance (`Promise.allSettled`), cache headers, side-effect idempotency, PII scope.

## Domain coverage

| # | Domain | Routes | Status |
|---|---|---|---|
| 1 | Auth & Identity | 12 | ✓ |
| 2 | Assets / Items | 17 | ✓ |
| 3 | Bookings & Reservations | 13 | ✓ |
| 4 | Checkouts (scan/checkin) | 11 | ✓ |
| 5 | Kiosk | 17 | ✓ |
| 6 | Bulk Inventory | 9 | ✓ |
| 7 | Shifts & Schedule | 31 | ✓ |
| 8 | Calendar & Events | 11 | ✓ |
| 9 | Users & Org | 16 | ✓ |
| 10 | Reports / Audit / Dashboard | 12 | ✓ |
| 11 | Notifications & Cron | 8 | ✓ |
| 12 | Catalog & Misc | 25 | ✓ |
| — | Cross-cutting infrastructure | — | ✓ |

---

## P0 — Critical (fix immediately)

| # | File:line | Finding | Why it matters |
|---|---|---|---|
| ~~P0-1~~ | `src/app/api/profile/route.ts:64` | ~~Password change updates `passwordHash` but **does not invalidate sessions** (no `db.session.deleteMany`).~~ Fixed 2026-05-08: password hash update and session deletion now run in one transaction. | Regression: `tests/auth-hardening.test.ts`. |
| ~~P0-2~~ | `src/app/api/seed/route.ts` | ~~Production gate relies on `NODE_ENV === "production"`; needs belt-and-suspenders disable + IP allowlist + auth.~~ Fixed 2026-05-08: route is disabled unless `SEED_ENDPOINT_ENABLED=true`; production still requires ADMIN auth. | Regression covered by code review and safe route gating. |
| ~~P0-3~~ | `src/app/api/checkouts/[id]/admin-override/route.ts` | Correction 2026-05-08: false positive. `overrideSchema.reason` already has `.max(1000)`. | No code change needed. |

## P1 — High (next sprint)

### Authentication & sessions
- ~~`src/app/api/auth/reset-password/route.ts:18` — Token expiry checked outside transaction; race between `findUnique` and consume.~~ Fixed 2026-05-08: token lookup, conditional consume, password update, reset-token cleanup, and session invalidation now run inside a SERIALIZABLE transaction.
- ~~`src/app/api/users/[id]/reset-password/route.ts:40` — Admin-issued temp password returned in response body. Missing `forcePasswordChange` flag (also flagged in OWASP audit P2 — promote).~~ Fixed 2026-05-08: users now have `forcePasswordChange`, admin resets set it and invalidate sessions, self-service password changes clear it, and login/profile responses expose the flag for UI handling.

### Asset & bulk-inventory race conditions
- ~~`src/app/api/assets/[id]/retire/route.ts:14` — Read-then-update outside transaction (verified). No SERIALIZABLE; concurrent retire+maintenance toggle can race.~~ Fixed 2026-05-08: read, status update, and audit row now run in one SERIALIZABLE transaction with `createAuditEntryTx`.
- ~~`src/app/api/assets/[id]/favorite/route.ts` — Missing `requirePermission` call — any authenticated user can favorite any asset.~~ Fixed 2026-05-08: route now checks explicit `asset.favorite` permission and verifies the asset exists before toggling the favorite row.
- ~~`src/app/api/assets/import/route.ts:660` — `createMany({ skipDuplicates: true })` masks `assetTag`/QR conflicts; users get no conflict feedback.~~ Fixed 2026-05-08: import now detects duplicate asset tags/tracking codes inside the upload before create, reports line-level errors, and no longer uses `skipDuplicates` for asset creates.
- ~~`src/app/api/bulk-skus/[id]/adjust/route.ts:30` — Quantity guard checks `next < 0` but no upper bound; `MAX_SAFE_INTEGER` overflow possible.~~ Fixed 2026-05-08: adjustment payloads are bounded and the resulting on-hand quantity cannot exceed 1,000,000.
- ~~`src/app/api/bulk-skus/[id]/units/[unitNumber]/route.ts:23` — Status check outside SERIALIZABLE; CHECKED_OUT→LOST race.~~ Corrected 2026-05-08: current route already performs the unit read, checked-out guard, status update, and balance adjustment inside a SERIALIZABLE transaction.

### Booking & reservation flows
- ~~`src/app/api/reservations/[id]/convert/route.ts:34` — Status re-check happens outside the `db.$transaction()`; concurrent cancel between read and conversion not blocked.~~ Corrected 2026-05-08: `createBooking({ sourceReservationId })` re-loads and validates the source reservation inside its SERIALIZABLE transaction before cancelling it.
- ~~`src/app/api/reservations/[id]/duplicate/route.ts:48` — No terminal-status guard; CANCELLED/COMPLETED reservations duplicable.~~ Fixed 2026-05-08: route now performs a post-load BOOKED status guard before creating the duplicate; existing `requireBookingAction()` also blocks terminal states up front.
- ~~`src/app/api/bookings/[id]/audit-logs/route.ts:20` — Cursor pagination has no bound on offset depth; large skip = slow query.~~ Fixed 2026-05-08: route uses cursor pagination and now validates any cursor belongs to the requested booking before querying the next page.

### Fault tolerance (Promise.all → Promise.allSettled)
- ~~`src/app/api/dashboard/route.ts:141` & `:310` — 11 parallel queries, **any one failure crashes the whole dashboard** (verified).~~ Fixed 2026-05-08 with `Promise.allSettled`, empty fallbacks, server logging, and `partialFailures` response metadata.
- ~~`src/app/api/inventory-hygiene/route.ts:80` — 14 parallel queries, same pattern.~~ Fixed 2026-05-08 with partial-failure issue count/list fallbacks.
- ~~`src/app/api/dashboard/stats/route.ts:36` — Same.~~ Fixed 2026-05-08.
- ~~`src/app/api/items-page-init/route.ts:11` — Reference data; lower impact but same pattern.~~ Fixed 2026-05-08.
- Lessons learned (Data Integrity §3): "`Promise.allSettled` for read-only parallel queries" is project doctrine.

### Reports / audit
- ~~`src/app/api/reports/checkouts/route.ts:10` — `days` param has no upper bound; attacker can request 999999 → multi-year aggregate → timeout.~~ Fixed 2026-05-08: checkout reports now reject `days` outside 1-366 before calling the report service.

### Public/unauth endpoints
- ~~`src/app/api/shifts/ics/[token]/route.ts` — No rate limiting; no pagination on `findMany()` so large rosters can build unbounded ICS files.~~ Fixed 2026-05-08: malformed tokens fail closed, feeds are rate-limited by IP and token, inactive users do not serve feeds, and assignment reads are capped to 500 rows inside a rolling one-month-past/one-year-future window.
- ~~`src/app/api/kiosk/scan-lookup/route.ts` — No rate limit on item enumeration via repeated bad scans.~~ Fixed 2026-05-08: scan lookup now applies per-kiosk minute and hour limits before item lookup.
- ~~`src/app/api/kiosk/activate/route.ts` — Rate limit exists but at 10 req/15min still allows 10.4 days to brute-force a 6-digit code; needs exponential backoff or per-device lockout.~~ Fixed 2026-05-08: activation now uses a tighter IP limit plus a per-code hourly bucket after hashing the submitted code.

### Notification spam vectors
- ~~`src/app/api/notifications/nudge/route.ts:23` — Per-actor rate limit only; attacker can fan out to 1200 different assignment IDs/hour.~~ Fixed 2026-05-08: route now validates active future assignments and layers actor minute/hour, assignment, and recipient rate limits.
- ~~`src/app/api/calendar-sources/[id]/sync/route.ts` — No concurrency guard; two concurrent syncs can double-create shift groups.~~ Fixed 2026-05-08: manual sync now acquires a database-backed source lease, rejects concurrent syncs with 409, and releases the lease after sync/shift-generation completion.
- ~~`src/app/api/shift-groups/[id]/regenerate/route.ts` — Mass-destructive op; no dry-run, no audit log of how many shifts were wiped.~~ Corrected 2026-05-08: regenerate only adds missing template shifts, skips manually edited groups, does not wipe existing shifts, and already writes `shift_group_regenerated` with the `added` count.
- ~~`src/app/api/shift-assignments/[id]/attendance/route.ts` — PATCH modifies attendance with **no audit log entry** (D-007 violation).~~ Fixed 2026-05-08 with before/after attendance audit metadata.

### PII / authorization scope
- ~~`src/app/api/users/export/route.ts:128` — STAFF can export full `athleticsEmail`/phone for ADMIN/STAFF rows; no role-based field filtering.~~ Fixed 2026-05-08: STAFF exports redact staff/admin athletics email and phone values while ADMIN exports remain complete.
- ~~`src/app/api/users/org-chart/route.ts:29` — STUDENT receives full `directReportId/directReportName` chain (reporting hierarchy leak).~~ Fixed 2026-05-08: org-chart API and nav entry are STAFF/ADMIN-only.
- ~~`src/app/api/calendar-events/[id]/travel/route.ts:32` — STUDENT can list all event travel members without ownership check on the event.~~ Corrected 2026-05-08: invalid read-access finding. Students may see staffing/travel roster context for all events; route now checks event existence before listing members.
- ~~`src/app/api/calendar-events/[id]/travel/[memberId]/route.ts:13` — DELETE has no per-event ownership check.~~ Fixed 2026-05-08: regression coverage now proves STUDENT cannot delete travel members; existing route also verifies the member belongs to the requested event before deleting.
- ~~`src/app/api/form-options/route.ts:5` — Returns name/email/avatar for ALL active users to any authenticated caller; staff-directory leak to STUDENT.~~ Fixed 2026-05-08: email was removed from the payload and STUDENT callers only receive their own user option.

### Audit-log gaps on mutations
- ~~`src/app/api/calendar-events/route.ts:82` — POST creates event; no `createAuditEntry`.~~ Fixed 2026-05-08.
- ~~`src/app/api/calendar-events/[id]/visibility/route.ts:19` — PATCH `isHidden` flag; no audit.~~ Fixed 2026-05-08 with before/after visibility metadata.
- ~~`src/app/api/shift-groups/[id]/shifts/[shiftId]/route.ts:60` — `?force=true` deletion bypasses guard but doesn't record `force` in audit.~~ Fixed 2026-05-08 by recording `force` and active assignment count in the existing audit row.

### XSS / content sanitization
- ~~`src/app/api/guides/[id]/route.ts` — Guide body stored without HTML sanitization. STAFF can post `<script>` payload that renders in viewers.~~ Fixed 2026-05-08: guide create/update sanitizes stored BlockNote JSON strings recursively and drops prototype-pollution keys.

### Validation gaps
- Correction 2026-05-08: `src/app/api/licenses/[id]/claim/route.ts:10` delegates to `claimCode()`, which already uses a SERIALIZABLE transaction with retry. No current P1 from the audit wording.

### Missed by original audit
- ~~`src/lib/permissions.ts` — `shift.manage` was called by shift-group and event-travel mutation routes but was missing from `PERMISSIONS.shift`, causing those routes to throw "No permission defined" before authorization could complete.~~ Fixed 2026-05-08 with STAFF/ADMIN `shift.manage` and RBAC regression tests.

## P2 — Medium

### Asset & inventory
- ~~`src/app/api/assets/bulk/route.ts:180` — Bulk maintenance toggle outside SERIALIZABLE.~~ Fixed 2026-05-08: maintenance toggles now re-read current asset statuses, write status changes, and create audit rows inside one SERIALIZABLE transaction.
- ~~`src/app/api/assets/export/route.ts` — No rate limit; CSV regen DoS vector.~~ Fixed 2026-05-08: item export now rate-limits per actor and uses shared formula-safe CSV escaping.
- ~~`src/app/api/assets/picker-search/route.ts:80` — No `Math.min(limit, MAX)` cap.~~ Fixed 2026-05-08: equipment picker route applies a local 100-row cap after shared pagination parsing.
- ~~`src/app/api/assets/[id]/image/route.ts:99` — External `fetch(downloadUrl)` lacks explicit timeout.~~ Fixed 2026-05-08: route now passes an explicit 5s timeout to the blob mirroring helper.
- ~~`src/app/api/bulk-skus/route.ts:26` — `balances` N+1 on paginated list.~~ Corrected 2026-05-08: current route loads balances through the `bulkSku.findMany({ include: { balances: true } })` query rather than issuing per-row balance queries.
- ~~`src/app/api/bulk-skus/[id]/activity/route.ts:27` — Cursor not validated to belong to this SKU; cross-entity log leak.~~ Fixed 2026-05-08: activity cursors are validated against the requested SKU/unit audit scope before pagination.

### Booking & checkout
- ~~`src/app/api/bookings/route.ts:89` — Search `mode: insensitive` on `title/refNumber/requester.name` without verified DB indexes.~~ Fixed 2026-05-08: migration `0054_booking_search_trigram_indexes` adds trigram GIN indexes for booking title/ref number and user name search.
- ~~`src/app/api/bookings/[id]/route.ts:40` — `If-Unmodified-Since` is opt-in; clients omitting it bypass conflict detection.~~ Fixed 2026-05-08: booking edits now require `If-Unmodified-Since`, reject stale snapshots, and tolerate HTTP-date second precision.
- ~~`src/app/api/checkouts/[id]/checkin-report/route.ts:104` — No 5-second dedup window on damage reports.~~ Fixed 2026-05-08: repeated report writes for the same booking item are rejected inside a five-second window.
- ~~`src/app/api/checkouts/[id]/checkin-report/route.ts:43` — Image upload outside transaction; orphan blobs on failure.~~ Fixed 2026-05-08: newly uploaded report images are deleted if report persistence fails.

### Kiosk
- ~~`src/app/api/kiosk/heartbeat/route.ts` — Silent session refresh, no audit; cap to 1/min/device.~~ Fixed 2026-05-08: heartbeat is capped to 1/min/device.
- ~~`src/app/api/kiosk/student/[userId]/route.ts:19` — PII exposure scope; needs per-IP rate limit.~~ Fixed 2026-05-08: student lookup now has per-kiosk/IP and per-student lookup rate limits.
- ~~Kiosk session length 30 days — flagged in OWASP for review.~~ Fixed 2026-05-08: kiosk device sessions now expire after 7 days.

### Reports & dashboard
- ~~`src/app/api/reports/audit/route.ts:12` & `reports/scans/route.ts:9` — Reinventing pagination instead of `parsePagination()`.~~ Fixed 2026-05-08: both report routes use shared pagination parsing.
- ~~`src/app/api/dashboard/stats/route.ts:7` — 60 req/60s rate limit too tight for 30s mobile poll cadence.~~ Fixed 2026-05-08: stats polling allowance increased to 180/min/user.
- ~~`src/app/api/audit/last/route.ts:38` — POST entity-bulk lookup unrate-limited; STAFF can spam with 200 entityIds × N requests.~~ Fixed 2026-05-08: audit last-lookup now rate-limits by actor.

### Users
- ~~`src/app/api/users/[id]/availability/route.ts` — No rate limit on POST; per-user spam vector for blocks.~~ Fixed 2026-05-08: availability block creation uses the shared settings mutation limiter.
- ~~`src/app/api/users/[id]/avatar/route.ts:21` — Per-user limit only; no global throttle for coordinated attacks.~~ Fixed 2026-05-08: avatar uploads now layer IP and actor throttles.
- ~~`src/app/api/users/[id]/route.ts:128` — Deactivation cascade doesn't enumerate all user references (e.g., directReportId).~~ Fixed 2026-05-08: deactivation clears users who directly reported to the deactivated user inside the same SERIALIZABLE transaction.
- ~~`src/app/api/users/[id]/activity/route.ts:30` — Cursor never expires; replay risk on stale data.~~ Fixed 2026-05-08: user activity cursors must belong to the requested user activity scope.

### Calendar / events
- ~~`src/app/api/calendar/route.ts:6` — Unbounded query on booking calendar (no `take`).~~ Fixed 2026-05-08: calendar range is validated, capped to 366 days, and limited to 500 bookings.
- ~~`src/app/api/calendar-events/[id]/command-center/route.ts:5` — No timeout guard on heavy compute.~~ Fixed 2026-05-08: command-center reads now rate-limit by actor and cap booking fan-in to 500 rows.
- ~~`src/app/api/calendar-sources/route.ts:14` — Unbounded list.~~ Fixed 2026-05-08: source listing is capped at 100 rows.

### Shifts
- ~~`src/app/api/shift-groups/[id]/shifts/route.ts:23` — `db.$transaction()` without explicit `Serializable` isolation.~~ Fixed 2026-05-08: manual shift creation now runs with explicit Serializable isolation.
- ~~`src/app/api/shift-groups/[id]/auto-assign/route.ts` — Compute-heavy; no rate limit; risk of 10s timeout.~~ Fixed 2026-05-08: auto-assign is capped to 10/min/actor.
- ~~`src/app/api/sport-configs/group/route.ts:20` — Comment claims "all or none" atomicity; no visible `$transaction` wrapper.~~ Corrected 2026-05-08: `upsertSportConfigsForGroup()` already wraps the full grouped patch in one Serializable transaction.

### Catalog & licenses
- ~~`src/app/api/licenses/[id]/history/route.ts` & `licenses/my/history/route.ts` — Unbounded result sets.~~ Fixed 2026-05-08: license history endpoints now apply bounded pagination.
- ~~`src/app/api/licenses/export/route.ts:36` — CSV injection via `=`/`+`/`-`/`@` prefix in `name` / `occupantLabel`.~~ Fixed 2026-05-08: license and user exports now use shared formula-safe CSV field escaping.
- ~~`src/app/api/guides/upload-image/route.ts` — Filename `Date.now()-${file.name}` not sanitized.~~ Fixed 2026-05-08: uploaded guide image filenames are reduced to a sanitized leaf name before blob storage.

### Notifications & cron
- ~~`src/app/api/cron/notifications/route.ts:28` — Bearer token compared with `===`; other 3 cron routes use `safeCompare`. Drift.~~ Fixed 2026-05-08: all cron routes now use shared `withCron()` bearer validation with timing-safe comparison.
- ~~`src/app/api/cron/morning-refresh/route.ts:32` — Uses `Promise.all`; one cron failure tanks the whole job.~~ Corrected 2026-05-08: current code processes sources in a per-source try/catch and records individual source errors.
- ~~`src/app/api/cron/audit-archive/route.ts:45` — Batch delete loop has no idempotency marker; mid-run cron retry double-deletes.~~ Corrected 2026-05-08: current delete loop selects IDs then `deleteMany`s by those IDs, making retries bounded by the retention cutoff; no duplicate side-effect beyond continued retention cleanup was reproduced.
- ~~`src/app/api/notifications/count/route.ts` — High-frequency poll endpoint; no rate limit / cache header.~~ Fixed 2026-05-08: notification count polling is rate-limited and uses short private caching.

### Allowed-emails
- ~~`src/app/api/allowed-emails/route.ts:95` — POST returns 409 on already-claimed email → enumeration vector.~~ Fixed 2026-05-08: single adds return generic skipped success for registered/duplicate emails and bulk adds return skipped counts only.
- ~~`src/app/api/allowed-emails/route.ts:64` — `bulkAdd` accepts unbounded array; need size cap.~~ Corrected 2026-05-08: current `createAllowedEmailBulkSchema` caps bulk adds at 50 entries.

## P3 — Polish

- ~~`src/app/api/assets/brands/route.ts` — Stable reference data; should use `cachedOk()`.~~ Fixed 2026-05-08.
- ~~`src/app/api/bulk-skus/batteries/route.ts` — Hot read on booking creation; `cachedOk()` candidate.~~ Fixed 2026-05-08.
- ~~`src/app/api/bulk-skus/batteries/route.ts:90` — `isBatterySku` substring match catches "chatter"; use word-boundary or category lookup.~~ Fixed 2026-05-08 with term-boundary matching.
- ~~`src/app/api/assets/[id]/activity/route.ts:10` — Uses `requireRole([ADMIN, STAFF])` instead of `requirePermission(role, "asset", "audit")`. Pattern drift.~~ Fixed 2026-05-08 with `asset.audit` permission.
- ~~`src/app/api/bookings/[id]/nudge/route.ts:17` — Overdue check uses `<` not `<=`; boundary off-by-one.~~ Fixed 2026-05-08.
- ~~`src/app/api/bookings/[id]/route.ts:52` — Audit before-snapshot only includes changed fields; should snapshot full state.~~ Fixed 2026-05-08.
- ~~`src/app/api/categories/[id]/route.ts:37` — Circular-parent check has no depth cap.~~ Fixed 2026-05-08 with a bounded parent-chain walk.
- ~~`src/app/api/settings/escalation/route.ts:54` & `settings/extend-presets/route.ts:58` — Audit `before` undefined on initial create; complete the diff.~~ Fixed 2026-05-08.
- ~~`src/app/api/shifts/ics-token/route.ts:20` — Rotation has no rate limit; user can churn tokens.~~ Fixed 2026-05-08.
- ~~`src/app/api/drafts/route.ts` — No auto-expiry on stale drafts (links to GAP-33-style cleanup).~~ Fixed 2026-05-08: draft listing prunes user-owned drafts older than 30 days and only returns fresh drafts.

## Cross-cutting infrastructure findings

### Confirmed clean
- ✓ `withAuth` / `withKiosk` / `withHandler` shape correct; CSRF Origin check on every mutation.
- ✓ `fail()` handles `ZodError` → 400, `P2034` → 409, `HttpError` passthrough, else 500 + Sentry.
- ✓ `ok()` defaults to `Cache-Control: private, no-store`.
- ✓ CSP nonce-based, COOP/CORP set, no-store on auth pages (recent fix `12bbf811`).
- ✓ Cron token compared via `safeCompare` in 3 of 4 routes (drift in #4 is a P2 finding).
- ✓ No `$queryRawUnsafe` outside `db-diagnostics` static strings.

### Patterns worth a project-level fix (rather than per-route)
- **`Promise.allSettled` doctrine not applied to dashboard endpoints** — 4 endpoints use `Promise.all`. Single-pass fix.
- **In-memory rate limit per serverless instance** — already tracked as GAP-32; getting close to needing Upstash.
- **Audit-log enforcement** — several PATCH routes (`shift-attendance`, `event-create`, `event-visibility`, `force-delete-shift`) skip `createAuditEntry`. Consider lint rule or wrapper.
- ~~**Cron auth wrapper** — extract `withCron()` to unify Bearer token checks (fixes the `safeCompare` drift).~~ Fixed 2026-05-08.
- **CSV escaping helper** — apply consistently; `licenses/export` shows the gap.

## Rejected / not-an-issue

- **Devices route uses `withHandler`** — false; `src/app/api/devices/route.ts:12,35` uses `withAuth`.
- **Kit bulk-members IDOR** — needs verification; agent claim was vague. Move to follow-up if reproduced.
- **Cross-cutting agent's stat counts** — "39 mutations missing audit logging," "79 GETs unbounded" appear inflated; treat counts as rough estimates pending lint-rule pass.

## Recommended sequencing

**Wave 1 (this week)** — P0 + the 4 `Promise.allSettled` swaps + the no-audit-log mutations. Single PR per domain, all under the 13-edit-discipline rules.

**Wave 2 (next sprint)** — P1 PII/scope (users export, org-chart, form-options leak) + license claim TOCTOU + nudge spam scope + reservations convert/duplicate guards.

**Wave 3 (hardening sprint)** — P2 batch + the cross-cutting `withCron()` extraction + Upstash rate-limit migration (resolves GAP-32).

**Wave 4 (polish)** — P3 list when there's bandwidth.

## Acceptance criteria

- All P0 fixes ship with audit-log assertion tests.
- All P1 finds either ship or get a documented `GAP-` entry in `docs/GAPS_AND_RISKS.md`.
- `tasks/owasp-api-audit.md` updated with the gap closures from this pass.
- Pattern fixes (`Promise.allSettled`, audit-log lint, `withCron`) get their own brief in `docs/`.
