# Notifications Area Scope (V1 Implemented)

## Document Control
- Area: Notifications
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-04-23
- Status: Active — escalation schedule + iOS tap-through navigation shipped
- Version: V1.1

## Direction
Surface custody urgency and overdue situations to the right people at the right time, with zero duplicate noise and a clear escalation path.

## Core Rules
1. Notifications are triggers for action, not passive information.
2. Deduplication is mandatory — the same notification type fires at most once per booking per window.
3. In-app and email channels coexist; dev mode logs to console in place of SMTP.
4. Escalation recipients for the 24h overdue trigger are not yet formalized — D-009 must be accepted before wiring multi-recipient escalation.
5. Notification center is read-only list in V1; mark-as-read is optional.

## Escalation Schedule (Implemented)

All triggers are relative to `booking.endsAt`:

| Hours from Due | Type | Title |
|---|---|---|
| −4h | `checkout_due_reminder` | Checkout due in 4 hours |
| 0h | `checkout_due_now` | Checkout is due now |
| +2h | `checkout_overdue_2h` | Checkout is 2 hours overdue |
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

## Deduplication (Implemented)
- Key format: `"{bookingId}:{type}"`
- Stored in `Notification.dedupeKey` (unique index)
- A notification record is created once per booking per trigger type
- Job skips re-creation if `dedupeKey` already exists
- Result: job is idempotent and safe to run on any cadence

## Channels (V1 + Email)
- **In-app**: `Notification` record created for the checkout requester; visible in notification center
- **Email**: Via Resend (`RESEND_API_KEY` env var). Falls back to `console.log` in dev. Non-fatal on failure.
- **Admin escalation**: +24h trigger notifies requester + all admins via both in-app and email
- **Email service**: `src/lib/email.ts` — `sendEmail()` + `buildNotificationEmail()` for HTML template

## Cron / Job Runner
- **Cron endpoint**: `GET /api/cron/notifications` — validates `CRON_SECRET` bearer token, no user session needed
- **Manual endpoint**: `POST /api/notifications/process` — admin/staff auth required
- **Schedule**: Daily at 8:00 AM UTC via Vercel Cron (`vercel.json`, schedule: `0 8 * * *`)
- **Hobby plan constraint**: Vercel Hobby limits crons to once/day. Sub-hourly escalation checks (e.g. `*/15 * * * *`) require upgrading to Pro plan. Current daily cadence means escalation triggers fire with up to ~24h latency relative to their window.
- Behavior: scans all `OPEN` checkouts, evaluates each trigger against current time, creates in-app notifications + sends email for matching windows
- Job is fully idempotent — safe to call multiple times per hour due to dedup logic

## Notification Center (V1.1)
- Route: `/notifications`
- Content: all in-app notifications for current user, ordered by `createdAt` descending
- Mark-as-read: leading + trailing swipe; tap also marks read
- Empty state: "All caught up" with `bell.slash` icon
- Deep links: tapping a notification navigates to the related booking or trade board (2026-04-23)
- Unread badge: `GET /api/notifications/count` returns `{ unreadCount }` — lightweight, no data fetch
- Foreground refresh: iOS app re-fetches unread count on every foreground return (scenePhase hook)

## Dashboard Integration
- Overdue banner count: driven by direct booking query (not notification records) for accuracy
- Badge counts on nav items for Reservations and Check-outs can show overdue + due-today urgency
- Overdue count in banner must remain consistent with `AREA_DASHBOARD.md` overdue banner spec

## D-009 Acceptance (2026-03-15)

D-009 (Overdue Escalation Policy) is status `Accepted`. Decisions:
1. **Recipient model**: +24h escalation goes to the requester AND all admins
2. **Alert fatigue**: Admin-configurable per-booking notification cap (default: 10). Settings at `/settings/escalation`
3. **Email channel**: Shipped (2026-03-16 via Resend). Dev mode logs to console; failures are non-fatal
4. **Schedule**: DB-driven via `EscalationRule` model, seeded with -4h/0h/+2h/+24h defaults

Current behavior:
- All 4 triggers notify the requester
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

## Out of Scope (V1)
1. Push notifications (native or web push)
2. SMS notifications
3. Per-user notification preferences or opt-out controls
4. Reservation-based notification triggers (only checkout overdue in V1)
5. Multi-channel campaign orchestration or template management

## Developer Brief (No Code)
1. Escalation job is implemented; do not modify schedule without updating D-009
2. Multi-recipient escalation requires a recipient resolution function (by role, location, or explicit list) — implement only after D-009 is accepted
3. Dashboard overdue count must query bookings directly for real-time accuracy; do not use notification records as count source
4. Add notification center UI polish (pagination, mark-as-read) in Phase B
5. When D-009 is accepted: add recipient model, audit escalation routing events, and add test for multi-recipient delivery

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | Yes (prod) | Bearer token for Vercel Cron → `/api/cron/notifications` |
| `RESEND_API_KEY` | No (optional) | Enables email delivery via Resend. Falls back to console.log |
| `EMAIL_FROM` | No | From address for transactional email. Default: `Gear Tracker <noreply@gear-tracker.app>` |

## Change Log
- 2026-03-01: Initial stub created.
- 2026-03-09: Rewritten as V1 spec to formalize implemented escalation schedule, dedup behavior, channel model, and D-009 acceptance requirements.
- 2026-03-16: Vercel Cron wired (`vercel.json`, `GET /api/cron/notifications`). Resend email service (`src/lib/email.ts`) replaces console.log stub. Dual-channel delivery: in-app + email for all triggers. GAP-6 closed.
- 2026-03-25: Doc sync — standardized ACs to checkbox format (V1: 5 checked, D-009: 4 checked). Fixed cron schedule claim (was "every 15 minutes", actual is daily 8 AM UTC). Marked email channel as shipped.
