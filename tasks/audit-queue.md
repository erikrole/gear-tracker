# Audit Queue

Systematic page-by-page improvement audit using `/audit <target>`.
Check off each page after its audit report is written to `tasks/[page]-audit.md`.
Order is roughly by user-traffic and workflow centrality.

---

## Core Workflows
- [ ] `dashboard` — homepage, highest traffic
- [ ] `checkouts` — primary staff workflow
- [ ] `reservations` — reservation management
- [ ] `bookings` — booking detail view
- [ ] `items` — core entity, heavily referenced
- [ ] `items/[id]` — item detail (large file, known rough edges)
- [ ] `search` — cross-entity lookup

## Schedule & Events
- [ ] `schedule` — shift calendar
- [ ] `events` — event management
- [ ] `events/[id]` — event detail (not yet hardened per schedule-audit)

## Inventory
- [ ] `kits` — kit management
- [ ] `kits/[id]` — kit detail
- [ ] `bulk-inventory` — bulk SKU management
- [ ] `scan` — barcode/QR workflow

## Users & Identity
- [ ] `users` — user management
- [ ] `profile` — user profile

## Admin & Config
- [ ] `settings` — settings root + sub-pages
- [ ] `notifications` — notification center
- [ ] `licenses` — license management
- [ ] `labels` — label printing
- [ ] `import` — data importer
- [ ] `reports` — reporting

## Utilities
- [ ] `guides` — help/guide content

---

## Completed Audits
*(Move entries here with date when report is written)*

---

## Patterns to Propagate
*(Running list of "Raise the Bar" findings across audits — patterns worth adopting everywhere)*
