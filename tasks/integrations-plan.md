# Integrations Plan: Vercel Cron + Resend + Sentry + Vercel Blob

## Context
- Notification job exists at `POST /api/notifications/process` (auth-protected, idempotent)
- Email sending is a `console.log` stub in `notifications.ts:132-135`
- Error handling uses `fail()` in `src/lib/http.ts` with `console.error` — no centralized tracking
- Asset model has `imageUrl: String?` — currently URL-only, no upload
- No `vercel.json` exists yet
- Deploys to Vercel with Neon PostgreSQL

---

## Slice 1: Vercel Cron (5 min) ✅ SHIPPED 2026-03-16

### Files
- [x] **NEW** `vercel.json` — cron schedule config
- [x] **NEW** `src/app/api/cron/notifications/route.ts` — cron handler with secret validation
- [x] **EDIT** `src/lib/env.ts` — add `CRON_SECRET` env var

### Design
- Create `GET /api/cron/notifications` that validates `Authorization: Bearer <CRON_SECRET>` header
- This route calls `processOverdueNotifications()` directly (no auth session needed)
- `vercel.json` configures cron to hit this endpoint every 15 minutes
- Separate from existing `POST /api/notifications/process` (which is user-triggered, auth-protected)

### vercel.json
```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## Slice 2: Sentry Error Tracking (15 min)

### Files
- [ ] **EDIT** `package.json` — add `@sentry/nextjs`
- [ ] **EDIT** `next.config.ts` — wrap with `withSentryConfig`
- [ ] **NEW** `sentry.client.config.ts` — client-side Sentry init
- [ ] **NEW** `sentry.server.config.ts` — server-side Sentry init
- [ ] **NEW** `sentry.edge.config.ts` — edge Sentry init (minimal, we don't use edge but Next.js requires it)
- [ ] **NEW** `src/app/global-error.tsx` — React error boundary for Sentry
- [ ] **EDIT** `src/lib/env.ts` — add optional `SENTRY_DSN`
- [ ] **EDIT** `src/lib/http.ts` — capture exceptions in `fail()` for non-HttpError cases

### Design
- Sentry DSN is optional — app works fine without it (dev/local)
- Only capture 500-level errors (not HttpError which are intentional 4xx)
- `fail()` calls `Sentry.captureException(error)` for unknown errors before returning 500
- Global error boundary catches React render errors
- Source maps uploaded via `SENTRY_AUTH_TOKEN` at build time (Vercel env var)

---

## Slice 3: Resend Email (30 min) ✅ SHIPPED 2026-03-16

### Files
- [x] **EDIT** `package.json` — add `resend`
- [x] **NEW** `src/lib/email.ts` — email service abstraction
- [x] **EDIT** `src/lib/env.ts` — add optional `RESEND_API_KEY`
- [x] **EDIT** `src/lib/services/notifications.ts` — replace console.log with email send

### Design
- `src/lib/email.ts` exports `sendEmail({ to, subject, html })` function
- If `RESEND_API_KEY` is missing → log to console (dev fallback, matching existing behavior)
- If present → send via Resend API
- Email content: simple HTML template with notification title + body
- Wire into the admin escalation block in `notifications.ts` (lines 131-136)
- Also send email to requester for all trigger types (dual-channel: in-app + email)
- Email failures are non-fatal (log error, don't throw) per AREA_NOTIFICATIONS.md spec
- From address: `noreply@{configured domain}` via env var `EMAIL_FROM`

### Email flow change in notifications.ts
Current: in-app notification created → console.log for email
New: in-app notification created → `sendEmail()` for each notification (if RESEND_API_KEY set)

---

## Slice 4: Vercel Blob Image Storage (30 min)

### Files
- [ ] **EDIT** `package.json` — add `@vercel/blob`
- [ ] **NEW** `src/app/api/assets/upload/route.ts` — blob upload endpoint
- [ ] **EDIT** `src/lib/env.ts` — add optional `BLOB_READ_WRITE_TOKEN`
- [ ] **NEW** `src/lib/blob.ts` — thin wrapper around `@vercel/blob`

### Design
- `POST /api/assets/upload` accepts `multipart/form-data` with image file
- Validates: auth required, ADMIN/STAFF only, max 5MB, image/* mime types
- Uploads to Vercel Blob, returns `{ url: string }`
- Returned URL is stored in `Asset.imageUrl` by the client (existing field, no schema change)
- Optional: `DELETE /api/assets/upload?url=...` to clean up replaced images
- If `BLOB_READ_WRITE_TOKEN` is missing → return 503 (image upload unavailable)
- UI wiring is NOT in this slice — just the API. UI will come when item pages get the upload component.

---

## Environment Variables Summary

| Variable | Required | Slice |
|---|---|---|
| `CRON_SECRET` | Yes (prod) | 1 |
| `SENTRY_DSN` | No (optional) | 2 |
| `SENTRY_AUTH_TOKEN` | No (build-time) | 2 |
| `RESEND_API_KEY` | No (optional) | 3 |
| `EMAIL_FROM` | No (defaults to noreply@...) | 3 |
| `BLOB_READ_WRITE_TOKEN` | No (optional) | 4 |

---

## Doc Updates on Ship
- [ ] Update `docs/GAPS_AND_RISKS.md` — close GAP-6 (email channel wired)
- [ ] Update `docs/AREA_NOTIFICATIONS.md` — document Resend integration, cron schedule
- [ ] Create `.env.example` with all env vars documented

---

## Verification
- [ ] `npm run build` passes
- [ ] Cron route returns 401 without secret, 200 with secret
- [ ] Email service logs in dev (no RESEND_API_KEY), would send in prod
- [ ] Sentry captures test error in `fail()` path
- [ ] Blob upload returns URL for valid image, 413 for oversized, 401 for unauthenticated
