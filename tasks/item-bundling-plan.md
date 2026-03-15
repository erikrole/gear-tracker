# Item Bundling (Accessories) — Plan

## Status: Active (2026-03-15)

## Slice 1: Schema + migration
- [ ] Add `parentAssetId` nullable self-ref FK on Asset model
- [ ] Add `parent`/`children` relations on Asset
- [ ] Write migration SQL
- [ ] Run prisma generate

## Slice 2: API — accessories endpoint + list filtering
- [ ] GET /api/assets/[id] — include children (accessories) in response
- [ ] POST /api/assets/[id]/accessories — attach accessory (set parentAssetId)
- [ ] DELETE /api/assets/[id]/accessories/[childId] — detach accessory
- [ ] PATCH /api/assets/[id]/accessories/[childId] — move to different parent
- [ ] GET /api/assets — exclude children by default, add `showAccessories` filter
- [ ] Permissions: staff+ for attach/detach/move

## Slice 3: Item detail page — accessories section
- [ ] Accessories section below existing info
- [ ] List child items with status badge
- [ ] "Attach accessory" button → search picker for unlinked items
- [ ] "Detach" per-row action
- [ ] Maintenance warning badge on parent if any accessory is in MAINTENANCE

## Slice 4: Items list — hide children + filter
- [ ] Default query excludes items with parentAssetId
- [ ] Add "Show accessories" filter toggle
- [ ] Child items in list show "Accessory of [Parent]" subtitle

## Slice 5: Scan integration + build + docs
- [ ] Scanning child QR shows "This is an accessory of [Parent Name]"
- [ ] Build passes
- [ ] Update AREA_ITEMS.md change log
- [ ] Add D-023 to DECISIONS.md
