# Audit: search (iOS) - 2026-07-03

**MVP verdict:** READY - 0 P0, 0 P1 open for typed Search
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** source audit plus simulator screenshots

## P0 - blocks MVP

_None._

## P1 - polish before ship

- [x] [Flows] Typed Search still surfaced attachment/accessory rows for normal item queries.
      `ios/Wisconsin/Core/SearchService.swift`
      Why it mattered: attachments should stay out of normal item browsing/search and remain reachable through QR/direct lookup recovery.
      Fix: typed Search filters attachment/accessory categories for serialized assets and item families; direct scan lookup bypasses the filter.

## P2 - post-MVP

- [ ] [Hardening] Native Search still treats fan-out failures as one error. Web Search supports partial results per source; consider bringing that behavior to native after the screen inventory pass.

## Acceptance criteria status

- [x] Search tab presents the system search field and keyboard on open.
- [x] Typed search fans out to items, item families, bookings, and users.
- [x] Typed item results hide attachment/accessory categories.
- [x] QR/direct scan recovery remains allowed to resolve child attachments.
- [x] Result rows navigate to detail destinations.

## Runtime proof

- [x] Search keyboard-open screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_bd11aa33-51b7-4291-8bea-64728d1d0b44.jpg`
- [x] Typed `fx3` Search after attachment filtering: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_c23366e4-8b5c-4ec1-96df-48ae068250ee.jpg`

## Lenses checked

- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity
- [x] Accessibility

## Files read

- `docs/AREA_MOBILE.md`
- `docs/AREA_SEARCH.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift`
- `ios/Wisconsin/Views/Search/QRScannerSheet.swift`
- `ios/Wisconsin/Core/SearchService.swift`
- `ios/Wisconsin/Core/APIClient.swift`
- `ios/Wisconsin/Models/AssetModels.swift`
- `tasks/audit-scan-ios.md`
- `tasks/audit-all-pages-ios.md`
