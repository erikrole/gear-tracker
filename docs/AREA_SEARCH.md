# Search Area Scope

## Document Control
- Area: Search
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-21
- Status: Active
- Version: V1

## Direction
Make search a fast operational jump layer. It should find records when the user knows an identity, and destinations when the user knows an intent.

## Surfaces

### Quick Search Palette
- Opens from the top bar, mobile search button, `Cmd/Ctrl+K`, or type-to-search outside form controls.
- Searches role-visible pages, settings, reports, items, active checkouts, active reservations, and users.
- Page results are role-aware:
  - Everyone can find core app pages and personal settings.
  - Staff/admin can find staff tools, reports, and system settings.
  - Admin-only destinations stay hidden from staff/student search.
- Entity search fans out to existing list APIs:
  - `/api/assets`
  - `/api/checkouts`
  - `/api/reservations`
  - `/api/users`
- Partial endpoint failures show available matches instead of wiping the palette.
- Empty copy tells operators what to try: tag, borrower, page name, setting, or report.

### Full Search Page
- `/search?q=...` provides a larger result review surface for the same record categories plus role-visible page destinations.
- The page preserves query state in the URL.
- It uses the same partial-failure behavior as the quick palette.

## Rules
1. Search must never expose navigation targets the current role cannot use.
2. Active booking search should prefer current operational states, not completed/cancelled history.
3. Search result titles should not render empty metadata placeholders.
4. A failure from one record source should not hide successful results from another source.
5. The full search page and quick palette should not disagree on destination search.

## Change Log
- 2026-05-21: Global search MVP hardening. Quick search now includes role-aware page/settings/report destinations, uses partial-result handling across the four entity endpoints, explains empty searches with concrete examples, and keeps `/search` aligned with the same page-result catalog and failure semantics. Added regression coverage for role-visible page search.
