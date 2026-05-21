# Plan: Persistent Event Edits + Soft Archive

**Area:** Events (`docs/AREA_EVENTS.md`)
**Created:** 2026-05-21
**Status:** Shipped 2026-05-22

## Goal

Three related capabilities on `CalendarEvent`, all of which must survive ICS re-sync:

1. **Edit event title** — manual title that the daily sync won't clobber.
2. **Toggle home/away/neutral** — manual override of the parsed `isHome` value.
3. **Archive past events** — soft-archive events aged past a retention window, keeping
   all data for a future "Wrapped"-style stats feature. Never hard delete.

## Audit findings (grounding)

- `CalendarEvent.isHome Boolean?` already encodes three states: `true`=home, `false`=away,
  `null`=neutral. Set during sync in `extractSportInfo` ([src/lib/services/calendar-sync.ts](../src/lib/services/calendar-sync.ts)).
- `CalendarEvent.rawSummary` already persists the **original ICS title**; `summary` holds
  the cleaned/display title. This means revert-to-synced needs no extra storage.
- The sync diff at [calendar-sync.ts ~419](../src/lib/services/calendar-sync.ts) compares
  `summary` and `isHome`, so both get **overwritten on every sync** unless guarded.
  (`isHidden` survives only because it is absent from that diff.)
- Only `GET` exists on [src/app/api/calendar-events/[id]/route.ts](../src/app/api/calendar-events/[id]/route.ts).
  The pattern to copy for a guarded, audited write is the sibling
  [visibility/route.ts](../src/app/api/calendar-events/[id]/visibility/route.ts)
  (staff/admin gate, zod `.strict()`, `createAuditEntryTx`).
- `morning-refresh` cron already (a) runs ICS sync and (b) soft-archives `ShiftGroup`
  via `archivedAt`. `archivedAt DateTime?` is the **established archive convention** here,
  and the cron comment already states "archiving only sets archivedAt so records remain
  visible." Event archiving attaches to this existing job — **no new cron**.
- `/events` list page was removed; management lives on `/schedule`. The deep-dive surface
  `/events/[id]` is unchanged and is where the edit controls belong.

## Design decision: lock flags (not override columns)

Earlier I suggested a `titleOverride` column. Since `rawSummary` already keeps the original,
a **lock flag** is lower-surface and unifies title + home/away:

- `summaryLocked Boolean` — when true, sync preserves `summary` (display sites unchanged).
- `isHomeLocked Boolean` — when true, sync preserves `isHome`.
- Revert = clear the lock; next sync re-derives from `rawSummary` (or compute inline on revert).

Tradeoff vs override columns: with a lock, the live `summary` is the edited value and the
synced value is only recoverable by re-deriving from `rawSummary`. That is acceptable because
`rawSummary` is always retained. Benefit: zero changes to the many sites that read
`event.summary` for display.

## Retention policy

- `EVENT_ARCHIVE_MONTHS = 4` (inside the 3–6 month ask). Single named const, easy to tune.
- Archive = `endsAt < now - 4 months` AND `archivedAt IS NULL`. Set `archivedAt = now`.
- Archiving is **non-destructive**: no row/relation deletion. Bookings, `BookingEvent`,
  travel rosters, shift groups all remain intact for the future Wrapped feature.

### List visibility semantics (must be explicit)

- Default: upcoming, non-archived.
- `includePast=true`: include past events that are **not** archived (recent history).
- `includeArchived=true`: also include archived (aged-out) events.

This keeps `/schedule` fast and uncluttered while preserving deep history for stats.

---

## Slices (one PR each, per Thin Slice Protocol)

### Slice 1 — Schema/migration
Add to `CalendarEvent` in `prisma/schema.prisma`:
- `summaryLocked Boolean @default(false) @map("summary_locked")`
- `isHomeLocked  Boolean @default(false) @map("is_home_locked")`
- `archivedAt    DateTime? @map("archived_at")`
- `@@index([archivedAt])`

Run `npm run db:migrate:new -- --name add_event_edit_locks_and_archive`. Commit the
generated migration dir. (Next prefix after `0069`.)

### Slice 2 — Sync guard (preserve locked fields)
In `buildSyncPlan` ([calendar-sync.ts](../src/lib/services/calendar-sync.ts)):
- Add `summaryLocked, isHomeLocked` to the `existing` row select.
- When `existing.summaryLocked`, set `data.summary = existing.summary` and drop `summary`
  from the `changed` comparison.
- When `existing.isHomeLocked`, set `data.isHome = existing.isHome` and drop `isHome`
  from the `changed` comparison.
- Unlocked fields keep syncing exactly as today.

### Slice 3 — Edit API (title + home/away)
Add `PATCH` to [calendar-events/[id]/route.ts](../src/app/api/calendar-events/[id]/route.ts),
mirroring the visibility route (staff/admin gate, zod `.strict()`, audited in a `$transaction`):
- `summary?: string` (1–200 chars) → sets `summary` + `summaryLocked = true`.
- `isHome?: boolean | null` → sets `isHome` + `isHomeLocked = true`.
- `revertTitle?: true` → `summaryLocked = false`, recompute `summary` from `rawSummary`.
- `revertHomeAway?: true` → `isHomeLocked = false`, recompute `isHome` from `rawSummary`/location.
- One audit entry per change with before/after.

### Slice 4 — Archive: cron step + list filter
- `morning-refresh` ([route.ts](../src/app/api/cron/morning-refresh/route.ts)): add a step
  that `updateMany` sets `archivedAt = now` where `endsAt < now - EVENT_ARCHIVE_MONTHS` and
  `archivedAt IS NULL`. Return the count in the job summary. Define the const near the job
  or in a shared lib.
- List API ([calendar-events/route.ts](../src/app/api/calendar-events/route.ts)): add
  `includeArchived` param; default `where` excludes archived (`archivedAt: null`).
  Confirm `includePast` keeps `archivedAt: null` so recent-past stays clean.

### Slice 5 — UI
- **Event detail** `/events/[id]`: inline title edit (pencil → input, save/cancel) and a
  Home/Away/Neutral segmented control. Show an "edited" indicator + "revert to synced" when
  a field is locked. Use existing shadcn primitives (Input, ToggleGroup/SegmentedControl,
  Button). Wire to the Slice 3 PATCH; refetch via the page's `useFetch`.
- **Schedule** `/schedule`: add a "Show archived" filter alongside the existing past-events
  filter; pass `includeArchived` through to the list query.

### Slice 6 — Tests
- Sync guard: locked `summary`/`isHome` survive a re-sync that would otherwise change them;
  unlocked fields still update.
- PATCH: RBAC (student denied), validation, audit written, revert re-derives from `rawSummary`.
- Archive cron: ages out events older than the window, preserves recent + all relations,
  is idempotent (re-run doesn't re-stamp).

### Slice 7 — Docs (same-commit on ship, rule 12)
- `docs/AREA_EVENTS.md`: Now + Change Log entries; note manual-edit + archive behavior.
- `docs/GAPS_AND_RISKS.md`: note the audit-table-style retention now also covers events;
  add "Wrapped stats" as a Later dependency that relies on non-destructive archive.
- `tasks/lessons.md` if anything surfaces.
- Move this plan to `tasks/archive/` when all slices ship.

## Out of scope
- The "Wrapped"-style stats feature itself (separate future build). This plan only
  guarantees the data it needs is preserved.
