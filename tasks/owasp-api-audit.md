# OWASP API Security Audit — gear-tracker

Date: 2026-05-03 · Method: read-only review of `src/app/api/**`, auth wrappers, and policy map.

## Top-10 prioritized fixes

1. **P0 — `GET /api/bookings/[id]` IDOR.** Any STUDENT can read any booking by ID (full requester PII). `src/app/api/bookings/[id]/route.ts:13`. PATCH is gated, GET isn't.
2. **P1 — `POST /api/kiosk/activate` brute-forceable.** ~~6-digit code, no rate limit. Entire keyspace tries in <30h. `src/app/api/kiosk/activate/route.ts:13`.~~ Updated 2026-05-08: activation now has tighter per-IP throttling plus per-code hourly throttling after hashing the submitted code. Redis/Upstash remains the cross-instance limiter decision.
3. **P1 — Bookings/checkouts/reservations LIST returns all rows to STUDENT.** `bookings/route.ts:37`, `checkouts/route.ts:13`, `reservations/route.ts:11`.
4. **P1 — Booking POST lets STUDENT set arbitrary `requesterUserId`.** Frame other users for overdue gear. `checkouts/route.ts:34`, `reservations/route.ts:18`.
5. **P1 — Calendar-source SSRF.** Admin-only but no IP filtering — internal-network probe. `calendar-sources/test/route.ts`.
6. **P1 — Rate limiter is per-instance.** `src/lib/rate-limit.ts:10` uses in-memory Map; round-robin across Vercel instances defeats login throttling. Move to Upstash Redis (needs decision — see below).
7. **P1 — `POST /api/notifications/nudge` unscoped + unrate-limited.** ~~Notification spam primitive. `notifications/nudge/route.ts:11`.~~ Fixed 2026-05-08: active future assignment validation plus actor, assignment, and recipient rate limits.
8. **P1 — `POST /api/audit/last` exposes ADMIN activity to STAFF.** No entity-level access check. `audit/last/route.ts:19`.
9. **P2 — Avatar/booking-photo upload has no rate cap.** Storage exhaustion via compromised account.
10. **P2 — Hardening:** ~~ICS token rotation endpoint~~ fixed 2026-05-08, ~~force-password-change flag for admin-issued temp passwords~~ fixed 2026-05-08, audit IP/UA on password-reset link consumption.

## Verified clean

- No SQL injection — only `$queryRawUnsafe` uses are static strings in `db-diagnostics`.
- No mass-assignment — all PATCH handlers use explicit field allowlists.
- Session cookie attributes correct (httpOnly, secure, sameSite).
- CSRF Origin check on every mutation.
- Login + forgot-password don't enumerate users.

## Decisions still needed

- **#6 Redis rate limiter** — needs Upstash account / Vercel marketplace integration. Ask user before adding the dep.
- **#9 Storage exhaustion** — caps depend on legitimate usage patterns; pick a number.
- ~~Kiosk session length (currently 30 days) — shorten?~~ Fixed 2026-05-08: kiosk sessions now expire after 7 days.
