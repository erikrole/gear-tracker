# Scan Result Hero Card (iOS)

Make the scan result sheet richer when a scan resolves to exactly one match:
hero image, status badge, prominent unit number, availability stats, holder +
due info, and quick actions. Decisions (user-confirmed 2026-06-11):

- Rich hero card for single-match scans only; multi-match keeps compact rows.
- Remove the single-asset fast path (direct push to Item Detail); single
  serialized assets also show the rich sheet, with "View item" tap-through.
- Card content: availability stats, holder + due date, quick actions.
- No bulk-SKU detail screen exists on iOS, so the family card has no
  "View item" push -- the card is the destination.

## Slices

- [x] `ScanResultHeroCard.swift` -- hero card views (asset + family variants),
      shared hero image, stat tiles, holder section
- [x] `ScanView.swift` -- drop fast path, route single matches to hero card
- [x] `xcodegen generate` + restore Wisconsin.entitlements
- [x] Build verification (xcodebuild)
- [x] Doc sync (AREA change log, archive this plan)
