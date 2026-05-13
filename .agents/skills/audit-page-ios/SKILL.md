---
name: audit-page-ios
description: Full MVP-readiness audit for a single iOS screen in the Wisconsin app. Use when the user runs audit-page-ios for a screen, asks to audit the scan screen on iOS, asks if the iOS home view is ready, asks for an MVP audit on iOS, or similar. Produces a source-grounded record file in tasks, presents findings in chat grouped by severity, then waits for fix, skip, or defer decisions before touching code. Ship bar = student-friendly, fully functional for core flows.
---

# audit-page-ios

Audits a single SwiftUI screen in `ios/Wisconsin/` against the iOS MVP ship bar: **student-friendly, fully functional for core flows, zero hiccups in front of a class**. Diagnose-only until the user approves fixes.

## Invocation

```
/audit-page-ios <screen>
```

`<screen>` matches a SwiftUI view file under `ios/Wisconsin/Views/` (e.g. `home`, `scan`, `apptab`, `licenses`, `kiosk`). Resolve case-insensitively against `<screen>View.swift` first; if ambiguous ask once.

## Mandatory pre-audit reads (Rule 7, adapted for iOS)

Before writing any finding, read all of these — no shortcuts:

1. `docs/AREA_MOBILE.md` — iOS-wide acceptance criteria, scope of what iOS must do
2. `docs/AREA_<FEATURE>.md` for the feature this screen exposes (e.g. SCAN screen → `AREA_SCAN.md`) — to check parity expectations
3. `docs/DECISIONS.md` — iOS architectural choices
4. `docs/GAPS_AND_RISKS.md` — open iOS gaps
5. `ios/Wisconsin/App/WisconsinApp.swift` and `AppDelegate.swift` — lifecycle, entry, push registration
6. The target screen file fully (Rule 15)
7. Every store / view-model the screen depends on (`ios/Wisconsin/Kiosk/KioskStore.swift`, etc.)
8. Any service / API client the screen calls
9. `tasks/audit-<screen>-ios*.md` history if present

If `AREA_MOBILE.md` doesn't exist or doesn't cover the screen, flag as P0 and proceed using source as truth.

## The six lenses (iOS-flavored)

### 1. Gaps
- Walk every iOS-relevant acceptance criterion in `AREA_MOBILE.md` and the feature's `AREA_*.md`. Met / partial / missing.
- Any iOS-specific entries in `GAPS_AND_RISKS.md` still open?
- Project memory `project_ios_framework_plan.md` lists deferred items (SwiftData, AppIntents, EventKit, BackgroundTasks, WeatherKit, Haptics) — verify they're actually deferred, not partially started in a confusing way.

### 2. Flows
- Enumerate every interactive element: buttons, taps, swipes, long-presses, sheets, navigation links, tab switches.
- For each: trace the full state change. Where does the user land? What persists? What confirms it?
- Lists: 0, 1, many, very-many states render cleanly?
- Async: every Task / network call shows loading + empty + error + success?
- Dead ends? Sheet that dismisses with no toast/feedback?
- Destructive actions: confirm dialog? Misclick risk on a small screen?
- Back navigation: doesn't strand state? Doesn't lose unsaved work silently?
- Pull-to-refresh on lists where the user would expect it?
- Tab switch mid-action: state preserved or wiped intentionally?

### 3. UI polish (iOS-native standards)
- Tap target ≥ 44×44 pt (Apple HIG) — count any custom buttons that are smaller.
- Spacing and breathing room — same taste seed as web.
- SF Symbols used for icons (not bitmaps, not emoji as UI)?
- Type uses Dynamic Type / `.font(.body)` etc., not hardcoded sizes — accessibility critical for students/teachers.
- Dark mode: every color via `Color.primary`/`.secondary`/asset, not hardcoded hex?
- Safe area: nothing hidden under notch/home indicator, nothing flush against the dynamic island?
- Placeholder text where label would suffice — delete.
- Stub names in seeds/empty states — replace.
- Helper text that doesn't earn its keep — delete.
- iOS 26 design language (per project memory: iOS 26 minimum) — using modern materials/glass where appropriate?
- NavigationStack vs deprecated NavigationView?
- Toolbar items in correct slot (`.principal`, `.primaryAction`, etc.)?

### 4. Hardening
- Auth: every API call attaches the session token? Token refresh handled? Logout clears keychain?
- Role check: does the screen render staff-only affordances when the user is a student?
- Concurrency: `@MainActor` boundaries respected? Swift 6 strict concurrency violations?
- Force-unwraps (`!`) on optionals that can realistically be nil?
- Network errors caught and surfaced — not swallowed in `try?`?
- Background lifecycle: scene-phase transitions don't lose user input?
- Kiosk mode (per `KioskStore`): screen behaves correctly when locked into kiosk? Can a student exit by accident?
- Push permission requested at the right moment, not on cold launch?
- Personal data not logged via `print()` / `os_log` without redaction?
- Network requests over HTTPS only (ATS not weakened)?

### 5. Breaking
- Slow network: spinner forever? Double-submit on second tap?
- Airplane mode / offline: clear empty state or scary error?
- Expired session mid-action: clean re-auth or stuck state?
- Backgrounded for 10 minutes mid-form: input preserved?
- Phone call / system interruption: recovery clean?
- Low memory warning: state survives?
- Long strings, emoji, RTL — overflow on a 4" device?
- Rotation (if landscape supported): layout holds?
- iPad sizing (if supported): not just iPhone-stretched?
- VoiceOver: critical actions reachable and labeled?

### 6. Parity (informational only)
- What does this iOS screen do that the web equivalent does not? List it.
- What does the web equivalent do that iOS lacks? List it.
- Per project intent: iOS is **student-friendly + fully functional for core flows**. A missing power-user feature on iOS is P2; a missing student core-flow feature is P0.

## Severity rules

**P0 — blocks ship**
- Crash, force-unwrap on nil, API call with no error handling on golden path
- Auth bypass / role-restricted action available to students
- Silent data loss (background termination eats input, sheet dismiss eats edits)
- Student core flow (scan, check out, check in, view license) broken or missing
- Missing `AREA_MOBILE.md` coverage for this screen

**P1 — student-visible; ship bar requires zero**
- Tap targets < 44 pt on primary actions
- Hardcoded colors that break dark mode
- No loading/empty/error state on a visible async action
- Placeholder/stub copy visible
- Destructive action without confirm
- Hardcoded font sizes that ignore Dynamic Type
- Visible safe-area / notch overlap

**P2 — post-MVP**
- Parity gaps that aren't student core flows
- iPad polish if iPad isn't a launch target
- Power-user shortcuts (long-press menus, swipe actions)
- Deferred framework integrations (per `project_ios_framework_plan.md`)

## MVP verdict rule

Ready ⇔ ALL of:
- 0 P0 findings
- 0 P1 findings with student-visible impact
- `AREA_MOBILE.md` and the feature's `AREA_*.md` iOS criteria met
- Every interactive element has loading + empty + error states
- Server-side authorization implicitly trusted (because every API call is hardened on the web side); but the screen still hides admin-only affordances correctly
- No obvious crash paths on cold launch, kiosk lock, scene resume

Otherwise: **NOT READY** with blocker count.

## Output: the record file

Write to `tasks/audit-<screen>-ios.md` (overwrite if exists; git keeps history):

```markdown
# Audit: <screen> (iOS) — <YYYY-MM-DD>

**MVP verdict:** READY | NOT READY — N P0, M P1
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** source audit; build/simulator verification runs after approved fixes when practical

## P0 — blocks MVP
- [ ] [Lens] One-line finding — `ios/Wisconsin/Views/<File>.swift:LINE`
      Why it blocks ship: <one sentence>
      Suggested fix: <one sentence>

## P1 — polish before ship
- [ ] [Lens] ... (same shape)

## P2 — post-MVP
- [ ] [Lens] ...

## Acceptance criteria status (from AREA_MOBILE.md + feature AREA_*.md)
- [x] Criterion 1 — proven by `file:line`
- [ ] Criterion 2 — partial: <gap>

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- list every file actually opened during audit

## Notes
- anything else worth recording
```

## Chat presentation

After writing the file, present in chat in this exact shape:

```
Audit: <screen> (iOS) — MVP verdict: <READY | NOT READY (N P0, M P1)>
Record: tasks/audit-<screen>-ios.md
Audit type: source audit

P0 — blocks ship
  1. [Lens] One-line finding
     ios/Wisconsin/Views/File.swift:line
     Why: <reason>
  2. ...

P1 — polish before ship
  3. ...

P2 — post-MVP (informational)
  4. ...

Reply with decisions (e.g. "fix 1-3, skip 4, defer 5-6").
Note: fixes will include drift/gap checks and simulator build verification when practical.
```

## Fix loop (only after explicit approval)

When the user replies with fix decisions:

1. Re-read the audit file as source of truth.
2. Group approved fixes into thin slices (Rule 10): data/store → service → view wiring → polish.
3. For each slice:
   - Implement in Swift
   - Run `npm run drift:ios` and `npm run audit:ios:gaps` after meaningful iOS changes.
   - Run a targeted `xcodebuild` simulator build when the local simulator/build environment is available.
   - Update `docs/AREA_MOBILE.md` and the feature's `AREA_*.md` change log + tick criteria (Rule 12)
   - Update `docs/GAPS_AND_RISKS.md` if a gap closed
   - Update `tasks/lessons.md` if a correction-worthy pattern emerged
4. Commit per Rule 9 conventional-commits. Outcome-focused.
5. Open ONE PR per slice. PR description = the audit file's relevant findings, checked.
6. Mark addressed findings `[x]` in `tasks/audit-<screen>-ios.md` and commit that update.
7. Report the exact drift, gap-audit, and build commands that passed or explain the blocker.

If user says "fix all", that means every P0 + P1 only. P2 needs explicit ack.

## Hard rules

- Never auto-fix during audit.
- Never invent acceptance criteria not in `AREA_MOBILE.md` or the feature's `AREA_*.md`.
- Never cite a file:line you didn't actually read this session.
- Mark uncertainty with `?` and explain.
- Re-read the user's last message before each substantive turn (Rule 15).
- After 2 consecutive approach failures: stop, summarize, ask (Rule 15).
- Honor taste seeds: drop placeholders, more breathing room, no stub names, minimal labels, delete unearned helper text.
- Do not call iOS ready until drift checks, gap audit, and an appropriate simulator build pass, or clearly report why one could not be run.

## What this skill is NOT

- Not a blind build runner — source findings still drive the audit
- Not a refactor pass — fix only approved findings
- Not a feature-add pass — gaps are flagged, not extended
- Not the web — use `audit-page-web` for that
- Not a security review of the backend — assume backend hardening is covered by `audit-page-web` and `security-review`
