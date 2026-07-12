# iOS Quick Wins — 2026-07-11

## Context
Branch `claude/ios-quick-wins-84hh0o`. The iOS app is already MVP-ready / "first-class"
(drift-check clean, extensive HIG/iOS-27 pass shipped June 2026). This pass burns down the
remaining *verified-open* small resilience wins — not stale audit items. Every candidate below
was checked against current Swift source, not just the April dashboard audit.

**Verification constraint (important):** Swift is not compiled in this web/Linux authoring
environment (`xcodebuild` is macOS-only). Static gates (`drift:ios`, `audit:ios:gaps`,
`git diff --check`) run here; the Xcode/simulator build is the outstanding gate for every
Swift change and must be cleared in an Xcode-capable environment or CI. See the 2026-07-08
Change Log entry — a compile break once sat undetected precisely because no static gate compiles Swift.

## What was already shipped (verified — do NOT redo)
- Freshness "Updated Xm ago" footer on Home, Schedule, Bookings.
- Schedule stale indicator + non-blocking refresh banner.
- Items list: friendly errors, retired-item reserve gating, favorite-failure toast, a11y hints.
- `APIError` is already a `LocalizedError` with humanized `errorDescription`.

## Slices

### Slice 1 — Schedule partial-failure recovery ✅ SHIPPED 2026-07-11
- **File:** `ios/Wisconsin/Views/ScheduleView.swift` (`ScheduleViewModel.load()`).
- **Root cause:** `try await (eventsTask, shiftsTask)` awaited both reads as one throwing tuple,
  so a failure in either discarded the other's success → whole screen blanked.
- **Fix:** resolve each read in its own `do/catch`; apply whatever succeeds; a single failure
  shows the existing non-blocking refresh banner (blocking error only when nothing is on screen).
  `APIError.unauthorized → login`, freshness gating, and banner copy unchanged.
- **Verification:** `drift:ios` + `git diff --check` clean here; **Xcode build pending** (gate).

### Slice 2 — Route network errors through `APIError.networkError` ✅ SHIPPED 2026-07-11
- **Files:** `ios/Wisconsin/Core/APIClient.swift`.
- **Finding:** the generic `perform<T>` helper already wrapped `session.data(for:)` failures as
  `APIError.networkError` (feeding `humanize()`), but ~13 endpoints bypassed it with an inline
  `try await session.data(for: req)` and threw a raw `URLError` on network failure — so users got
  Apple's generic `URLError.localizedDescription` instead of the app's branded copy. (It is *not*
  the raw "NSURLErrorDomain -1009" string — that framing was corrected during investigation.)
- **Fix:** extracted a `performData(_:)` wrapper (same do/catch `perform` used), routed all 13
  inline sites through it, and refactored `perform` to build on it (no duplicated wrapping).
  `try?` best-effort fetches left as-is; 401/404/409/5xx handling untouched.
- **Verification:** `drift:ios` + `git diff --check` clean here; **Xcode build pending** (gate).

### Also shipped 2026-07-11 (unblocks CI)
- **`chore: sync package-lock.json`** — `npm ci` was failing on every PR and on `main` because
  `d5c3259` bumped `package.json` without regenerating the lock (@swc/helpers, ws, chokidar,
  readdirp missing). Regenerated additively (11 added, 0 removed, no direct-dep version changes;
  audit clean at `--audit-level=high`). Not an iOS change — bundled here to get PR #370 CI green.

## Deferred — NOT quick wins (need a product-direction call first)
- Staff role-gated Home sections (drafts / flagged items / lost bulk units) — biggest dashboard
  gap, ~2h, needs new `DashboardData` API fields + "is staff-mobile parity in V1 scope?".
- GAP-34 (Bookings status filters/sort), GAP-36 (item lifecycle actions) — both `Expected/deferred,
  confirm direction` in `GAPS_AND_RISKS.md`.

## Optional low-value cleanups (internal, not user-facing)
- `ItemsView.swift`: dedupe `AssetStatusBadge`/`AssetListBadge` onto one `Color.forStatus`.
- `ItemsView.swift:84`: replace the `reset && offset == resultRows.count …` seed heuristic with an
  explicit `hasSeeded` flag.
