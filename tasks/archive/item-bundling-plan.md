# Item Bundling (Accessories) — Plan

## Status: Complete (2026-03-16)

## Slice 1: Schema + migration ✅
- [x] Add `parentAssetId` nullable self-ref FK on Asset model
- [x] Add `parent`/`accessories` relations on Asset
- [x] Write migration SQL (0009_item_bundling)
- [x] Run prisma generate

## Slice 2: API — accessories endpoint + list filtering ✅
- [x] GET /api/assets/[id] — include accessories + parentAsset in response
- [x] POST /api/assets/[id]/accessories — attach accessory (set parentAssetId)
- [x] DELETE /api/assets/[id]/accessories — detach accessory
- [x] PATCH /api/assets/[id]/accessories — move to different parent
- [x] GET /api/assets — exclude children by default, add `show_accessories` filter
- [x] Permissions: staff+ for attach/detach/move
- [x] Accessory count (_count.accessories) included in list response

## Slice 3: Item detail page — accessories section ✅
- [x] Accessories section below existing info on Info tab
- [x] List child items with brand/model
- [x] "Attach" button → search picker for unlinked items
- [x] "Detach" per-row action with confirmation dialog
- [x] Parent banner shown when viewing an accessory item

## Slice 4: Items list — hide children + filter ✅
- [x] Default query excludes items with parentAssetId
- [x] Accessory count badge (+N) shown on parent items in list

## Slice 5: Scan integration + build + docs ✅
- [x] Scanning child QR shows "Accessory of [Parent]" in scan preview sheet
- [x] Build passes
- [x] Update docs
