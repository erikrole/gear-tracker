# Settings P1 fixes — slice plan

Source: `tasks/audit-settings-web.md` (2026-04-25). Ship-bar: 0 P0, 0 student-impact P1.

## Slice 1 — Layout: role-aware tabs + no flicker
- Add `requiredRole` to `SETTINGS_SECTIONS`
- Layout: store role from `/api/me`, filter sections, render shell immediately
- Doc note in AREA_SETTINGS change log
- Build green

## Slice 2 — UI hardening micro-pack
- Categories Add: guard `onBlur` + Enter double-fire
- Database page: don't surface raw `json.error` text
- Escalation: timing column rendered as read-only Badge
- Allowed Emails: claimed-row trash → disabled icon w/ tooltip
- Doc note + build

## Slice 3 — Bookings save discoverability
- Always-render Save button (disabled when clean)
- `useUnsavedGuard` on dirty navigation
- Doc note + build

## Slice 4 — Sports group hint + Kiosk regen
- Sports: hint label "(also affects ...)" near editable fields
- Kiosk: "Regenerate code" on inactive/pending devices
- Doc note + build

## Slice 5 — Rate limiting on settings mutations
- Add per-user rate limiter to allowed-emails / kiosk-devices / categories / calendar-sources / location-mappings / sport-configs / escalation / extend-presets POST/PATCH/PUT/DELETE
- Wire shared helper if not already present
- Doc note + build

## Slice 6 — Doc backfill (Rule 12)
- AREA_SETTINGS.md: add Bookings + Kiosk Devices sub-page sections
- ACs not changing; pure narrative + change log entry
- (Bundled with whichever earlier slice ships first)

## Out of scope (deferred / P2)
- IA changes (locations tab, tab grouping, rename Bookings, search)
- Sports atomic transaction endpoint (needs server refactor)
- Bulk-add allowed emails
- "Last edited by/when" inline audit
- Sidebar density / Categories sort chevron / quiet toasts
