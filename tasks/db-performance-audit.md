# Database Performance Audit

*Generated: 2026-03-27*

## Executive Summary

The gear-tracker codebase has **solid foundations** (SERIALIZABLE on most booking mutations, parallelized queries on key endpoints, proper singleton PrismaClient) but suffers from three systemic issues: **(1)** audit log and bulk stock operations use per-item INSERT loops instead of batched writes, **(2)** the dashboard fires 17-18 queries per load, and **(3)** several critical mutations (`markCheckoutCompleted`, `recordScan`, scan completion) are missing SERIALIZABLE isolation, creating race conditions that also degrade performance under contention. Additionally, 13 missing database indexes were identified that affect the highest-traffic query patterns.

---

## Critical Issues (Fix Before Scale)

### 1. `markCheckoutCompleted` Missing SERIALIZABLE
**File:** `src/lib/services/bookings.ts:667`
**Risk:** Uses default READ COMMITTED for a mutation that updates booking status, deactivates allocations, and returns bulk stock. Two concurrent check-in completions could double-return inventory.
**Fix:** Add `isolationLevel: Prisma.TransactionIsolationLevel.Serializable` to the `$transaction` call.

### 2. `recordScan` Serialized Path — No Transaction At All
**File:** `src/lib/services/scans.ts:56-131`
**Risk:** Dedup check, booking validation, and scan event creation are 3-4 separate queries with no transaction wrapping. Concurrent identical scans can both pass the dedup window.
**Fix:** Wrap the serialized scan path in a SERIALIZABLE transaction.

### 3. `completeCheckoutScan` / `completeCheckinScan` — No Transaction
**File:** `src/lib/services/scans.ts:392-467`
**Risk:** Multi-step completion logic (state check + session close + potential booking completion) with no transaction. Two concurrent complete calls can both succeed.
**Fix:** Wrap in a transaction. `completeCheckinScan` compounds the risk by calling `markCheckoutCompleted` (which itself lacks SERIALIZABLE).

### 4. `recordScan` Numbered Bulk Path — Missing SERIALIZABLE
**File:** `src/lib/services/scans.ts:164`
**Risk:** Transaction exists but uses READ COMMITTED. Unit status changes and allocation creation could race.
**Fix:** Add SERIALIZABLE isolation level.

### 5. Dashboard Fires 17-18 Queries Per Load
**File:** `src/app/api/dashboard/route.ts:110-349`
**Impact:** Each dashboard load opens 17 concurrent connections to Neon. On serverless Postgres, this is expensive and may hit connection limits under moderate concurrency.
**Fix:** Consolidate counts into a single raw SQL query with conditional aggregation. Consider caching stats with short TTL.

---

## N+1 Query Patterns Found

### CRITICAL

| # | File | Lines | Pattern | Fix |
|---|------|-------|---------|-----|
| N1 | `src/app/api/assets/bulk/route.ts` | 55-145 | `createAuditEntry` called inside `for` loops — up to 50 individual INSERTs per request | Use `db.auditLog.createMany()` |
| N2 | `src/lib/services/notifications.ts` | 94-195 | `notification.create` inside nested loops (checkout x rule x admin). Pre-fetches ALL notifications with `startsWith: ""` (line 63) | Use `createMany`. Replace `startsWith: ""` with targeted dedupeKey prefix filter |
| N3 | `src/app/api/form-options/route.ts` | 18 | `db.asset.findMany` fetches ALL non-retired assets with no pagination, then derives statuses | Add pagination or search-on-type pattern |
| N4 | `src/lib/services/bookings.ts` | 233-291 | `upsertBulkBalancesAndMovements`: `findUnique` + `upsert` + `create` = 3 queries per bulk item, in a loop. Called from 4+ code paths | Pre-fetch all balances in one query, compute in memory, batch write |

### HIGH

| # | File | Lines | Pattern | Fix |
|---|------|-------|---------|-----|
| N5 | `src/app/api/assets/import/route.ts` | 519-635 | Individual `asset.update` calls in loops for tag assignment and image URLs | Batch with `updateMany` or collect into single transaction |
| N6 | `src/lib/services/calendar-sync.ts` | 535-538 | `calendarEvent.update` per event in sync loop — hundreds of UPDATEs for large ICS feeds | Group similar updates, use `updateMany` or raw SQL batch |
| N7 | `src/lib/services/bookings.ts` | 604-615, 864-875 | `auditLog.create` in `for` loop over equipment change entries in `updateReservation`/`updateCheckout` | Use `auditLog.createMany` |
| N8 | `src/app/api/bookings/[id]/route.ts` | 27, 81 | `getBookingDetail` called twice in PATCH — once to validate, once to return result | Use lighter validation query for first call |

### MEDIUM

| # | File | Lines | Pattern | Fix |
|---|------|-------|---------|-----|
| N9 | `src/app/api/bulk-skus/route.ts` | 12 | `findMany` without pagination, includes `units: true` | Add `take`/`skip` pagination |
| N10 | `src/app/api/calendar/route.ts` | 33 | `findMany` without `take` limit | Add reasonable `take` limit or enforce max date range |
| N11 | `src/lib/services/shift-generation.ts` | 186-192 | `shiftGroup.create` in loop (can't use `createMany` since IDs needed) | Use raw SQL `INSERT ... RETURNING id` |
| N12 | `src/lib/services/bookings.ts` | 44 | `bookingInclude` uses `asset: true` — fetches ALL asset columns for every serialized item | Replace with `asset: { select: { id, assetTag, productName, status, imageUrl } }` |
| N13 | `src/lib/services/shift-trades.ts` | 231-283 | `listTrades` uses 4-level deep nested includes | Add `select` at each level |
| N14 | `src/lib/services/calendar-sync.ts` | 574-583 | `syncAllCalendarSources` processes sources sequentially | Use `Promise.allSettled` with concurrency limit |

---

## Missing Indexes

### CRITICAL

| # | Query Pattern | File(s) | Suggested Index |
|---|--------------|---------|-----------------|
| M1 | `Booking WHERE kind + status + requesterUserId ORDER BY endsAt` | `api/dashboard/route.ts` (15+ queries) | `@@index([kind, status, requesterUserId, endsAt])` on **Booking** |
| M2 | `Booking WHERE kind + status + endsAt` (overdue detection) | `api/dashboard/route.ts`, `services/notifications.ts` | `@@index([kind, status, endsAt])` on **Booking** |

### HIGH

| # | Query Pattern | File(s) | Suggested Index |
|---|--------------|---------|-----------------|
| M4 | `Booking WHERE startsAt < ? AND endsAt > ?` (calendar overlap, no locationId) | `api/calendar/route.ts` | `@@index([startsAt, endsAt])` on **Booking** |
| M5 | `AssetAllocation WHERE assetId + active + date range overlap` | `services/availability.ts`, `services/status.ts` | `@@index([assetId, active, startsAt, endsAt])` on **AssetAllocation** |
| M6 | `Asset WHERE status` (5 count queries per page load) | `api/assets/route.ts` | `@@index([status])` on **Asset** |

### MEDIUM

| # | Query Pattern | File(s) | Suggested Index |
|---|--------------|---------|-----------------|
| M3 | `Booking WHERE createdBy + status` (drafts) | `api/drafts/route.ts` | `@@index([createdBy, status])` on **Booking** |
| M7 | Text search via `ILIKE '%q%'` on asset name/brand/model/tag | `api/assets/route.ts` | `pg_trgm` GIN index via raw migration |
| M10 | `CalendarEvent WHERE sportCode + status + startsAt` | `services/event-defaults.ts` | `@@index([sportCode, status, startsAt])` on **CalendarEvent** |
| M13 | `ScanEvent WHERE bookingId + scanValue + phase + createdAt` (dedup) | `services/scans.ts` | `@@index([bookingId, scanValue, phase, createdAt])` on **ScanEvent** |
| M15 | `Booking WHERE requesterUserId + eventId` (shift gear) | `api/dashboard/route.ts` | `@@index([requesterUserId, eventId])` on **Booking** |

### LOW

| # | Query Pattern | Suggested Index |
|---|--------------|-----------------|
| M8 | Booking text search (`ILIKE` on title) | `pg_trgm` GIN index on `booking.title` |
| M9 | `Kit WHERE locationId` | `@@index([locationId])` on **Kit** |
| M12 | `ShiftTrade WHERE shiftAssignmentId + status` | `@@index([shiftAssignmentId, status])` on **ShiftTrade** |
| M14 | `User WHERE role` | `@@index([role])` on **User** |

### Redundant Index (Remove)

| Index | Reason |
|-------|--------|
| `Asset @@index([primaryScanCode])` | `primaryScanCode` has `@unique` which already creates an index |

---

## Hot Path Analysis

| Endpoint | Queries/Request | Verdict | Notes |
|----------|----------------|---------|-------|
| **Dashboard** (`GET /api/dashboard`) | **17-18** | FIX | 17 parallel queries in `Promise.all` + 1 conditional. Consolidate counts into raw SQL. |
| **Assets list** (`GET /api/assets`) | **10** (5 rounds) | FIX | 5 status-breakdown counts should be a single `groupBy`. Sequential enrichment rounds could parallelize. |
| **Scan submission** (`POST .../scan`) | 3-10 | OK-ISH | Serialized path (most common) is 3-4 queries. Numbered bulk is 8-10. |
| **Availability check** (`POST /api/availability/check`) | 3 | GOOD | Parallelized via `Promise.all`. |
| **Booking list** (`GET /api/checkouts`) | 2 | GOOD | `findMany` + `count` in parallel. |
| **Items page init** (`GET /api/items-page-init`) | 4 | GOOD | 4 parallel reference data queries. |

---

## Transaction Safety Summary

### Mutations WITH SERIALIZABLE (correct)

- `createBooking`, `updateReservation`, `cancelReservation`, `updateCheckout`, `extendBooking`, `cancelBooking`, `checkinItems`, `checkinBulkItem`, `bulk-skus/adjust`

### Mutations MISSING SERIALIZABLE (fix required)

| Mutation | File:Line | Risk |
|----------|-----------|------|
| `markCheckoutCompleted` | `bookings.ts:667` | Double-return of bulk stock |
| `recordScan` numbered bulk | `scans.ts:164` | Unit status corruption |
| `claimTrade` | `shift-trades.ts:72` | Double-claim of trade |
| `completeCheckoutScan` | `scans.ts:392` | Not transactional at all |
| `completeCheckinScan` | `scans.ts:436` | Not transactional at all |

### TOCTOU Patterns (read-then-write outside transactions)

| File:Line | Pattern | Severity |
|-----------|---------|----------|
| `scans.ts:56-131` | Full serialized scan flow outside transaction | HIGH |
| `scans.ts:392-467` | Scan completion state check then session close | HIGH |
| `assets/[id]/maintenance/route.ts:11-17` | Status toggle reads then writes | MEDIUM |
| `assets/[id]/route.ts:213-222` | QR uniqueness check then update | MEDIUM |
| `assets/[id]/route.ts:262-278` | Delete with count check then delete | MEDIUM |
| `drafts/route.ts:75-82` | Draft existence check outside tx | MEDIUM |

---

## Prisma Client Setup

| Aspect | Status | Notes |
|--------|--------|-------|
| Singleton pattern | Partial (dev only) | `global.prisma` prevents hot-reload duplication. Production cold starts create new instances (correct for Vercel). |
| Connection pooling | Neon-managed | `@prisma/adapter-neon` uses HTTP-based queries; no traditional pool config needed. |
| Disconnect/cleanup | None | Acceptable for Vercel serverless (ephemeral runtime). |
| Query logging | None | No `log` config. Consider adding in development for debugging. |

---

## Optimization Recommendations (Prioritized)

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | Add SERIALIZABLE to `markCheckoutCompleted` | 1 line | Prevents inventory corruption |
| **P0** | Wrap scan flows in transactions | Small | Prevents duplicate scans and race conditions |
| **P1** | Add indexes M1, M2, M5, M6 | Migration | Dashboard and availability queries 10-100x faster |
| **P1** | Consolidate dashboard counts into 1-2 raw SQL queries | Medium | 17 queries → 3-4 |
| **P1** | Replace audit log loops with `createMany` (N1, N7) | Small | Eliminates 50+ INSERTs per bulk operation |
| **P2** | Batch `upsertBulkBalancesAndMovements` (N4) | Medium | 3N → ~3 queries per booking with bulk items |
| **P2** | Consolidate asset status counts into `groupBy` | Small | 5 queries → 1 on assets page |
| **P2** | Add M4 index (booking date range overlap) | Migration | Calendar view without location filter |
| **P3** | Fix notification dedup pre-fetch (N2) | Small | Stops loading entire notifications table |
| **P3** | Add `select` to `bookingInclude` (N12) | Small | Reduces payload size on every booking query |
| **P3** | Add pagination to form-options and bulk-skus (N3, N9) | Small | Prevents unbounded result sets |
| **P3** | `pg_trgm` GIN indexes for text search (M7) | Migration | Enables indexed `ILIKE '%q%'` queries |

---

## What Looks Good

- **Availability checking** — 3 parallelized queries with proper SERIALIZABLE on mutations. Clean architecture.
- **Booking list** — 2 queries (data + count), parallelized. Efficient pagination.
- **SERIALIZABLE on core booking mutations** — `createBooking`, `updateReservation`, `cancelBooking`, `extendBooking`, `checkinItems` all use proper isolation.
- **`Promise.all` parallelization** — Used consistently across dashboard, availability, and init endpoints.
- **Derived status pattern (D-001)** — Status is computed from allocations, not stored. Eliminates stale-status bugs.
- **Existing index coverage** — Good composite indexes on `Booking [locationId, startsAt, endsAt]`, `AssetAllocation [assetId, active]`, `AuditLog [entityType, entityId, createdAt]`, and `Notification [userId, readAt]`.
- **PrismaClient singleton** — Correct pattern for Next.js/Vercel.
