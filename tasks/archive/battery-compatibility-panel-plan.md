# Battery Compatibility Panel Plan

Status: Shipped
Started: 2026-05-06

## Goal

Add a small operational panel to the Battery Cockpit that tells admins which camera families are below compatible battery threshold.

## Scope

- [x] Reuse the existing battery compatibility rules instead of creating a new schema.
- [x] Extend `GET /api/bulk-skus/batteries` with compatibility health based on current camera inventory and active numbered battery SKUs.
- [x] Render low compatible battery groups on `/bulk-inventory/batteries`.
- [x] Add focused helper tests.
- [x] Sync docs and archive this plan after verification.

## Out Of Scope

- Full battery reporting.
- Unit checkout history pages.
- New camera-to-battery schema.

## Review

Shipped 2026-05-06. The Battery Cockpit now includes a low compatible batteries panel using `getBatteryCompatibilitySummaries()`. The API computes camera-family lows from active, non-retired camera inventory and active numbered battery SKUs. Focused compatibility tests and TypeScript passed before final verification.
