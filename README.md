# Gear Tracker

**Gear Tracker** is a production-ready equipment management platform built for sports media and creative operations teams. It replaces spreadsheets and manual sign-out sheets with a scan-enforced, conflict-aware workflow — from reservation through return.

## What It Does

**Inventory management** — Track serialized and bulk gear side by side. Each item has QR-code identity, full-text search, editable metadata (brand, model, category, location, department), and live status derived from active allocations. Accessories bundle to parent items. Bulk items track individual units with loss reporting.

**Reservations & checkouts** — One unified booking model (`DRAFT → BOOKED → OPEN → COMPLETED`). Staff can create ad-hoc or event-linked checkouts, clone repeat bookings, and extend active ones with overlap detection. Conflict badges surface item-level contention before it becomes a problem.

**Scan enforcement** — The signed-in app scan surface is lookup-only for finding gear by tag, QR value, serial number, or primary scan code. Physical checkout, reservation pickup, and return custody scans run through the authenticated native kiosk, with numbered bulk unit selection and server-confirmed custody evidence.

**Shift scheduling** — Shifts auto-generate from ICS calendar events. Staff get assigned per sport and area. Students can request premier-event shifts and trade via an area-filtered trade board. A month-grid calendar shows coverage health at a glance (green / orange / red).

**Smart notifications** — A four-stage escalation schedule fires at +1h, +3h, +8h, and +24h relative to due time. Notifications go in-app, by push where enabled, and via email (Resend), with deduplication and an admin-configurable per-booking fatigue cap. The daily `morning-refresh` maintenance job runs overdue and related notification work with partial-failure isolation.

**Ops dashboard** — Action-oriented lanes surface what needs attention now: overdue gear, due-today items, upcoming reservations, and in-progress checkouts. A stat strip, sport filter chips, and draft recovery make it the single screen ops staff live in.

**Role-based access** — Three tiers (ADMIN / STAFF / STUDENT) enforced server-side on every endpoint. Students get a mobile-optimized view of their own gear. Staff manage the floor. Admins configure settings.

**Admin settings** — Hierarchical category management, sport configuration with per-area shift counts, escalation rule editing, and on-demand database health diagnostics.

## Stack

- **Next.js** (App Router, TypeScript)
- **PostgreSQL** (Neon serverless) via Prisma ORM + `@prisma/adapter-neon`
- **Vercel** — Node.js serverless functions, Blob storage, Cron Jobs
- **shadcn/ui** + Tailwind CSS
- **Resend** for transactional email
- **Vitest** for unit tests
- **SwiftUI** native iOS app and dedicated kiosk target

## Quick Start

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run db:migrate:check
npm run dev
```

For Neon connection setup, incremental migrations, production drift checks, or a deliberately empty isolated database, follow [docs/PRISMA_NEON_RUNBOOK.md](docs/PRISMA_NEON_RUNBOOK.md). Do not create a new `init` migration against the existing migration chain.

## Repo Map

Current source maps live in `docs/CODEMAPS/`.

```bash
npm run codemap        # regenerate route, schema, area, frontend, backend, and dependency maps
npm run codemap:check  # fail when generated maps drift from source
npm run verify:docs    # docs verification gate for generated maps
```

Use `docs/CODEMAPS/routes.md` when orienting in App Router, `docs/CODEMAPS/schema.md` for Prisma model shape, and `docs/CODEMAPS/areas.md` to connect `AREA_*.md` docs to likely routes, services, and tests.

Read [docs/NORTH_STAR.md](docs/NORTH_STAR.md) for product direction, [docs/DECISIONS.md](docs/DECISIONS.md) for accepted architecture, and the relevant `docs/AREA_*.md` file for shipped area contracts.

Release and slice closeout gates live in `docs/RELEASE_VERIFICATION.md`. Use `npm run build:app` for safe local app compile proof; reserve `npm run build` for deploy-shaped checks because it runs the Prisma/Neon migration deploy wrapper before `next build`.

## Team Workflow

We use a dual-agent (Codex + Claude) workflow for parallel implementation. See `docs/AI_COLLABORATION.md` for branch strategy, handoff contracts, and conflict-avoidance conventions.
