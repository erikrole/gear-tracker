# Native Welcome iOS audit — 2026-07-17

## Surface

- `ProfileCompletionWelcomeView.swift`
- `ProfilePhotoCropView.swift`
- Root routing through `WisconsinApp.swift`

## Accepted behavior

- Fresh authenticated sessions resolve profile completion before entering the tab shell.
- Optimistic returning sessions keep the fast shell and refresh completion in the background.
- The server controls role-specific requirements, completion, and the 24-hour snooze.
- Students never see work-phone collection; Collaborators see only the optional photo step.
- The native crop produces a square JPEG and uploads through the existing avatar route.
- Cached routing hints contain no profile field values.
- Step motion falls back to opacity when Reduce Motion is enabled.
- New Wiscard entry requires exactly ten card digits and one issue-code digit while the API remains tolerant of legacy stored lengths.
- Explicit Remind tomorrow is the only server snooze action; finishing without an optional photo bypasses only the current app session.
- Form focus, keyboard dismissal, adaptive footer layout, and inline photo-read recovery are owned by the native Welcome surface.

## Verification state

- Source-contract, drift, audit-inventory, Xcode project, and simulator-build results are recorded in `tasks/ios-native-welcome-flow-plan.md`.
- 2026-07-17 hardening proof: 11 focused source-contract tests passed, all 5 `ProfileCompletionModelsTests` passed on iPhone 16, the generic simulator build succeeded, and the installed Student photo step showed the compact Back/Finish footer without a duplicate snooze action.
- PhotosPicker, crop gestures, VoiceOver, Dynamic Type, and reduced-motion visual behavior require physical-device QA before release sign-off.
