# Native iOS Welcome flow

## Goal

Ship the existing role-aware profile-completion flow as a native SwiftUI experience in the main Wisconsin app while preserving the fast returning-user shell, server-backed one-day snooze, and current web API contracts.

## Scope

- Add a native completion store and non-sensitive per-user routing hint.
- Gate fresh authenticated sessions before the tab shell and refresh optimistic returning sessions in the background.
- Build role-aware Email, Phones, Wiscard, Student, Apparel, and Photo steps.
- Add PhotosPicker, native square crop, and multipart avatar upload.
- Let incomplete users reopen the flow from Profile.
- Keep registration web-owned and leave WisconsinKiosk, schema, and web behavior unchanged.

## Contracts

- `/api/me/profile-completion` remains canonical for fields, visible steps, completion, and snooze timing.
- `/api/users/[id]/avatar` remains canonical for photo validation and storage.
- Student setup never asks for a work phone.
- Collaborator setup contains only the optional photo step.
- Cached routing state must not contain contact, Wiscard, apparel, or photo data.

## Verification

- [x] Focused native Welcome source-contract tests.
- [x] `npm run drift:ios`.
- [x] `npm run audit:ios:gaps`.
- [x] `npm run ios:project:check`.
- [x] `git diff --check`.
- [x] Wisconsin generic iOS Simulator build.
- [x] Wisconsin unit tests on an iPhone simulator.
- [x] Isolated review Staff and Student accounts authenticate and return role-correct Welcome requirements.
- [ ] Physical-device QA remains explicit for PhotosPicker, crop gestures, VoiceOver, Dynamic Type, and reduced motion.

## Simulator QA follow-up - 2026-07-17

- [x] Fix the isolated review avatar-upload failure at its server or environment root cause.
- [x] Keep footer actions on one readable row at standard Dynamic Type and allow an intentional adaptive layout at larger sizes.
- [x] Replace oversized menu-style Welcome pickers with compact field-owned selection controls.
- [x] Consolidate repeated email guidance and format long addresses as compact field content.
- [ ] Rebuild and repeat the Student Welcome flow against the isolated review deployment.

Review deployment `dpl_7dvQeMXxwqmoQkoPFh8tX7Fr2pnU` is live with an isolated Blob store. Authenticated avatar upload and cleanup both returned 200. The refined simulator build is installed on iPhone 16 and Alex is reset to the optional photo step for the final interactive pass.

## Native form hardening - 2026-07-17

- [x] Require exactly ten Wiscard digits and one issue-code digit before continuing.
- [x] Add local field focus, submit chaining, number-pad dismissal, and keyboard-aware scrolling.
- [x] Make final-photo Finish bypass only the current session; keep Remind tomorrow as the sole server snooze action.
- [x] Surface a recoverable inline error when a selected photo cannot be opened.
- [x] Let the footer adapt from a horizontal command row to a readable stacked layout at accessibility sizes.
- [x] Extract reusable field, footer, and selection presentation components from the root coordinator without changing the API contract.
- [x] Add deterministic preview fixtures for Student, Staff, loading, failure, and accessibility-size states without live network dependencies.

### Hardening stop conditions

- Stop if the canonical API requires broad legacy Wiscard lengths for new native entry rather than only tolerating them in stored data.
- Stop before changing server snooze policy; this slice only separates explicit snooze from current-session bypass in the native client.
- Keep registration, web Welcome, schema, and the dedicated kiosk target unchanged.

### Hardening verification

- [x] Focused native Welcome source-contract tests.
- [x] `npm run drift:ios`.
- [x] `npm run audit:ios:gaps`.
- [x] `npm run ios:project:check`.
- [x] `npm run verify:docs`.
- [x] `git diff --check`.
- [x] Wisconsin generic iOS Simulator build.
- [ ] Install and inspect Student and Staff layouts on the iPhone 16 simulator. Student photo-step runtime proof is complete; Staff is covered by deterministic preview and compile proof but still needs an authenticated runtime pass.

### Stop conditions

- Stop before changing the avatar API if review runtime evidence contradicts the existing multipart contract.
- Do not add review-only client behavior or expose the review password in source, logs, or test output.
- Preserve Student role rules, including no work-phone request and optional profile photo.

## Status

- Implemented and repository-verified. Physical-device QA remains open by design.
