<!-- Generated: 2026-04-14 | Files scanned: 142 | Token estimate: ~700 -->
# Architecture Overview — gear-tracker

## System Type
Single Next.js 15 full-stack app (App Router) deployed on Vercel

## High-Level Data Flow
```
Browser/Kiosk
    │
    ▼
Next.js App Router (src/app/)
    ├── (app)/           ← Staff/Admin UI (auth-gated)
    ├── (kiosk)/kiosk/   ← Kiosk self-service UI
    ├── login|register/  ← Auth pages
    └── api/             ← ~130 API route handlers
         │
         ▼
    src/lib/ (services, validation, auth, email, blob)
         │
         ▼
    Prisma ORM → Neon PostgreSQL (serverless)
         │
    External Services:
         ├── Vercel Blob (images)
         ├── Resend (email)
         └── Sentry (error tracking)
```

## Auth Model
- Session-based auth (cookie), `SESSION_SECRET` env var
- Roles: ADMIN, STAFF, STUDENT
- `src/lib/auth.ts` — session management
- `src/lib/permissions.ts` — RBAC checks (141 lines)
- `src/app/api/allowed-emails/` — email whitelist for registration

## Core Domain Areas
| Area | Pages | API Prefix | Service Files |
|------|-------|-----------|---------------|
| Assets/Inventory | /items | /api/assets | lib/equipment-*.ts |
| Bookings | /checkouts, /reservations | /api/bookings, /api/checkouts, /api/reservations | lib/services/bookings*.ts |
| Scheduling | /schedule | /api/shifts, /api/shift-groups | lib/services/shift*.ts |
| Kiosk | /kiosk | /api/kiosk/* | lib/services/scans.ts |
| Events/Calendar | /events | /api/calendar-events | lib/services/calendar-sync.ts |
| Reports | /reports/* | /api/reports, /api/dashboard | — |
| Settings | /settings/* | /api/sport-configs, /api/locations, etc. | — |

## Deployment
- Platform: Vercel (Node.js serverless)
- DB: Neon serverless PostgreSQL via `@prisma/adapter-neon`
- Image storage: Vercel Blob
- Cron: `/api/cron/notifications`, `/api/cron/audit-archive`
- Error tracking: Sentry (`@sentry/nextjs`)
- Config: `next.config.ts` (CSP headers, image patterns, bundle analyzer)
