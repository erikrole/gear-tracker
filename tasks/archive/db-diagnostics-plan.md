# DB Diagnostics Endpoint — Plan

**Issue**: #310 — `_prisma_migrations` table missing causes opaque errors in Neon console
**Goal**: Build `GET /api/db-diagnostics` that surfaces schema health at a glance

## Checks

1. **Migration table** — Does `_prisma_migrations` exist? List applied migrations.
2. **Tables** — Which expected tables exist vs missing?
3. **Enums** — Which expected enums exist vs missing?
4. **Key columns** — Spot-check critical columns on `assets`, `bookings` to detect drift.
5. **Extensions** — Is `btree_gist` installed? (needed for allocation exclusion constraint)

## Output Shape

```json
{
  "ok": true/false,
  "checks": {
    "migrationTable": { "exists": true, "migrations": [...] },
    "tables":         { "present": [...], "missing": [...] },
    "enums":          { "present": [...], "missing": [...] },
    "columns":        { "drift": [] },
    "extensions":     { "present": [...], "missing": [...] }
  },
  "remediation": ["Run prisma migrate deploy", ...]
}
```

## Constraints
- Admin-only (requireAuth + role check)
- Edge-compatible (raw SQL via Prisma, no Node APIs)
- Single DB round-trip where possible (batch queries)
- Read-only — no writes

## Slice
- Single file: `src/app/api/db-diagnostics/route.ts`
