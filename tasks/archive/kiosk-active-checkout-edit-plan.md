# Kiosk Active Checkout Edit Plan

Created: 2026-06-22

## Slice Goal
Let the native kiosk edit an already-active checkout at the gear counter: update booking details, scan an additional item into custody, or remove an item from custody.

## Guardrails
- Mutations are kiosk-authenticated only.
- Only `OPEN` `CHECKOUT` bookings at the current kiosk location are editable.
- Add/remove runs inside a `SERIALIZABLE` transaction and writes audit entries.
- Adding scanned items reuses existing kiosk scan resolution and availability rules.
- Removing returned items is blocked.
- Pickup and return detail consumers keep decoding older payloads safely.

## Tasks
- [x] Add kiosk route schemas for active checkout update/add/remove.
- [x] Add mutation handling under `/api/kiosk/checkout/[id]`.
- [x] Extend kiosk API client and models with editable fields and mutation methods.
- [x] Add active-checkout drawer edit controls for title, due-back, scan-add, and remove.
- [x] Add focused route/source contract coverage.
- [x] Sync docs and lessons.
- [x] Run verification gates and install on the iPad if connected.

## Review
- 2026-06-22: Active checkout edit slice shipped locally and installed on the connected iPad Pro 10.5. The kiosk detail drawer can update title and due-back time, add one scanned item, and remove one unreturned active item. Backend mutations are kiosk-authenticated, location-scoped to OPEN CHECKOUT bookings, SERIALIZABLE, availability-checked, allocation/bulk-status aware, and audited. Verification passed with TypeScript, focused kiosk/iOS contract tests, iOS drift, iOS audit gaps, docs/codemap check, diff whitespace, WisconsinKiosk simulator build, Wisconsin simulator build, WisconsinKiosk generic iOS device compile, signed device build, normal device install, and launch.
