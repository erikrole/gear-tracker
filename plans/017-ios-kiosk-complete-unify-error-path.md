# Plan 017: Route iOS kiosk checkout completion through the shared error path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- ios/Wisconsin/Kiosk/KioskAPIClient.swift ios/Wisconsin/Kiosk/KioskCheckoutView.swift`
> Note: `KioskAPIClient.swift` has uncommitted working-tree changes at planning
> time; the excerpts below reflect the working tree. If the live code does not
> match them, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e8566c54` (working tree), 2026-06-10

## Why this matters

Every kiosk API call in the iOS app goes through `KioskAPI.perform(_:)`, which maps HTTP 401 to `APIError.unauthorized`. That mapping is load-bearing: it is how the kiosk detects admin deactivation/session expiry and drops back to the activation screen instead of failing silently (two prior production bugs, both fixed by routing calls through `perform` -- see the comments in `kioskHeartbeat` and `kioskCheckinComplete`). One method still bypasses it: `kioskCheckoutComplete` hand-rolls its status handling, so a 401 during checkout completion surfaces as a generic `serverError("...")` banner instead of `APIError.unauthorized`. The student sees "Checkout failed. Please try again." on a dead session, retries pointlessly, and the kiosk waits up to 60 seconds for the heartbeat to discover the truth. Routing it through `perform` removes the last special case.

## Current state

`ios/Wisconsin/Kiosk/KioskAPIClient.swift:89-100` (the outlier):

```swift
    func kioskCheckoutComplete(actorId: String, locationId: String, assetIds: [String]) async throws {
        struct AssetRef: Encodable { let assetId: String }
        struct Body: Encodable { let actorId: String; let locationId: String; let items: [AssetRef] }
        var req = request(path: "/api/kiosk/checkout/complete", method: "POST")
        let items = assetIds.map { AssetRef(assetId: $0) }
        req.httpBody = try JSONEncoder().encode(Body(actorId: actorId, locationId: locationId, items: items))
        let (data, response) = try await session.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let msg = (try? decoder.decode(ErrorBody.self, from: data))?.error ?? "Checkout failed"
            throw APIError.serverError(msg)
        }
    }
```

`perform` (same file, lines 159-185) decodes a `Decodable` on 2xx and maps 401 -> `APIError.unauthorized`, 404 -> `APIError.notFound`, otherwise `APIError.serverError(<server "error" string or generic>)`.

The server response on success (`src/app/api/kiosk/checkout/complete/route.ts`) is a top-level JSON object: `{ bookingId, refNumber, itemCount, endsAt }`.

The only caller is `KioskCheckoutView.completeCheckout()` (`ios/Wisconsin/Kiosk/KioskCheckoutView.swift:307-328`), which ignores the return value and on error shows `(error as? APIError)?.errorDescription ?? "Checkout failed. Please try again."`.

Decoder notes (same file, lines 22-27): `convertFromSnakeCase` + `iso8601` dates. The response keys are camelCase, which `convertFromSnakeCase` leaves intact.

Repo conventions: each kiosk API method defines small local `Encodable`/`Decodable` structs (see `kioskHeartbeat`, `kioskPickupConfirm`); match that style. The iOS project uses XcodeGen, but this plan adds no new files, so no `xcodegen generate` is needed.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| iOS build | `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` (if the project file lives elsewhere under `ios/`, find it with `ls ios/*.xcodeproj`) | `BUILD SUCCEEDED` |
| iOS drift check | `npm run drift:ios` | exit 0 |

## Scope

**In scope**:

- `ios/Wisconsin/Kiosk/KioskAPIClient.swift` (the `kioskCheckoutComplete` method only)

**Out of scope**:

- `KioskCheckoutView.swift` -- the caller needs no change; keep its catch handling as is.
- The request body shape and endpoint path -- the server contract is pinned by `tests/ios-api-contract.test.ts`; you are changing response *handling*, not the wire format.
- `perform` itself and every other method in the file.

## Git workflow

- Branch: `advisor/017-ios-kiosk-complete-error-path`
- Conventional commit, e.g. `fix: kiosk checkout completion now detects a dead session instead of showing a generic retry error`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite the method on top of `perform`

Replace the body of `kioskCheckoutComplete` so it builds the same request and finishes with `perform`:

```swift
    func kioskCheckoutComplete(actorId: String, locationId: String, assetIds: [String]) async throws {
        struct AssetRef: Encodable { let assetId: String }
        struct Body: Encodable { let actorId: String; let locationId: String; let items: [AssetRef] }
        struct Response: Decodable { let bookingId: String }
        var req = request(path: "/api/kiosk/checkout/complete", method: "POST")
        let items = assetIds.map { AssetRef(assetId: $0) }
        req.httpBody = try JSONEncoder().encode(Body(actorId: actorId, locationId: locationId, items: items))
        // Route through `perform` so 401 propagates as APIError.unauthorized --
        // every other kiosk mutation already does this (see kioskCheckinComplete).
        let _: Response = try await perform(req)
    }
```

Decode only `bookingId`: it is required in the server response, and a minimal struct keeps the method tolerant of additive server changes.

**Verify**: `xcodebuild ... build` -> `BUILD SUCCEEDED`.

### Step 2: Drift check and doc sync

Run `npm run drift:ios`. Add a change-log row to `docs/AREA_KIOSK.md` (permitted) noting that checkout completion now surfaces session expiry like every other kiosk call.

**Verify**: `npm run drift:ios` exit 0.

## Test plan

There is no iOS unit-test target in this repo; the gates are the Xcode build and `npm run drift:ios`. Manual QA note for the operator: with an expired/cleared kiosk session, tapping Complete Checkout should now produce the same auth failure behavior as other calls rather than the generic retry banner.

## Done criteria

- [x] `grep -n "session.data(for:" ios/Wisconsin/Kiosk/KioskAPIClient.swift` matches only inside `perform` (one site)
- [x] `xcodebuild` build succeeds
- [x] `npm run drift:ios` exits 0
- [x] No files outside scope (plus `docs/AREA_KIOSK.md`) modified (`git status`)
- [x] `plans/README.md` status row updated

## Review

- Changed `kioskCheckoutComplete` to decode the top-level success response through `perform`, preserving the existing request body and caller behavior while letting 401 map to `APIError.unauthorized`.
- Updated `docs/AREA_KIOSK.md` to record the iOS kiosk auth/error-path parity.
- Verified with the focused grep, iOS simulator build, iOS drift check, gap audit, TypeScript check, and whitespace check on 2026-06-11.

## STOP conditions

Stop and report back (do not improvise) if:

- `perform`'s signature or error mapping differs from the excerpt (drift).
- The Xcode build fails for reasons unrelated to this change (pre-existing breakage); report the error rather than fixing unrelated code.
- You find callers of `kioskCheckoutComplete` other than `KioskCheckoutView.completeCheckout()`.

## Maintenance notes

- A follow-up worth considering (deferred): `KioskCheckoutView`'s catch could explicitly handle `APIError.unauthorized` by deactivating the kiosk immediately instead of waiting for the heartbeat. That is a UX decision; this plan only makes the error distinguishable.
- If Plan 009 lands, the server's 409 messages become student-readable; this method's `perform` path already surfaces them via `APIError.serverError(msg)`.
