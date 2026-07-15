# Battery Family Consolidation Plan - 2026-07-15

## Goal
- Make the active battery catalog contain exactly four unit-tracked item families: `Monitor Battery`, `Sony Battery`, `Gold Mount Battery`, and `FX6 Battery`.
- Remove quantity-tracked and serialized battery rows from active discovery without destroying booking, custody, scan, movement, or audit history.

## Route
- Owner area: Items and Bulk Inventory
- Ledger: this plan; archive after live consolidation, verification, and documentation closeout.
- Existing plan/archive references: `tasks/monitor-battery-product-family-plan.md`, D-022, and `tasks/bulk-battery-followups.md`.

## Source Checks
- Live read-only evidence on 2026-07-15 found nine item-family battery rows, eight active and one inactive, plus active and retired serialized battery rows.
- `Sony Battery` is already the established numbered family with 52 permanent unit records, including printed placeholders, 31 booking rows, 74 unit allocations, 105 movements, and two scans. It remains the canonical Sony target unchanged.
- `Monitor Battery` is quantity-tracked with 14 on hand and no history. `Watson NP-F550` has four available numbered units and no history. The serialized `Monitor Battery` row has no history.
- The two Gold Mount families contain two and eight available numbered units. The eight-unit Anton/Bauer Dionic family has booking, allocation, and movement history, so it is the canonical target. The active serialized Dionic row has historical booking, allocation, and scan evidence and must be retired rather than hard-deleted.
- The BP-U35 and BP-U70 families contain four and eight available numbered units with no history. They can be combined into one `FX6 Battery` family with permanent units 1 through 12. The serialized BP-U35 row has no history.
- The active 64-count Panasonic AA family has no booking, movement, scan, kit, or numbered-unit history and is outside the requested four-family battery catalog.
- Migrations `0092_profile_completion_fields` and `0093_item_family_products` are applied in the live database.

## Deletion Contract
- “Delete from the battery catalog” means hard-delete only when a row has no operational history and no dependent records.
- History-bearing serialized batteries are retired with collision-free retired scan values and all availability flags disabled.
- History-bearing superseded item families are deactivated after their units and future booking ownership are consolidated. Historical booking rows remain attached to their original family.
- Permanent numbered units are moved, never recreated when a source unit already exists. Product identity is stored through `BulkSkuProduct` and `BulkSkuUnit.productId` when known.

## Stop Conditions
- Stop if any source family, serialized battery, unit count, balance, QR value, label state, allocation count, or history count differs from the audited state.
- Stop if any source unit is checked out, lost, or actively allocated.
- Stop if the active Sony family is not the existing `94e068d1` family or its 52 permanent unit records have changed.
- Stop if the final names would collide with another active item family or if the target location differs.
- Stop instead of hard-deleting any row with operational history.

## Slices
- [x] Slice 1: Add a dry-run-first, exact-state-guarded four-family consolidation script.
- [x] Slice 2: Consolidate Monitor, Gold Mount, and FX6 units; preserve Sony; retire or deactivate history-bearing duplicates; hard-delete only history-free obsolete rows.
- [x] Slice 3: Verify the live active battery catalog contains exactly the four requested unit-tracked families with correct balances, units, products, and scan identities.
- [x] Slice 4: Update D-022, area docs, gaps, task ledgers, tests, and codemaps to match live reality.

## Verification
- [x] Script dry run reports the exact planned mutations and zero blockers.
- [x] Apply writes a local proof artifact before mutation and runs in one serializable transaction.
- [x] Post-apply read-only live audit proves exactly four active unit-tracked battery families.
- [x] Focused script/source-contract tests
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for touched source
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated browser smoke not required for this data-only mutation; independent live database verification covered catalog, units, products, active serialized rows, retained history rows, and audit entries.

## Review
- Shipped: The live active battery catalog now contains exactly `Monitor Battery`, `Sony Battery`, `Gold Mount Battery`, and `FX6 Battery`, all unit-tracked. History-free obsolete families and serialized rows were deleted; history-bearing rows were retired or deactivated.
- Verified: Zero-blocker dry run, serializable apply, independent live audit, idempotent post-apply dry run, 49 focused tests, TypeScript, focused ESLint, codemap/docs verification, diff hygiene, and application build.
- Deferred: Physical product assignment for Monitor Battery units 1-14 and printing the new Monitor, Gold Mount, and FX6 unit labels.
- Blocked: None for the requested singular catalog.
- Proof artifacts: `.tmp/battery-family-consolidation-1784148055331.json`, 13 live consolidation audit rows, `scripts/consolidate-battery-families.mjs`, and `tests/battery-family-consolidation-script.test.ts`.
- Next slice or stop: Stop software work. Staff should physically identify Monitor units 1-14, assign Watson NP-F770 or GVM products, and print the derived QR labels for the three newly consolidated sequences.
