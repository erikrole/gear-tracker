# Bulk Battery Hardening Cleanup - 2026-05-05

Archived from `tasks/todo.md` on 2026-06-19.

## Completed Work
- [x] **Kiosk-scanned numbered batteries** - Battery booking stays quantity-based at creation, then kiosk pickup and return bind or release specific numbered units through unit QR scans.
- [x] **Kiosk battery client and labels** - iOS kiosk pickup and return checklists include numbered battery units, pickup confirm blocks until planned units are scanned, and labels emphasize scannable unit identity.
- [x] **Battery Unit Cockpit** - `/bulk-inventory/batteries` gives staff/admin an operations surface for active battery families, unit status counts, low-stock signals, checked-out aging, booking/requester context, and audited unit actions.
- [x] **Kiosk battery mismatch polish** - Pickup and return distinguish wrong battery type, duplicate scans, units checked out elsewhere, units not checked out on the booking, and missing/retired units.
- [x] **Battery compatibility lows** - Battery Ops flags low compatible battery families by matching active camera inventory against compatibility rules.
- [x] **Kiosk explicit battery scan step** - Kiosk checkout detail now identifies numbered battery rows and exposes scan-summary counts; iOS pickup and return screens show dedicated numbered-battery scan progress.
- [x] **Booking-create battery guidance polish** - EquipmentPicker recommends compatible battery families when cameras are selected, keeps selection quantity-first, labels selected item-family quantities as requested, and reminds staff exact units scan at kiosk pickup.
- [x] **Attachment management polish** - Camera attachment add, detach, and move-parent flows were polished while keeping slot identity display-only.
- [x] **Battery audit/reporting** - Missing Units reports missing batteries by unit, missing rate by family, unit checkout history, repeated missing patterns, and battery-report evidence exports.
- [x] **Battery bulk items hardening** - Live no-store count responses, stale-count recovery, custody scan regressions, typed-code recovery, and audited battery adjustment flows shipped.

## Moved To Future Follow-up
- Kiosk admin override visibility.
- Booking-create optional gear suggestions.
- Inventory health dashboard.
- Attachment slot schema decision.
- Templates/presets.
- Database-configurable equipment guidance rules.

Follow-up plan: `tasks/bulk-battery-followups.md`.

## Verification Evidence
- `tasks/archive/completed-2026-06/battery-follow-through-plan-2026-05-13.md` recorded passing kiosk detail and bulk-unit scan tests, TypeScript, migration-prefix check, whitespace check, Next build, and iOS simulator build for the explicit scan step.
- `tasks/archive/completed-2026-06/battery-bulk-items-hardening-plan-2026-05-30.md` recorded passing focused count, picker, scan, availability, adjustment, TypeScript, migration-prefix, whitespace, Next build, browser smoke, iOS simulator, and iOS drift checks. `npm run build` stayed blocked because it runs remote migration deploy first.
- `docs/AREA_KIOSK.md`, `docs/AREA_CHECKOUTS.md`, `docs/AREA_BULK_INVENTORY.md`, `docs/AREA_REPORTS.md`, and `docs/GAPS_AND_RISKS.md` document the shipped battery scan, picker, operations, and reporting behavior.
