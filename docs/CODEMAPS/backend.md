<!-- Generated: 2026-04-14 | Files scanned: 142 | Token estimate: ~900 -->
# Backend Architecture — gear-tracker

## Service Layer (src/lib/services/)
```
availability.ts       — Asset/slot availability checks
booking-rules.ts      — Booking validation rules
bookings-checkin.ts   — Check-in flow logic
bookings-helpers.ts   — Booking utility functions
bookings-lifecycle.ts — State machine transitions
bookings-queries.ts   — DB query helpers for bookings
bookings.ts           — Core booking CRUD
calendar-sync.ts      — ICS feed parsing & sync
event-defaults.ts     — Default event config
kits.ts               — Kit/case management
notifications.ts      — Notification dispatch
scans.ts              — QR/barcode scan handling
shift-assignments.ts  — Shift assignment management
shift-generation.ts   — Auto-generate shift schedules
shift-trades.ts       — Shift trade request flow
sport-configs.ts      — Sport configuration
status.ts             — Status transition helpers
```

## Key Lib Files (src/lib/)
```
auth.ts               — Session create/read/destroy
db.ts                 — Prisma client singleton
permissions.ts        — RBAC (141 lines)
validation.ts         — Zod input schemas (243 lines)
format.ts             — Data formatters (190 lines)
equipment-sections.ts — Equipment grouping (187 lines)
booking-actions.ts    — Booking action handlers (103 lines)
audit.ts              — Audit log writes
email.ts              — Resend email delivery
blob.ts               — Vercel Blob image ops
scan-feedback.ts      — Scan result feedback
sports.ts             — Sport config helpers (67 lines)
status-styles.ts      — Status → UI style map (81 lines)
status-colors.ts      — Status → color map (39 lines)
equipment-guidance.ts — Equipment guidance logic (160 lines)
api.ts                — Fetch utilities & HTTP helpers
```

## API Routes Summary (src/app/api/)

### Auth & Users
```
POST /api/auth/login|register|logout|forgot-password|reset-password
GET  /api/me
GET|PATCH /api/profile
POST /api/profile/avatar
GET|POST /api/users
GET|PUT|DELETE /api/users/[id]
PATCH /api/users/[id]/role
GET /api/users/[id]/activity
GET|POST /api/allowed-emails
DELETE /api/allowed-emails/[id]
```

### Assets
```
GET|POST /api/assets
GET|PUT|DELETE /api/assets/[id]
POST /api/assets/[id]/image|generate-qr|duplicate|retire
GET|POST /api/assets/[id]/maintenance|accessories|activity|insights
GET /api/assets/brands|picker-search
POST /api/assets/bulk|export|import
GET|POST /api/categories
PATCH|DELETE /api/categories/[id]
```

### Bulk SKUs
```
GET|POST /api/bulk-skus
GET|PUT|DELETE /api/bulk-skus/[id]
POST /api/bulk-skus/[id]/adjust|convert-to-numbered
GET|POST /api/bulk-skus/[id]/units
GET|PATCH|DELETE /api/bulk-skus/[id]/units/[unitNumber]
```

### Bookings
```
GET|POST /api/bookings
GET|PUT|DELETE /api/bookings/[id]
POST /api/bookings/[id]/cancel|extend|nudge
GET /api/bookings/[id]/audit-logs
GET|POST /api/reservations
GET|PUT|DELETE /api/reservations/[id]
POST /api/reservations/[id]/cancel|convert|duplicate
GET|POST /api/checkouts
GET /api/checkouts/[id]
POST /api/checkouts/[id]/photo|scan|start-scan-session
GET /api/checkouts/[id]/scan-status|scan-lookup
POST /api/checkouts/[id]/checkin-scan|checkin-items|checkin-bulk
POST /api/checkouts/[id]/checkin-report|complete-checkout|complete-checkin|admin-override
POST /api/availability/check
```

### Scheduling
```
GET|POST /api/shifts
GET|PUT|DELETE /api/shifts/[id]
POST /api/shifts/backfill
GET /api/shifts/my-hours
GET|POST /api/shift-groups
GET|PUT|DELETE /api/shift-groups/[id]
POST /api/shift-groups/[id]/regenerate
GET|POST /api/shift-groups/[id]/shifts
GET|PATCH|DELETE /api/shift-groups/[id]/shifts/[shiftId]
GET|POST /api/shift-assignments
GET|PATCH|DELETE /api/shift-assignments/[id]
POST /api/shift-assignments/[id]/approve|decline|swap
POST /api/shift-assignments/request
GET|POST /api/shift-trades
POST /api/shift-trades/[id]/approve|decline|claim|cancel
GET /api/my-shifts
```

### Calendar, Kits, Kiosk, Cron
```
GET /api/calendar
GET|POST /api/calendar-sources  /api/calendar-events
POST /api/calendar-sources/[id]/sync
POST /api/calendar-events/[id]/visibility|command-center
GET|POST /api/kits
GET|PUT|DELETE /api/kits/[id]
GET|POST /api/kits/[id]/members  POST /api/kits/[id]/bulk-members
DELETE /api/kits/[id]/members/[membershipId]
POST /api/kiosk/activate|checkout/complete|checkout/scan
GET /api/kiosk/me|heartbeat|dashboard|users|scan-lookup
GET /api/kiosk/checkout/[id]|checkin/[id]/complete
POST /api/kiosk/checkin/[id]/scan
POST /api/cron/notifications|audit-archive
```
