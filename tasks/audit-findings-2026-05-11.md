# Codebase Audit — 2026-05-11

Deep research audit of the gear-tracker codebase. Every finding was verified against source.

---

## CRITICAL (P0)

### GAP-52 — `forcePasswordChange` flag ignored; admin temp passwords never enforced

**File:** `src/app/login/LoginForm.tsx` (onSuccess callback)  
**Also:** `src/app/api/auth/login/route.ts` (returns flag but enforcement is absent)

**What's broken:**  
The login API returns `{ forcePasswordChange: true }` for users with admin-set temporary passwords. The `LoginForm.tsx` `onSuccess` callback ignores the response data entirely and unconditionally routes to `/`:

```ts
// LoginForm.tsx
onSuccess: () => router.replace("/"),
```

The `useFormSubmit` hook delivers response data as the first arg of `onSuccess` (see `src/hooks/use-form-submit.ts:160`), but `LoginForm` never reads it.

**Impact:** Any user given a temporary password by an admin can use it indefinitely as a permanent password. Security audit trail for password-rotation compliance breaks silently.

**Fix:** Read the response in `onSuccess`, detect `forcePasswordChange === true`, and redirect to a password-reset page (e.g., `/settings/change-password`) instead of `/`. Add server-side middleware that rejects non-password-change requests when the flag is set.

---

## HIGH (P1)

### GAP-53 — Kiosk sessions have no server-side age check; stolen tokens valid indefinitely

**File:** `src/lib/auth.ts` `requireKiosk()` (~line 155)

**What's broken:**  
`requireKiosk()` validates the device is active but never checks whether the session is expired. The cookie carries a 7-day `expires` attribute (set in `KIOSK_SESSION_7D_MS`), but if the cookie is stolen or replayed server-side, the token validates forever. `requireAuth()` (user sessions) correctly checks `expiresAt` against the database. Kiosk sessions have no equivalent.

**Impact:** A leaked kiosk session cookie grants indefinite kiosk access unless an admin manually deactivates the device. Gap is different from user sessions which expire in the DB.

**Fix:** Add a `createdAt` or `expiresAt` field to `KioskDevice` (or a join table for kiosk sessions), and check it in `requireKiosk()`. Alternatively, rotate the `sessionToken` on each successful authentication and reject tokens older than 7 days server-side.

---

### GAP-54 — Cron route `archive-shifts` is unscheduled (dead route)

**File:** `src/app/api/cron/archive-shifts/route.ts`  
**Config:** `vercel.json` (cron jobs list)

**What's broken:**  
`/api/cron/archive-shifts` exists as a complete, `withCron`-protected handler but is absent from `vercel.json`. It is never invoked automatically. The shift archiving logic that matters is duplicated inside `morning-refresh` which IS scheduled — so the standalone route is pure dead code.

**Impact:** No functional regression (archiving happens via morning-refresh), but the route creates confusion about which code path is authoritative and wastes maintenance surface.

**Fix:** Either add it to `vercel.json` with a schedule, or delete `archive-shifts/route.ts` and consolidate fully into `morning-refresh`. Document the decision in `DECISIONS.md`.

---

### GAP-55 — Cron notification jobs use `Promise.all`; one failure silences all three

**File:** `src/app/api/cron/notifications/route.ts:12`

**What's broken:**  
```ts
const [overdueResult, licenseNagResult, expiryResult] = await Promise.all([
  processOverdueNotifications(),
  processLicenseNags(),
  processExpiryWarnings(),
]);
```

These are three independent notification jobs. If any one throws (DB timeout, unexpected data), all three reject and the entire cron run is logged as failed. Users who should get license nag emails won't if the overdue query happened to crash.

**Impact:** Silent notification failures. The three jobs are fully independent and should not share a failure domain.

**Fix:** Switch to `Promise.allSettled` and log each rejection individually. This matches the project doctrine already used in other parallel bundles.

---

## MEDIUM (P2)

### GAP-56 — On-time badge count uses `updatedAt` as return proxy; inaccurate after any edit

**File:** `src/lib/badges/evaluator.ts:196-198`

**What's broken:**  
```ts
const onTimeCount = completedCheckouts.filter(
  (booking) => booking.updatedAt.getTime() <= booking.endsAt.getTime() + ON_TIME_GRACE_MS,
).length;
```

`updatedAt` is a general-purpose last-modified timestamp, not a return timestamp. Any edit to a completed booking (e.g., staff adds a note, changes a field) will shift `updatedAt` forward, making a previously on-time return appear late — or vice versa. A dedicated `completedAt` column is absent from the Booking model.

**Impact:** Badge counts for on-time returns are not reliable. Staff edits to closed bookings silently corrupt badge state.

**Fix (short term):** Use `updatedAt` only at the moment of status transition to COMPLETED; do not re-filter historical records by it. Store a point-in-time snapshot by adding a `completedAt: DateTime?` field to `Booking` and populating it in the lifecycle service when status changes to COMPLETED. Filter by `completedAt` in the evaluator.

---

### GAP-57 — shift attendance badges are out of scope

**Resolved 2026-05-13:** product scope removed attendance-based shift badges. The dead badge hook was removed, and the seeded shift badge definitions were retired from the active catalog.

**Decision:** do not implement shift attendance badge logic unless a future product decision explicitly reopens attendance tracking as a recognition source. Shift request approval remains a non-event for badge awards.

---

### GAP-58 — Kiosk dashboard `Promise.all`; single query failure breaks idle screen

**File:** `src/app/api/kiosk/dashboard/route.ts`

**What's broken:**  
The kiosk idle screen endpoint bundles stats, events, and checkouts (including a `$queryRaw`) in `Promise.all`. If the raw SQL query fails for any reason, the entire dashboard endpoint 500s. Kiosk devices show an error screen instead of degrading gracefully.

**Impact:** A kiosk stuck on an error screen during high-traffic events (when kiosk use peaks) is a material operational problem.

**Fix:** Switch to `Promise.allSettled`, return partial results for successful queries, and fall back to empty arrays for failed ones. The stats panel can be hidden or show a stale indicator without breaking the rest of the screen.

---

## NOT BUGS (investigated but confirmed intentional)

- **`extendBooking` rejects PENDING_PICKUP**: Intentional per `booking-rules.ts` state×action matrix. PENDING_PICKUP only allows `edit` and `cancel`.
- **`archive-shifts` logic in `morning-refresh`**: The duplication is intentional — morning-refresh IS the scheduled runner. The standalone route is dead (see GAP-54).
- **ICS feed route public**: By design. Has its own rate limiting.
- **`CheckinItemReport @@unique([bookingId, assetId])`**: Intentional upsert design. Second report on same item+booking overwrites the first (DAMAGED→LOST silently drops the DAMAGED record). Acceptable for current use case but worth documenting.
- **`notifications.ts:86 Promise.all([openCheckouts, admins])`**: Appropriate — both are required inputs; failing fast is correct here.
- **React Query cache key fragmentation** (`["fetch", url]` vs `["booking", id]` vs `["bookingList", kind, url]`): Separate caches per query type. Caches updated via `setQueryData` after mutations; `refetchOnWindowFocus: true` ensures convergence. Minor stale window, not a bug.
- **N+1 in `/api/bookings`**: No N+1 found. Uses Prisma `include` joins in single query.
- **N+1 in `/api/assets`**: No N+1 found. Two-query pattern (assets then allocations for subset) is intentional and efficient.

---

## Summary

| ID | Severity | One-liner |
|----|----------|-----------|
| GAP-52 | P0 CRITICAL | `forcePasswordChange` ignored — temp passwords permanent |
| GAP-53 | P1 HIGH | Kiosk session no server-side age check — tokens valid forever |
| GAP-54 | P1 HIGH | `archive-shifts` cron route unscheduled — dead code |
| GAP-55 | P1 HIGH | Notification cron `Promise.all` — one failure silences all three |
| GAP-56 | P2 MEDIUM | On-time badge uses `updatedAt` not `completedAt` — corrupts on edit |
| GAP-57 | Closed | Shift attendance badges scrubbed as out of scope |
| GAP-58 | P2 MEDIUM | Kiosk dashboard `Promise.all` — single failure breaks idle screen |
