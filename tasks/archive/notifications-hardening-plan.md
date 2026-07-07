# Notifications hardening plan

Audit of `notifications.ts`, `notification-prefs.ts`, `push/apns.ts`,
`email.ts`, the notification routes, and device-token registration.
Strong baseline: dedupe keys on every notification writer, pref gating on
both push and email channels, batched creates, never-throw email transport,
HTML-escaped email templates, revoked-token cleanup after every APNs send.

## Findings

### N1 (P0) -- Low-stock re-alerts are permanently silenced
`notification.dedupeKey` is `@unique`, and `notifyLowStock` uses the constant
key `low_stock:{sku}:{admin}` with `skipDuplicates`. The 24-hour re-alert
logic only gates the query; the insert itself is skipped forever once one
alert row exists. After the first-ever low-stock alert per SKU/admin, no
restock reminder ever fires again. Fix: day-stamped dedupe keys plus a
24h prefix-window pre-check (legacy un-stamped keys still count).

### N2 (P0) -- APNs http2 sessions can crash the process
`http2.connect(APNS_HOST)` sessions have no `error` handler; a transient
DNS/connection failure to Apple emits an unhandled `"error"` event, which
throws and kills the serverless function mid-request. Requests also have no
timeout, so a stalled stream holds the function open. Fix: shared
`connectApns()` with a session error handler, and a 10s per-request
timeout resolving to "error".

### N3 (P1) -- Fresh APNs JWT minted for every send
Apple requires provider tokens be refreshed no more often than once every
20 minutes; a notification fan-out (publish, trade lifecycle) mints one JWT
per call and risks `TooManyProviderTokenUpdates` rejections. Cache the JWT
at module level for 50 minutes (warm serverless instances reuse it).

### N4 (P1) -- `void sendPushToUser(...)` call sites can leak rejections
The service invokes `sendPushToUser` fire-and-forget with `void` in six
places; `void` does not handle rejection, and an unhandled rejection is
fatal in modern Node. Make `sendPushToUser` never-throw internally.

### N5 (P2) -- Device token registration accepts unbounded strings
`z.string().min(1)` lets an authed client store arbitrarily large tokens.
Cap at 512 chars (APNs tokens are 64 hex; generous headroom).

## Non-findings (checked, fine)
- Email templates HTML-escape all interpolated user content.
- Email transport is never-throw with a dev-mode fallback.
- Overdue escalation is bounded (500 checkouts/batch, per-booking cap),
  dedupe-keyed, grace-period aware, and cron plus admin-triggered routes
  are both permission/cron gated.
- Device token upsert correctly reassigns a token to the newest signed-in
  user and un-revokes on re-registration.
- Revoked APNs tokens are marked after every send path.

## Slices

- [x] S1: Day-bucketed low-stock dedupe keys + 24h prefix pre-check (N1)
- [x] S2: `connectApns()` with session error handler + request timeouts (N2)
- [x] S3: Module-level 50-minute JWT cache (N3)
- [x] S4: never-throw `sendPushToUser` (N4); token length cap (N5)
- [x] S5: Tests + build + docs sync

## Review

Shipped in one pass. New `tests/notifications-low-stock-dedupe.test.ts`
and APNs source-contract coverage; full suite + build green.
