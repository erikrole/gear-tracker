# Kiosk Active Checkout Item Editing

## Goal

Make equipment changes on an existing open kiosk checkout scanner-first and touch-friendly.

## Scope

- Automatically arm HID scanner capture while an editable active-checkout detail sheet is open.
- Submit each completed scan directly to the existing kiosk add-item mutation.
- Remove the visible scan-value text field and extra Add tap from the primary workflow.
- Render outstanding serialized assets and numbered bulk units as individually removable rows.
- Use a native destructive confirmation before removing custody from the checkout.
- Preserve the existing kiosk-authenticated, location-scoped, serializable, availability-checked, audited API contract.

## Out Of Scope

- Scanning an item to remove it.
- Adding quantity-only bulk stock that has no numbered unit identity.
- Changing the new-checkout scan flow, return flow, schema, or booking lifecycle.

## Checklist

- [x] Rework the active-checkout detail sheet around automatic scan-to-add.
- [x] Expose exact touch removal for each active serialized asset and numbered unit.
- [x] Update source-contract coverage for scanner ownership and removal UI.
- [x] Sync kiosk/mobile docs and task lessons.
- [x] Run focused tests, iOS drift/gap checks, docs verification, and the kiosk Xcode build.
- [ ] Confirm direct scan-to-add and exact touch removal on the managed M2 iPad Air kiosk with its paired scanner.

## Review

- 2026-07-09: Implemented automatic HID scan ownership in the active-checkout sheet, removed the scan-value field and Add button, and changed equipment editing to exact per-item rows with native destructive removal confirmation. Verification passed: focused Vitest (3 files, 21 tests), full Vitest (308 files, 1,866 tests), TypeScript, iOS drift/gap audits, docs/codemaps, whitespace, `npm run build:app`, and escalated `npm run ios:xcode:verify:kiosk` simulator plus generic iOS builds. The full-suite run also exposed and corrected three stale test expectations for the already-shipped pending-pickup owner-transfer action without changing product behavior. Managed M2 iPad Air hardware confirmation remains open.
