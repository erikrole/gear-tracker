# Notifications Area Scope (V1 Implemented)

## Document Control
- Area: Notifications
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-07-03
- Status: Active: escalation schedule + iOS booking/event tap-through + APNs native push + calendar sync health alerts + schedule notification policy shipped
- Version: V1.2

## Direction
Surface custody urgency and overdue situations to the right people at the right time, with zero duplicate noise and a clear escalation path.

## Core Rules
1. Notifications are triggers for action, not passive information.
2. Deduplication is mandatory — the same notification type fires at most once per booking per window.
3. In-app and email channels coexist; dev mode logs to console in place of SMTP.
4. The 24h overdue trigger reaches the requester and all admins, per accepted D-009.
5. Notification center supports mark-read and mark-all-read; read mutations must keep the inbox and bell count honest.

## Escalation Schedule (Implemented)

All triggers are relative to `booking.endsAt`:

| Hours from Due | Type | Title |
|---|---|---|
| −1h | `checkout_due_1h` | Due back in 1 hour |
| 0h | `checkout_due_now` | Checkout is due now |
| +1h | `checkout_overdue_1h` | 1 hour overdue |
| +3h | `checkout_overdue_3h` | 3 hours overdue |
| +8h | `checkout_overdue_8h` | 8 hours overdue |
| +24h | `checkout_overdue_24h` | Checkout is 24 hours overdue |

Implementation: `src/lib/services/notifications.ts`

## Reservation Lifecycle Triggers (Implemented 2026-04-23)

| Event | Type | Recipient | Trigger point |
|---|---|---|---|
| Reservation created | `reservation_booked` | Requester | `POST /api/reservations` |
| Gear ready for pickup | `reservation_pickup_ready` | Requester | `POST /api/reservations/[id]/convert` |
| Reservation cancelled | `reservation_cancelled` | Requester | `POST /api/reservations/[id]/cancel` (skipped if self-cancel) |

- Deduplication: `${bookingId}:reservation_${event}` — idempotent on retry
- Channel: IN_APP only (email deferred)
- Self-cancel: requester is not notified when they cancel their own reservation
- Implementation: `createReservationLifecycleNotification` in `src/lib/services/notifications.ts`

## Shift Trade Triggers (Implemented 2026-05-05)

| Event | Type | Recipient | Channels |
|---|---|---|---|
| Trade claimed, staff approval required | `trade_claimed` | Original poster | In-app + email |
| Trade completed instantly | `trade_completed` | Original poster | In-app + email |
| Trade approved by staff | `trade_approved` | Claimer | In-app + email |
| Trade declined by staff | `trade_declined` | Claimer | In-app + email |

- Email is best-effort and sent after the trade transaction resolves.
- Email respects `notificationPrefs.channels.email`, `notificationPrefs.categories.trade`, and `pausedUntil`.
- Trade lifecycle rows now carry event-routable payloads with `eventId`, `shiftId`, `assignmentId`, `tradeId`, and `/events/{eventId}` where the trade can be tied back to a scheduled event.
- Native push is best-effort for claimed, completed, approved, and declined trade events when push and the `trade` category are enabled.
- Staff-wide claim fanout and direct-assignment emails are out of scope.
- Implementation: `src/lib/services/shift-trades.ts` + `src/lib/services/shift-trade-emails.ts`

## Shift Schedule Triggers (Implemented 2026-05-21)

| Event | Type | Recipient | Channels |
|---|---|---|---|
| New direct assignment | `shift_assigned` | Assignee | In-app + email + push |
| Approved request | `shift_request_approved` | Assignee | In-app + email + push |
| Removed assignment | `shift_assignment_removed` | Assignee | In-app + email + push |
| Shift call-time changed | `shift_time_changed` | Active assignee | In-app + email + push |
| Personal call-time changed | `shift_personal_call_time_changed` | Assignee | In-app + email + push |

- Copy uses Staff and Student labels plus the effective call time.
- Deduplication includes assignment id, event type, and effective call window so retries do not duplicate unchanged messages.
- Worker-facing schedule notifications are publication-aware: draft assignments and draft call-time changes do not notify workers, while published assignment creates, approved requests, removals, and call-time changes do.
- Changed-after-publish call-time edits clear assignment acknowledgement before notifying the worker.
- Payloads are event-routable with `target: "event"`, `/events/{eventId}`, `eventId`, `shiftId`, and `assignmentId`.
- Delivery respects additive notification categories: `schedule`, `trade`, and `gearPrep`. Old preference JSON defaults these categories to enabled.
- Implementation: `src/lib/services/schedule-notification-policy.ts` and `src/lib/services/notifications.ts`.

## Badge Award Triggers (Implemented 2026-05-09)

| Event | Type | Recipient | Channels |
|---|---|---|---|
| Manual badge awarded by admin | `badge_awarded` | Awarded user | In-app |

- Persistent inbox only. No toast fanout, email, APNs, or push in this slice.
- Link target comes from `payload.href` and points to `/users/{userId}?tab=badges`.
- Delivery respects `User.notificationPrefs.badges`; missing or old preference shapes default to enabled.
- Implementation: `POST /api/badges/award` and `awardBadgeManually` in `src/lib/badges/queries.ts`.

## Deduplication (Implemented)
- Key format: `"{bookingId}:{type}"`
- Stored in `Notification.dedupeKey` (unique index)
- A notification record is created once per booking per trigger type
- Job skips re-creation if `dedupeKey` already exists
- Result: job is idempotent and safe to run on any cadence

## Native Push (V1.2 — 2026-04-23)
- Transport: APNs via Node.js built-in `http2` + `crypto` (zero new deps)
- Auth: JWT token (ES256) from .p8 key — re-generated per request, valid 1h
- Schema: `DeviceToken` model (`prisma/migrations/0040_add_device_tokens`) — `token` unique, indexed on `(userId, revokedAt)`
- Registration: `POST /api/devices` upserts token on every app foreground after login; `DELETE /api/devices` bulk-revokes on logout. Native registration/revocation decodes the `{ success: true }` response through the shared API handler so 401s trigger the global session-expired path.
- iOS: `AppDelegate.didRegisterForRemoteNotificationsWithDeviceToken` → POST hex token. Permission requested once after login (`.notDetermined` guard; existing `.authorized` silently re-registers).
- Push fires for: checkout due/overdue escalation, `shift_gear_up`, shift schedule changes, trade lifecycle events, reservation lifecycle events, and license nag/expiry warnings when the recipient has push enabled for that category.
- Tap handling: `UNUserNotificationCenterDelegate.didReceive` sets `AppState.pendingPushBookingId` or `AppState.pendingPushEventId`. Booking pushes open through `HomeView`; event pushes switch to Schedule and let `ScheduleView` open the matching event sheet.
- Native Settings > Notifications exposes the same notification category toggles as web: checkout due reminders, checkout overdue alerts, reservation updates, license expiry reminders, schedule updates, trade updates, and gear prep nudges. In-app inbox rows remain always visible regardless of category settings.
- Revoked/BadDeviceToken responses auto-revoke the token in DB on next push attempt
- Required env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_P8_KEY` (base64-encoded full PEM including headers). Missing = push silently skipped.
- Source: `src/lib/push/apns.ts` (sendPush), `src/lib/services/notifications.ts` (sendPushToUser), `src/app/api/devices/route.ts`

## Channels (V1 + Email)
- **In-app**: `Notification` record created for the checkout requester; visible in notification center
- **Email**: Via Resend (`RESEND_API_KEY` env var). Falls back to `console.log` in dev. Non-fatal on failure.
- **Admin escalation**: +24h trigger notifies requester + all admins via both in-app and email
- **Email service**: `src/lib/email.ts` — `sendEmail()` + `buildNotificationEmail()` for HTML template

## Cron / Job Runner
- **Cron endpoint**: `GET /api/cron/notifications` — validates `CRON_SECRET` bearer token, no user session needed
- **Manual endpoint**: `POST /api/notifications/process` — admin/staff auth required
- **Schedule**: Daily at 9:00 AM UTC via Vercel Cron (`vercel.json`, schedule: `0 9 * * *`)
- **Hobby plan constraint**: Vercel Hobby limits crons to once/day. Sub-hourly escalation checks (e.g. `*/15 * * * *`) require upgrading to Pro plan. Current daily cadence means escalation triggers fire with up to ~24h latency relative to their window.
- Behavior: scans all `OPEN` checkouts, evaluates each trigger against current time, creates in-app notifications + sends email for matching windows
- Resilience: overdue, license nag, and license-expiry jobs run independently with `Promise.allSettled`. A single failure returns `ok: false` plus `partialFailures`/`errors` metadata while preserving successful job results and safe fallback counts for failed jobs.
- Job is fully idempotent — safe to call multiple times per hour due to dedup logic

## Notification Center (V1.1)
- Route: `/notifications`
- Content: all in-app notifications for current user, ordered by `createdAt` descending
- Mark-as-read: inline single-row action plus Mark all read
- Mutation reliability: mark-read, mark-all-read, and manual overdue processing use ref-backed duplicate-action guards, shared 401 redirects, safe response parsing, and specific server/network error toasts
- API reliability: malformed mark-read JSON returns 400, stale or wrong notification IDs return 404, and audit rows are only created after a real update
- Empty state: "All caught up" with `bell.slash` icon
- Deep links: row actions navigate to the related booking, reservation, schedule surface, or explicit `payload.href`
- Unread badge: `GET /api/notifications/count` returns `{ unreadCount }` — lightweight, no data fetch
- Foreground refresh: iOS app re-fetches unread count on every foreground return (scenePhase hook)

## Dashboard Integration
- Overdue banner count: driven by direct booking query (not notification records) for accuracy
- Badge counts on nav items for Reservations and Check-outs can show overdue + due-today urgency
- Overdue count in banner must remain consistent with `AREA_DASHBOARD.md` overdue banner spec

## Calendar Sync Health Triggers (Implemented 2026-06-02)

| Event | Type | Recipient | Trigger point |
|---|---|---|---|
| Calendar source has repeated hard daily sync failures | `calendar_sync_failure` | Active admins | `morning-refresh` after 3+ consecutive hard source sync failures |

- Channel: IN_APP only.
- Deduplication: `calendar_sync_failure:{sourceId}:{consecutiveFailures}:{adminId}` so each admin gets at most one row for a specific source/failure-count threshold.
- Payload includes `sourceId`, `sourceName`, `consecutiveFailures`, latest `error`, and `href: "/settings/calendar-sources"`.
- Clean hard sync results reset the source counter. Partial malformed-event skips without a hard `SyncResult.error` remain visible in source health but do not trigger repeated-failure notifications.
- Implementation: `src/lib/services/calendar-sync-health.ts` called from `GET /api/cron/morning-refresh`.

## Hidden Smoke/Test Users
- Admin and supervisor fan-out uses the shared visible-active user filter. Hidden smoke/test identities do not receive overdue admin escalation, item-report, low-stock, license-expiry, calendar-sync-health, or firmware-watch notifications even while they remain active for verification.

## Firmware Watch Triggers (Implemented 2026-06-10)

| Event | Type | Recipient | Trigger point |
|---|---|---|---|
| Watched product has a newer official firmware version | `firmware_update_released` | Active admins | `morning-refresh` daily firmware watch step |

- Channel: IN_APP plus best-effort native push when the admin has active device tokens and push enabled.
- Deduplication: `firmware_release:{targetId}:{version}:{adminId}` so each admin receives at most one notification per watched product version.
- First successful check for a target establishes a baseline silently. Historical releases do not notify on the day a target is first added.
- Payload includes `firmwareWatchTargetId`, `brand`, `model`, `productName`, `supportMode`, `supportNote`, `version`, `releaseDate`, `sourceUrl`, and an `/items?search=` link for the model.
- Source URLs are constrained by parser type. The active runtime currently seeds and polls verified Sony support hosts only.
- Implementation: `FirmwareWatchTarget` model, `src/lib/services/firmware-watch.ts`, and `GET /api/cron/morning-refresh`.

## D-009 Acceptance (2026-03-15)

D-009 (Overdue Escalation Policy) is status `Accepted`. Decisions:
1. **Recipient model**: +24h escalation goes to the requester AND all admins
2. **Alert fatigue**: Admin-configurable per-booking notification cap (default: 10). Settings at `/settings/escalation`
3. **Email channel**: Shipped (2026-03-16 via Resend). Dev mode logs to console; failures are non-fatal
4. **Schedule**: DB-driven via `EscalationRule` model, currently seeded with -1h/0h/+1h/+3h/+8h/+24h defaults

Current behavior:
- All enabled triggers notify the requester
- +24h trigger also notifies all admins (excluding the requester if they are an admin)
- Admins can toggle triggers, recipients, and caps at `/settings/escalation`

## Bug Traps and Mitigations

### Trap: Same trigger fires multiple times
- Mitigation: dedupeKey prevents duplicate records; job is idempotent

### Trap: Booking completed but notification job fires again
- Mitigation: job scans only `status = OPEN` checkouts; completed records are excluded

### Trap: Email failure silently drops notification
- Mitigation: in-app notification is created first; email is best-effort and logged on failure

### Trap: Dev environment sends real emails during local testing
- Mitigation: SMTP credentials absent in dev → console.log fallback; never hard-fails

### Trap: Extended checkout re-triggers already-sent notifications
- Mitigation: dedupeKey is keyed to booking + type, not due time — extension creates no duplicates for past trigger windows; only future windows with new types would fire

## Edge Cases
- Checkout extended after overdue trigger already fired — dedup prevents re-fire for same window
- User has no email on file — create in-app notification only; skip email silently
- Admin manually resolves overdue without system notification — no reconciliation needed
- Notification record exists for a booking that was later cancelled — show in notification center as historical; no re-trigger
- Notification center shows records for soft-deleted or cancelled bookings — handle gracefully in query (null-safe booking join)

## Acceptance Criteria (V1 — Implemented)
- [x] AC-1: All 4 escalation triggers fire at correct relative times.
- [x] AC-2: Deduplication prevents duplicate notifications per booking per type.
- [x] AC-3: In-app notification records appear in notification center for the requester.
- [x] AC-4: Dev mode shows console output instead of sending SMTP email.
- [x] AC-5: Job endpoint is safe to call repeatedly without creating duplicates.

## Acceptance Criteria (D-009 — Accepted 2026-03-15)
- [x] AC-6: Escalation recipient model is formally defined and documented (requester + all admins).
- [x] AC-7: 24h trigger reaches admin recipients in addition to student requester.
- [x] AC-8: Alert fatigue controls implemented (admin-configurable per-booking cap).
- [x] AC-9: Email failure path logged without crashing the job runner.

## Dependencies
- `AREA_CHECKOUTS.md` — booking lifecycle, `endsAt` field, `OPEN` state contract
- `AREA_USERS.md` — recipient role resolution for future multi-recipient escalation
- `AREA_DASHBOARD.md` — overdue banner count consistency
- `DECISIONS.md` (D-007) — audit logging of notification creation events

## Current Out of Scope
1. SMS notifications.
2. Multi-channel campaign orchestration or template management.
3. Slack or other shared-channel notification delivery.
4. Sub-daily checkout escalation cron cadence on Vercel Hobby.
5. Generic notification authoring tools outside the existing event-specific producers.

## Developer Brief
1. Escalation job is implemented; do not modify schedule without updating D-009, `EscalationRule` seed docs, and Settings copy.
2. Dashboard overdue count must query bookings directly for real-time accuracy; do not use notification records as count source.
3. App-shell bell counts must use `GET /api/notifications/count`, not the paginated inbox route.
4. In-app rows remain persistent even when email/push/category preferences suppress outbound delivery.
5. When adding notification types, keep web row styling, iOS payload decoding, and tap-through behavior aligned.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | Yes (prod) | Bearer token for Vercel Cron → `/api/cron/notifications` |
| `RESEND_API_KEY` | No (optional) | Enables email delivery via Resend. Falls back to console.log |
| `EMAIL_FROM` | No | From address for transactional email. Default: `Wisconsin Creative <noreply@wisconsincreative.com>` |

## Change Log
- 2026-07-07: **Notification delivery hardening shipped.** (1) Low-stock re-alerts were permanently silenced: `dedupeKey` is globally unique, and `notifyLowStock`'s constant per-admin key plus `skipDuplicates` skipped every insert after the first-ever alert, so the documented 24h re-alert never fired again. Keys are now day-stamped with a 24h prefix-window pre-check (legacy un-stamped keys still count as recent). (2) APNs http2 sessions now attach an error handler -- an unhandled session "error" event (transient DNS/connection failure to Apple) previously killed the serverless function mid-request -- and every push request carries a 10s timeout so a stalled stream can't hold the function open. (3) The APNs provider JWT is cached for 50 minutes at module scope instead of minted per send, avoiding Apple's `TooManyProviderTokenUpdates` rejection during notification fan-outs. (4) `sendPushToUser` is now internally never-throw, matching its six fire-and-forget `void` call sites where a rejection would be fatal. (5) Device-token registration caps token/appVersion lengths. Audited and unchanged: pref gating on both channels, HTML-escaped email templates, never-throw email transport, bounded escalation batching, revoked-token cleanup. Plan: `tasks/archive/notifications-hardening-plan.md`.
- 2026-07-01: Wisconsin Creative domain cutover prep updated production email/link guidance. Production should set `APP_URL=https://wisconsincreative.com` before onboarding, and transactional email should use a verified `Wisconsin Creative <noreply@wisconsincreative.com>` sender when Resend delivery is enabled.
- 2026-07-03: Notification support hardening aligned the app-shell bell with the lightweight no-store unread-count endpoint, kept checkout due/overdue inbox styling compatible with current reseeded escalation type names, reconciled the documented escalation schedule plus cron timing with the live `EscalationRule` seed shape and `vercel.json`, restored license notification timestamps/category-gated push delivery, and kept manual badge awards inbox-only per the documented contract.
- 2026-06-18: Schedule Source Of Truth Slice 6 shipped. Scheduling notifications now use one policy for schedule, trade, and gear-prep categories with defensive defaults for old preference JSON; draft assignment changes are suppressed for workers until publish, changed published call times clear acknowledgement, trade lifecycle rows and push/email delivery respect the `trade` category, and schedule/trade/gear-prep payloads carry event-routable context for web and iOS tap-through.
- 2026-06-10: Daily firmware watch notifications shipped. `morning-refresh` now polls enabled official-source firmware watch targets, baselines the first successful result silently, records latest version/release date/check errors, and creates deduped `firmware_update_released` admin inbox rows plus best-effort push when a newer version appears.
- 2026-06-10: iOS notification settings detail menu shipped. Native Settings now keeps notification delivery status at the root and moves OS push permission recovery, pause controls, email/push channel toggles, and category toggles into a dedicated Notifications drill-down while preserving the in-app inbox always-on contract.
- 2026-06-10: iOS notification category parity shipped. Native Profile now exposes the existing web-backed toggles for checkout due reminders, checkout overdue alerts, reservation updates, and license expiry reminders while preserving the in-app inbox always-on contract.
- 2026-06-10: iOS push token delivery honesty shipped. Native APNs token registration and logout revocation now decode `/api/devices` success responses through the shared API handler instead of raw `URLSession.data`, so rejected responses and 401s are handled like the rest of the app.
- 2026-06-10: iOS shift push tap-through shipped. Shift gear-up and shift schedule APNs payloads now include `eventId`, `assignmentId`, and `shiftId`; tapped event pushes switch the native app to Schedule and let the existing event opener present the relevant event sheet. Native push documentation was also reconciled with current checkout escalation, reservation, shift, and license push behavior.
- 2026-06-05: iOS Notifications read-recovery honesty shipped. Native mark-read and mark-all-read now inspect PATCH response status through the shared API handler, restore unread state on failure, and show a recoverable Refresh banner with error haptic instead of silently treating rejected updates as success.
- 2026-06-03: iOS Profile notification controls now use self-describing labels for field use. Quiet-hours controls read Pause alerts with visible Pause 1 hour, Pause 1 day, and Pause 1 week actions, and channel toggles read Email alerts and Push alerts while preserving the in-app inbox always-on contract.
- 2026-06-02: Calendar sync health alerts shipped. Morning refresh now creates persistent in-app `calendar_sync_failure` rows for active admins after 3+ consecutive hard daily failures for a source, deduped by source, failure count, and admin recipient.
- 2026-05-25: Web bug sweep Batch 24 hardened URL-backed notification inbox state. Unread-only and page params now rehydrate from browser back/forward and external URL changes through the shared `useUrlState` hook.
- 2026-05-24: Web bug sweep hardened `/notifications` mark-read, mark-all-read, and manual overdue processing against duplicate clicks, expired sessions, malformed/non-JSON responses, stale notification IDs, and misleading success copy. `PATCH /api/notifications` now returns explicit 400/404 errors and only audits successful single-notification updates.
- 2026-05-21: Shift schedule notifications now cover new assignments, approved requests, removed assignments, shift call-time changes, and personal call-time changes. Copy spells out Staff or Student and includes the effective call time.
- 2026-05-21: Design-language cleanup moved notification summary metrics to the shared `OperationalMetricCard` primitive and raised notification-center header, retry, destination, and mark-read actions to the 40px operational target baseline.
- 2026-05-12: iOS notification routing now recognizes `badge_awarded` inbox rows and opens the awarded user's native profile from the notification payload's `userId`. Badge award delivery remains persistent in-app only, with no push, email, or toast fanout.
- 2026-05-12: Security audit patch. `GET /api/cron/notifications` now uses partial-failure handling across overdue, license nag, and license-expiry jobs so one rejected job no longer drops successful notification work.
- 2026-05-09: Web notification-center UI polish. `/notifications` now reads as an action inbox with unread/read/total summary metrics, a clearer filter toolbar, role-gated overdue processing, explicit refresh, notification type badges, stronger unread/read row treatment, and destination actions that name the target surface without changing notification delivery or API contracts.
- 2026-05-09: Badge award notifications shipped for manual badge awards. Admin awards create persistent inbox rows linked to the awarded user's badges tab, and delivery respects `notificationPrefs.badges` while keeping push and toast fanout deferred.
- 2026-05-08: API hardening Wave 13. Notification count polling is now actor-rate-limited and uses short private caching.
- 2026-05-08: API hardening Wave 6. Cron routes now share `withCron()` for timing-safe `CRON_SECRET` bearer validation instead of each endpoint carrying its own auth comparison.
- 2026-05-08: API hardening Wave 5. Shift gear-up nudges now validate active future assignments and apply layered rate limits per actor, target assignment, and recipient before creating notification/audit rows. Focused tests cover student denial, inactive assignment rejection, and rate-limit enforcement.
- 2026-03-01: Initial stub created.
- 2026-03-09: Rewritten as V1 spec to formalize implemented escalation schedule, dedup behavior, channel model, and D-009 acceptance requirements.
- 2026-03-16: Vercel Cron wired (`vercel.json`, `GET /api/cron/notifications`). Resend email service (`src/lib/email.ts`) replaces console.log stub. Dual-channel delivery: in-app + email for all triggers. GAP-6 closed.
- 2026-03-25: Doc sync — standardized ACs to checkbox format (V1: 5 checked, D-009: 4 checked). Fixed cron schedule claim (was "every 15 minutes", actual is daily 8 AM UTC). Marked email channel as shipped.
- 2026-05-05: Shift trade lifecycle emails shipped for claimed, completed, approved, and declined trade events. Delivery is best-effort and respects email notification preferences.
