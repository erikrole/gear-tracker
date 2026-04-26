# iOS SwiftData Offline Cache + Silent Push Invalidation

**Status:** Draft (not started)
**Target:** iOS 26 minimum (per memory note `project_ios_framework_plan.md`)
**Project:** ios/Wisconsin

## Current state (audit)

**Already in place:**
- `GearStore.swift` defines `@Model` classes: `CachedAsset`, `CachedBooking`, `CachedScheduleEvent`.
- `Schema([CachedAsset, CachedBooking, CachedScheduleEvent])` set up.
- `seedAssets(_:)` / `seedBookings(_:)` write-through paths exist.
- APNs registration works end-to-end (per memory `project_apns_setup.md` — Key 73H8XZQ6Y5, prod env vars in place).

**Missing:**
- `ScanView.handleScan` calls `SearchService.shared.search(query:)` directly. No SwiftData fallback. If the network is down or slow, scan returns empty.
- `AppDelegate` has no `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` — silent push (`content-available: 1`) cannot trigger cache refresh.
- Server has no silent push emitter for booking/asset state changes.
- No background refresh task to re-seed the cache when the app launches cold.

## Why this is the highest-leverage iOS upgrade

- Scan is the single most-used flow (per memory `project_scan_role.md`).
- Network round-trip on every scan = laggy feel even on good connections.
- SwiftData lookup is sub-10ms vs. 200-800ms for a network call.
- Silent push closes the staleness window when the web app mutates state.

## Sliced execution

### Slice 1 — ScanView reads from SwiftData first (½ day)
- Refactor `SearchService.search(query:)` to:
  1. Look up by `assetTag` in `CachedAsset` via `FetchDescriptor` first. Return immediately if found.
  2. Concurrently kick off a network call to refresh that asset.
  3. If no local hit, fall back to network and seed the result on success.
- Keep the public API identical so `ScanView` doesn't change.
- Add a small "stale" indicator if the local result is older than 5 minutes (timestamp on `CachedAsset`).
- Acceptance: turn off WiFi, scan a previously-seen asset, see the result in <50ms.

### Slice 2 — Cold-launch cache seed (¼ day)
- On `WisconsinApp` start (after auth), run a background `Task` that calls a new `/api/ios/sync` endpoint returning all assets the user can see.
- Persist response into `CachedAsset` via `seedAssets`.
- Run no more than once per launch; record `lastSyncedAt` in UserDefaults.
- Acceptance: fresh install + login → after 5 sec, ScanView works offline.

### Slice 3 — Web endpoint: `/api/ios/sync` (½ day)
- New route returning a delta-friendly payload: `{ assets: [...], bookings: [...], events: [...], serverTime: ... }`.
- Honor `If-Modified-Since` style cursor: client passes `since=<ISO>`, server returns only rows updated after that.
- Auth via existing `withAuth`; respect role-based visibility.
- Pagination not required initially (target user base is small per memory).

### Slice 4 — Silent push wiring (½ day)
- Server: emit a silent push (`content-available: 1`, no alert) when a booking or asset mutates that affects users who have notifications enabled.
- iOS: implement `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` in `AppDelegate`.
- Handler dispatches to `GearStore.refreshFromSilentPush(payload:)` which calls `/api/ios/sync?since=lastSyncedAt`.
- Always call `completionHandler(.newData)` within 30s budget (Apple requirement).
- Acceptance: change a booking on web → iOS app silently updates SwiftData within seconds, no visible UI prompt.

### Slice 5 — Cache eviction & migration safety (¼ day)
- Add `lastSyncedAt: Date` to each `@Model` if not already present.
- Periodic prune: delete cache rows older than 30 days that haven't been touched.
- Confirm SwiftData migration plan if `@Model` schema ever changes (`VersionedSchema` + `MigrationPlan`).
- Document the schema version in `Models/Models.swift`.

## Risks

- SwiftData `@Model` classes evolve with the server schema. Any field added on the server requires an iOS update.
- Silent push has APNs throttling. If we emit on every mutation, Apple may rate-limit. **Mitigation:** debounce server-side to one silent push per user per 30s window.
- `ModelContainer` initialization can fail on disk-full devices. Wrap in error handling; degrade gracefully to network-only mode.

## Out of scope

- Offline write queue (queueing booking actions when offline). Requires conflict resolution; defer.
- Per-asset image caching (already handled by URLCache for SDWebImage-style flows).
- Background refresh task (`BGTaskScheduler`) — defer until silent push proves insufficient.

## Open questions

1. Should `/api/ios/sync` cap response size? For a small team (<50 users, <1000 assets) probably not necessary v1.
2. Encryption at rest for SwiftData — `CachedAsset` contains no PII beyond `name`. `Models.User` cache (if added later) would need iOS Data Protection class consideration.
