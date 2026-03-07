# Checkout UX V2 — Thin Slice 6: Availability & Conflict Visibility

## Plan

### Analysis
- `form-options` currently returns only `status: "AVAILABLE"` assets → picker never sees MAINTENANCE/RETIRED items
- Server already rejects 409 with structured `{ conflicts, shortages, unavailableAssets }` on create
- Client currently shows generic error text on 409 — doesn't parse conflict details
- Battery hint is hardcoded inline — needs refactoring for future extensibility

### Changes
1. **Expand form-options API** — Return all assets (not just AVAILABLE), include `status` in select
2. **Update `AvailableAsset` type** — Add `status` field
3. **Show unavailable items in picker** — MAINTENANCE/RETIRED greyed out with status badge, unclickable
4. **Parse 409 conflict response** — Show specific conflict messages on create failure
5. **Refactor battery hint → generic equipment guidance** — Array of rule objects, extensible
6. **Tests**

### Risks
- Returning all assets increases payload — mitigated by same field selection
- Users might be confused seeing unselectable items — mitigated by clear status badge + opacity

## Tasks
- [ ] Expand form-options to return all assets with status
- [ ] Update AvailableAsset type and picker UI for unavailable items
- [ ] Parse 409 conflict response into specific error messages
- [ ] Refactor battery hint into generic equipment guidance system
- [ ] Add tests
- [ ] Verify build, run tests, commit, push
