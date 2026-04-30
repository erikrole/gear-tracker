# Gear Tracker

**Gear Tracker** is a production-ready equipment management platform built for sports media and creative operations teams. It replaces spreadsheets and manual sign-out sheets with a scan-enforced, conflict-aware workflow — from reservation through return.

## What It Does

**Inventory management** — Track serialized and bulk gear side by side. Each item has QR-code identity, full-text search, editable metadata (brand, model, category, location, department), and live status derived from active allocations. Accessories bundle to parent items. Bulk items track individual units with loss reporting.

**Reservations & checkouts** — One unified booking model (`DRAFT → BOOKED → OPEN → COMPLETED`). Staff can create ad-hoc or event-linked checkouts, clone repeat bookings, and extend active ones with overlap detection. Conflict badges surface item-level contention before it becomes a problem.

**Scan enforcement** — Check-out and check-in require a QR scan. The web scan interface and the native iOS app share one backend; both handle all three modes (item lookup, checkout, check-in) with multi-device sync, numbered bulk unit selection, and optimistic UI with server confirmation.

**Shift scheduling** — Shifts auto-generate from ICS calendar events. Staff get assigned per sport and area. Students can request premier-event shifts and trade via an area-filtered trade board. A month-grid calendar shows coverage health at a glance (green / orange / red).

**Smart notifications** — A four-stage escalation schedule fires at −4h, 0h, +2h, and +24h relative to due time. Notifications go in-app and via email (Resend), with deduplication and an admin-configurable per-booking fatigue cap. A daily cron job catches overdue items.

**Ops dashboard** — Action-oriented lanes surface what needs attention now: overdue gear, due-today items, upcoming reservations, and in-progress checkouts. A stat strip, sport filter chips, and draft recovery make it the single screen ops staff live in.

**Role-based access** — Three tiers (ADMIN / STAFF / STUDENT) enforced server-side on every endpoint. Students get a mobile-optimized view of their own gear. Staff manage the floor. Admins configure settings.

**Admin settings** — Hierarchical category management, sport configuration with per-area shift counts, escalation rule editing, and on-demand database health diagnostics.

## Apps

- **Web** — Next.js (App Router, TypeScript) at the repo root. Primary surface for staff and admins; mobile-friendly for students.
- **iOS** — Native SwiftUI app at `ios/Wisconsin/`. Student/operator surface plus the canonical kiosk implementation (the web kiosk route was deprecated 2026-04-24). See `ios/README.md` for setup.

## Stack

- **Next.js** (App Router, TypeScript)
- **SwiftUI** (iOS 17+)
- **PostgreSQL** (Neon serverless) via Prisma ORM + `@prisma/adapter-neon`
- **Vercel** — Node.js serverless functions, Blob storage, Cron Jobs
- **shadcn/ui** + Tailwind CSS
- **Resend** for transactional email
- **Vitest** for unit tests

## Quick Start

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Team Workflow

We use a dual-agent (Codex + Claude) workflow for parallel implementation. See `docs/AI_COLLABORATION.md` for branch strategy, handoff contracts, and conflict-avoidance conventions.
