# D-009 Escalation Config — Plan

## Status: Active (2026-03-15)

## Goal
Make escalation schedule admin-configurable with per-booking notification caps.

## Slice 1: Schema + Migration
- [ ] Add `EscalationRule` model: `id`, `hoursFromDue`, `type`, `title`, `notifyRequester`, `notifyAdmins`, `enabled`, `order`
- [ ] Add `SystemConfig` model: `key` (unique), `value` (Json) — for `maxNotificationsPerBooking`
- [ ] Seed default rules matching current hardcoded schedule
- [ ] Run migration

## Slice 2: Service update
- [ ] Read escalation rules from DB instead of hardcoded constant
- [ ] Enforce per-booking cap: count existing notifications for booking, skip if >= max
- [ ] Fix recipient filter: 24h sends to requester + ADMIN only (not STAFF per decision)

## Slice 3: Settings API + UI
- [ ] `GET/POST/PATCH/DELETE /api/settings/escalation` — CRUD for rules
- [ ] `GET/PATCH /api/settings/escalation-config` — system config (cap)
- [ ] Settings page section for escalation rules table + cap input

## Slice 4: Build + verify + docs

## Files Changed
1. `prisma/schema.prisma`
2. `src/lib/services/notifications.ts`
3. `src/app/api/settings/escalation/route.ts` (new)
4. `src/app/(app)/settings/page.tsx` or new escalation settings page
5. `docs/AREA_NOTIFICATIONS.md`
