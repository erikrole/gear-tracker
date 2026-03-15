# CSV Importer Fix — Plan

## Status: Active (2026-03-15)

## Slice 1: Rewrite API with batched DB operations
- [ ] Batch location lookup + createMany for missing
- [ ] Batch department lookup + createMany for missing
- [ ] Batch asset lookup by serialNumber + assetTag (single findMany)
- [ ] Batch asset createMany for new items
- [ ] Batch asset updates via $transaction
- [ ] Kit creation batched
- [ ] Verify ≤20 DB calls total for 181-row CSV

## Slice 2: Column mapping UI
- [ ] New step between Upload and Preview
- [ ] Auto-detect Cheqroom preset headers
- [ ] Dropdown per CSV column → Gear Tracker field
- [ ] Unmapped columns → notes JSON payload
- [ ] Pass mapping to preview + import API calls

## Slice 3: Duplicate detection + re-import safety
- [ ] Preview flags "will create" vs "will update" per row
- [ ] Detect duplicates by assetTag + serialNumber
- [ ] Handle qrCodeValue conflicts on re-import (reuse existing)
- [ ] User choice: skip/update/fail on duplicates

## Slice 4: Build + test with real CSV + docs
- [ ] Test with "Cheqroom Items - Feb 27.csv" end-to-end
- [ ] Build passes
- [ ] Update AREA_IMPORTER.md change log
- [ ] Add D-024 to DECISIONS.md
