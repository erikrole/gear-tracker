# Battery Bulk Items Hardening Plan - 2026-05-30

## Goal
- Make battery bulk-item operations trustworthy under counter pressure: live counts, quantity-first picker behavior, scan-bound custody, and fast audited adjustment without inventory drift.

## Source Checks
- `AGENTS.md`: non-trivial work needs a plan, thin independently testable slices, verification before done, `npm run build` before ship, shadcn UI for any UI edits, and docs synced with shipped functionality.
- `docs/AREA_BULK_INVENTORY.md`: Battery Ops is the staff/admin cockpit. Numbered battery availability derives from `BulkSkuUnit.status = AVAILABLE`; quantity-only availability derives from `BulkStockBalance.onHandQuantity`; read models must not subtract active checkout quantities again.
- `docs/AREA_ITEMS.md`: item families are normal `/items` rows backed by `BulkSku`; Units means one catalog row with numbered/scannable units underneath, not one row per battery.
- `docs/AREA_CHECKOUTS.md`: picker remains quantity-first for numbered batteries; exact units are scanned at kiosk pickup; cancellation restores held bulk stock and releases scanned numbered units.
- `docs/AREA_KIOSK.md`: iOS kiosk is canonical for pickup/return. Numbered battery unit scans use `{binQrCodeValue}-{unitNumber}`; pickup binds the unit, return verifies the checked-out unit.
- `docs/DECISIONS.md` D-022: `BulkSku` and `BulkSkuUnit` are the model. Unit status is stored directly, unit numbers are permanent, and checked-out units cannot be marked lost/retired until check-in.
- `docs/GAPS_AND_RISKS.md`: GAP-37 is closed for battery reporting. Current work should not reopen location-aware Bulk Items V2 or battery reporting scope unless a new gap is proven.
- `prisma/schema.prisma`: `BulkSku` owns location and bin QR; `BulkStockBalance` stores on-hand quantity; `BulkSkuUnit` has no location and stores status; `BookingBulkUnitAllocation` stores checked-out and checked-in timestamps.
- `src/app/api/form-options/route.ts`: picker receives bulk family counts from this route. It currently computes numbered `availableQuantity` from available units and quantity `currentQuantity` from balances.
- `src/app/api/bulk-skus/batteries/route.ts`: Battery Ops computes counts from `BulkSkuUnit.status`, checked-out age from open allocations, and compatibility lows from `src/lib/battery-compatibility.ts`.
- `src/app/api/assets/route.ts`, `src/app/api/bulk-skus/route.ts`, and `src/app/api/bulk-skus/[id]/route.ts`: `/items`, item-family list, and item-family detail already use no-store responses and derive numbered availability from unit status.
- `src/components/EquipmentPicker.tsx`: bulk rows cap requested quantity at `getBulkAvailable(sku)` and display "units scan at pickup" for unit-tracked families.
- `src/lib/services/bulk-unit-scans.ts`: pickup/return already distinguish wrong family, duplicate scan, checked out elsewhere, missing/retired, not on booking, and quantity-exceeded cases.
- `tasks/archive/bulk-battery-hardening-plan.md`, `tasks/archive/completed-2026-06/battery-follow-through-plan-2026-05-13.md`, `tasks/archive/completed-2026-06/battery-ops-empty-state-plan-2026-05-20.md`, and `tasks/bulk-items-v2-plan.md`: prior battery work settled quantity-first picker and kiosk-bound unit custody. The location-aware Bulk Items V2 plan is not approved for this pass and conflicts with the current schema because `BulkSkuUnit` has no `locationId`.

## Slices
- [x] Slice 1: Live count read paths
  - [x] Remove stale browser caching from Battery Ops and form-options bulk count responses.
  - [x] Add route-level tests proving count responses are `private, no-store` and still derive numbered counts from `BulkSkuUnit.status = AVAILABLE`.
  - [x] Confirm `/items`, `/bulk-skus`, and item-family detail already follow the same authoritative count semantics.
- [x] Slice 2: Picker stale-count recovery
  - [x] Audit and harden `EquipmentPicker` bulk quantity rows so selected battery quantities clamp down if the latest available count drops below the selected quantity.
  - [x] Show explicit stale-count recovery copy when a selected bulk family becomes unavailable or over-selected.
  - [x] Preserve the existing quantity-first copy: exact units scan at kiosk pickup.
- [x] Slice 3: Scan custody hardening
  - [x] Expand focused service tests around `scanKioskPickupBulkUnit` and `scanKioskCheckinBulkUnit` for missing/retired, not-on-booking, quantity-exceeded, duplicate, and wrong-family paths.
  - [x] Audit iOS kiosk copy and API payloads for unreadable-label/scanner-failure recovery without allowing unscanned unit custody to silently pass.
- [x] Slice 4: Fast adjustment workflow
  - [x] Audit Battery Ops and item-family detail adjustment controls.
  - [x] Add or improve fast staff actions for unit add, mark missing, retire, release, and quantity-only adjustments with reason/audit trail.
  - [x] Show count impact before confirmation and refresh affected counts after mutation.
- [ ] Slice 5: Docs and verification
  - [x] Update `docs/AREA_BULK_INVENTORY.md`, `docs/AREA_CHECKOUTS.md`, and `docs/GAPS_AND_RISKS.md` only for shipped behavior or newly proven gaps.
  - [x] Update kiosk/mobile docs for typed-code scan recovery.
  - [ ] Add the review section and move this plan to `tasks/archive/` only after all slices ship.

## Verification
- [x] `npx vitest run tests/form-options-bulk-counts.test.ts tests/battery-ops-route.test.ts`
- [x] `npx vitest run tests/form-options-bulk-counts.test.ts tests/battery-ops-route.test.ts tests/equipment-picker-bulk-quantity-recovery.test.ts`
- [x] `npx vitest run tests/bulk-unit-kiosk-scans.test.ts`
- [x] `npx vitest run tests/bulk-unit-kiosk-scans.test.ts tests/kiosk-bulk-detail-routes.test.ts`
- [x] `npx vitest run tests/api-assets-item-families.test.ts tests/availability.test.ts tests/availability-route.test.ts`
- [x] `npx vitest run tests/form-options-bulk-counts.test.ts tests/battery-ops-route.test.ts tests/equipment-picker-bulk-quantity-recovery.test.ts tests/bulk-unit-kiosk-scans.test.ts tests/kiosk-bulk-detail-routes.test.ts tests/api-assets-item-families.test.ts tests/availability.test.ts tests/availability-route.test.ts tests/bulk-unit-adjustment-routes.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [ ] `npm run build` (blocked locally because the script runs remote Neon migration deploy first; escalation was rejected to avoid mutating shared database state)
- [x] `npx next build`
- [x] Browser smoke for `/checkouts/new`, `/items?type=unit-tracked`, and `/bulk-inventory/batteries`
- [x] XcodeBuildMCP `build_sim` for `Wisconsin`, Debug, iPad Pro 13-inch (M5), iOS Simulator
- [x] `npm run drift:ios`

## Stop Conditions
- Stop and re-plan if live counts require unit-level location transfer or any schema change that adds `locationId` to `BulkSkuUnit`.
- Stop and re-plan if the picker requires blocking compatible-battery checkout creation; current decision says compatibility warnings are advisory.
- Stop and re-plan if scanner failure recovery would let a checkout open or complete without either a scanned unit or a staff-audited exception.
- Stop and re-plan if existing dirty booking-create changes conflict with the battery picker edits.

## Review
- Shipped: live no-store count responses for `/api/form-options` and `/api/bulk-skus/batteries`; picker bulk quantity recovery clamps or removes stale selected quantities when refreshed availability drops; selected bulk shelf now shows requested versus available counts while preserving "units scan at pickup" copy; scan-service regressions cover over-quantity, missing-unit pickup, not-checked-out return, and already-returned return paths; iOS kiosk camera fallback now has typed-code recovery for unreadable labels and scanner/camera failure while still using exact scan APIs; Battery Ops now supports audited add-unit, unit status, and quantity-tracked battery adjustment flows with before/after count impact.
- Verified: `npx vitest run tests/form-options-bulk-counts.test.ts tests/battery-ops-route.test.ts`, `npx vitest run tests/form-options-bulk-counts.test.ts tests/battery-ops-route.test.ts tests/equipment-picker-bulk-quantity-recovery.test.ts`, `npx vitest run tests/bulk-unit-kiosk-scans.test.ts`, the combined focused battery/count/availability suite covering 8 files and 50 tests, `npx vitest run tests/bulk-unit-adjustment-routes.test.ts tests/battery-ops-route.test.ts`, the expanded focused battery/count/availability/adjustment suite covering 9 files and 54 tests, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, XcodeBuildMCP iOS simulator build, and `npm run drift:ios`.
- Deferred: required `npm run build` with explicit remote migration approval, and archiving the plan.
