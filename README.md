# Creative Ops

Internal camera equipment management app with:

- Serialized asset reservations and checkouts
- Hard-stop QR scan enforcement for checkout/check-in
- Bulk inventory pools via bin QR + quantity
- Calendar visibility

## Stack

- Next.js (App Router, TypeScript)
- PostgreSQL
- Prisma ORM
- Argon2 password hashing
- Vitest unit tests

## Quick Start

1. Copy env template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. Apply manual PostgreSQL exclusion constraint migration if needed:

```bash
psql "$DATABASE_URL" -f prisma/migrations/0001_manual_constraints/migration.sql
```

5. Start the app:

```bash
npm run dev
```

## API Coverage

Implemented endpoints from the delivery plan:

- Auth: login/logout/me
- Assets: list/create/get/update/import
- Availability check: serialized conflicts + bulk shortages
- Reservations: list/create/update/cancel
- Checkouts: list/create/start scan/scan/complete checkout/check-in/override
- Bulk SKU inventory: list/create/adjust
- Calendar: date range + filters

## Conflict Prevention

Serialized assets are protected in two layers:

1. Transaction-level availability check (`startsAt < endsAt` overlap logic)
2. PostgreSQL exclusion constraint on `asset_allocations`

## Notes

- This repo is backend-first and API complete for v1 contracts.
- UI components are intentionally minimal so your team can layer preferred UX rapidly.


## Team Workflow (Codex + Claude)

We use a dual-agent workflow for implementation and handoff. See `docs/AI_COLLABORATION.md` for branch strategy, handoff contract, validation expectations, and conflict-avoidance conventions.

