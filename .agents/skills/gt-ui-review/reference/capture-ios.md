# Capturing matched iOS screenshots

Commands assume repo root. The Wisconsin project lives in `ios/`.

## Toolchain

`xcode-select` on this machine may point at CommandLineTools, which makes `simctl`
and the simulator MCP unavailable. Export the developer dir for the shell instead
of changing it globally (the global fix needs the user's password):

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
```

If the simulator MCP reports a missing platform or a wrong `xcode-select`, say so
and give the user the `sudo xcode-select -s ...` fix. Do not switch to driving the
Simulator app with generic screen tools without telling them.

## Destination

`AGENTS.md` fixes the default destination at **iPhone 16 Pro**. Do not substitute
iPhone 17 because it happens to be booted.

```bash
xcrun simctl list devices available | grep "iPhone 16 Pro"
```

`name=iPhone 16 Pro` can fail with "Unable to find a device matching the provided
destination specifier" when the device exists only under an older runtime and a
newer one is installed. Pass the UDID for the same device instead of switching
models:

```bash
-destination 'platform=iOS Simulator,id=<udid-of-iPhone-16-Pro>'
```

## The fixture harness

`ios/Wisconsin/App/PerformanceTestHarness.swift` renders real views against canned
payloads with no session and no network. To add a surface:

1. Add a case to `AppRuntimeMode.PerformanceScenario` in
   `ios/Wisconsin/Core/PerformanceInstrumentation.swift`, and include it in
   `usesFixtureAPI`.
2. Add the case to `PerformanceTestRootView`, rendering the real view inside a
   harness view that seeds `session.currentUser` (and any `AppState` counts the
   chrome reads) in `.onAppear`.
3. Route the surface's API paths in `FixtureAPIProtocol.body(for:)`.
4. Append fixtures to the same file. New Swift files need manual `project.pbxproj`
   registration — appending to a file already in the target avoids that entirely.

Generate time-sensitive fixtures **relative to launch** so states like "in progress"
and "finished" are always exercised, not only when the test runs at the right hour.

### Two failure modes that will cost you an hour each

- **`/api/me` must be fixtured.** A foreground refresh calls it; unfixtured it
  reaches the real host, 401s, and signs the fixture user out mid-capture. The
  symptom is role-gated UI silently missing from the screenshot.
- **Claim every `/api/` path, and answer 404 for unmapped ones.** Any unfixtured
  call broadcasts a session expiry on 401 and tears the harness session down.
  `canInit` returns true for all `/api/` paths in a fixture scenario; unmapped
  paths return 404, which stays local to the caller.

Also call `Tips.hideAllTipsForTesting()` under `isPerformanceTesting`, or a
first-run TipKit popover will land over whatever you are capturing.

## Capturing

Env vars reach the app through `SIMCTL_CHILD_`:

```bash
SIMCTL_CHILD_GT_PERFORMANCE_SCENARIO=schedule \
  xcrun simctl launch --terminate-running-process booted com.erikrole.Wisconsin
xcrun simctl io booted screenshot out.png
```

For matched pairs use a screenshot UI test instead, so scroll positions line up.
Add the case to `ios/WisconsinUITests/ReportsScreenshotUITests.swift` (already in
the target), set `app.launchEnvironment["GT_PERFORMANCE_SCENARIO"]`, wait on real
fixture content rather than chrome, and attach with `.keepAlways`.

UI tests run under the **`WisconsinPerformance`** scheme; `Wisconsin` does not
include `WisconsinUITests`.

```bash
xcodebuild test -project ios/Wisconsin.xcodeproj -scheme WisconsinPerformance \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  -only-testing:WisconsinUITests/ScheduleScreenshotUITests \
  -resultBundlePath out.xcresult

xcrun xcresulttool export attachments --path out.xcresult --output-path attach/
```

`attach/manifest.json` maps `exportedFileName` to `suggestedHumanReadableName`;
the attachment name before the first `_` is the label passed to `XCTAttachment`.

## Building a true baseline

Reconstructing a "before" by reverting edits from memory is how you end up
comparing against something that never existed. Use source control:

```bash
cp ios/.../View.swift "$SCRATCH/View.AFTER.swift"          # keep your version
git show HEAD:ios/.../View.swift > ios/.../View.swift       # baseline
# ...capture...
cp "$SCRATCH/View.AFTER.swift" ios/.../View.swift           # restore, then verify
```

Two cautions. If the file had uncommitted changes before you started, `HEAD` is not
the user's baseline — check `git diff` first and preserve their work. And if `HEAD`
contains debug lines from an in-progress commit, filter them rather than shipping
them into the baseline build.

## Measuring, not eyeballing

Classify each pixel row as inside-a-card or not, across the card's full width. A
single sampled column hits text, chips, and rounded corners and gives noise.

```python
inside = sum(1 for x in range(60, 1150, 6)
             if not is_ground(px_at(y, x))) > 150   # card fill spans the width
```

Convert with the capture's own scale (`1206 px / 393 pt` on a 6.3" device) and
report point values. Python has no PIL here; a minimal zlib PNG decoder is enough
and is worth keeping in the scratchpad.
