# iOS Apple Design Remediation Slices - 2026-07-10

**Status:** SOURCE COMPLETE - MANAGED-DEVICE SIGNOFF PENDING

## Goal

Close the full-audit blockers in small, independently mergeable slices while preserving native SwiftUI ownership, kiosk-only custody, role boundaries, audit truth, and current API rollout tolerance.

## Global Stop Conditions

- Stop if a slice would weaken D-001 derived status, D-007 audit evidence, D-040 kiosk-only custody, or current role policy.
- Stop if the current API response shape contradicts the client plan; inspect `return ok(...)` and decoding models before client edits.
- Do not claim scanner, camera, VoiceOver, or accessibility-size readiness without the named runtime proof.
- Preserve unrelated worktree changes.

## Slice 1: Kiosk Rapid-Scan Atomicity

**Priority:** P0. **Owner:** Kiosk/Checkout. **Depends on:** none.

- Serialize scan intake or merge responses into fresh MainActor cart state.
- Track in-flight normalized scan identities and preserve duplicate semantics.
- Ensure completion cannot race pending scan responses.
- Acceptance: two valid delayed responses completing in either order leave both items in the cart and payload; duplicate scans remain one item with explicit feedback.
- Verify: focused store/client tests with delayed responses, HID burst on physical iPad, camera burst, kiosk simulator build, drift, audit gaps, docs.

## Slice 2: Kiosk Edit Authority and Audit Actor Decision

**Priority:** P0. **Owner:** Kiosk + Decisions. **Depends on:** product decision before code.

- Choose one policy: idle detail read-only until identified operator entry, or explicit kiosk-device/system actor with staff unlock.
- Record the accepted actor model in `docs/DECISIONS.md` before implementation.
- Update route authorization, audit payloads, UI entry, and error/recovery behavior together.
- Acceptance: every checkout edit identifies the true authorized actor or an explicitly accepted system actor; requester identity is never substituted for operator identity.
- Verify: permission/service tests, audit-entry assertions, kiosk runtime proof for allowed and rejected roles, generic/simulator build, docs gates.

## Slice 3: Central Kiosk Session Expiry Recovery

**Priority:** P1. **Owner:** Kiosk/Core. **Depends on:** none.

- Centralize `.unauthorized` handling across every kiosk request.
- Clear invalid credentials once, cancel active work safely, return to activation, and announce the reason.
- Preserve transient network/5xx behavior and last-good idle data.
- Acceptance: 401 during load, scan, confirm, or detail mutation reaches activation immediately without waiting for heartbeat.
- Verify: injected 401 tests for each flow operation, offline-vs-401 regression, VoiceOver announcement, kiosk build.

## Slice 4: Kiosk Availability State Machine

**Priority:** P1. **Owner:** Kiosk/Checkout. **Depends on:** Slice 1 recommended.

- Model checking, verified, failed, and stale availability explicitly.
- Key verification to cart revision plus return time.
- Disable completion for unknown/failed/stale state and expose Retry.
- Acceptance: completion is enabled only for a currently verified cart/time pair with no blocking issue.
- Verify: cart/time mutation tests, failed/retried preflight, server rejection remains handled, kiosk build.

## Slice 5: Interactive Accessibility Semantics

**Priority:** P1. **Owner:** Mobile shared components. **Depends on:** none.

- Replace combined interactive containers with containment or separate semantic elements.
- Convert scan-result image zoom to a Button.
- Add coherent Search row labels/hints and explicit Login field labels.
- Fix kiosk Retry and Success Done reachability.
- Acceptance: VoiceOver and Switch Control can discover and activate every visible recovery or completion action independently.
- Verify: Accessibility Inspector, VoiceOver rotor/order/actions on iPhone and iPad, source-contract tests where useful, both builds.

## Slice 6: Scalable Brand Typography and Adaptive Layout

**Priority:** P1. **Owner:** Mobile design foundation. **Depends on:** none.

- Replace fixed Gotham APIs with semantic scalable helpers using `relativeTo` or UIFontMetrics.
- Remove clipping-first line limits/minimum scaling for identity and custody text.
- Adapt Home stats, Search rows/heroes, kiosk identity/checklists, and large brand moments at accessibility categories.
- Acceptance: AX1 through AX5 remain readable and operable in portrait/landscape; no asset, student, booking, or scan identity is clipped into ambiguity.
- Verify: iPhone narrow/large, iPad portrait/landscape, light/dark, AX1/AX3/AX5 screenshot matrix, both builds.

## Slice 7: Shift Edit Failure Recovery and Adaptive Sheet

**Priority:** P1. **Owner:** Schedule. **Depends on:** none.

- Make save return success/failure or throw.
- Keep edited values and sheet visible on failure with inline recovery.
- Dismiss and haptic only on confirmed success.
- Replace fixed height with adaptive medium/large presentation.
- Acceptance: simulated failure loses no input; AX5 landscape can reach both fields, error, cancel, and save.
- Verify: focused callback/state test, failure injection, simulator AX5 portrait/landscape, main build.

## Slice 8: Live Feedback and Focus

**Priority:** P1. **Owner:** Account + Notifications + shared feedback. **Depends on:** Slice 5 recommended.

- Announce password success/error and notification mutation/page errors.
- Move accessibility focus to relevant error/status when appropriate.
- Keep haptics synchronized with the state change and avoid duplicate announcements.
- Acceptance: feedback is perceivable without sight and does not steal focus during ordinary success unnecessarily.
- Verify: VoiceOver runtime, failure/success state tests, main build.

## Slice 9: Reduced Motion Foundation

**Priority:** P2. **Owner:** Mobile shared design. **Depends on:** none.

- Centralize motion choices for press, insertion, scan feedback, progress, and permission illustrations.
- Gate QR, permission, cart, kiosk checklist/progress/camera, and keyboard-hint motion.
- Preserve opacity/color/status feedback when motion is reduced.
- Acceptance: Reduce Motion removes movement/scale/spring effects without hiding state changes.
- Verify: on/off comparison on main and kiosk targets, source sweep for ungated explicit animations, both builds.

## Slice 10: Search Presentation Routing

**Priority:** P2. **Owner:** Search/Scan. **Depends on:** none.

- Replace fixed dispatch delays with presentation lifecycle or pending-destination state.
- Make autofocus lifecycle-driven rather than timer-driven where current APIs permit.
- Acceptance: scan result navigation works after success, cancellation, rapid repeated scan, and tab switching without a race or artificial pause.
- Verify: repeated simulator/device interaction, UI tests if stable, main build.

## Slice 11: Kiosk Resumable Work and Camera Recovery

**Priority:** P2. **Owner:** Kiosk. **Depends on:** Slices 1 and 3.

- Define privacy window and multi-user ownership for preserved work.
- Persist checkout setup context with cart; reload staged pickup/return evidence from server.
- Add explicit Resume and Clear/Discard actions.
- Add Open Settings for denied camera permission; correct unsupported/manual-entry copy; restore HID focus after dismissal.
- Acceptance: inactivity never silently discards meaningful staged work and never exposes it to the wrong student.
- Verify: inactivity at each phase, app background/foreground, user switch, camera denied/unsupported, HID recovery, kiosk build.

## Slice 12: Consequential Targets and Bounded Workflow Polish

**Priority:** P2/P3. **Owner:** Licenses + Schedule + Resources + Reservations. **Depends on:** shared accessibility/type slices recommended.

- Expand consequential small controls to 44-point hit targets without inflating visual chrome.
- Hide Guide skeletons from accessibility; remove the unexplained reader spacer after visual proof.
- Add server-backed Assign Student search/pagination and use sport/area as ranking context with all-users escape.
- Disable bulk equipment rows at maximum and expose unavailable semantics.
- Acceptance: no known 44-point misses in named controls; every eligible user is assignable beyond 200; loading placeholders are silent; maxed rows are not dead taps.
- Verify: target audit script/source tests, VoiceOver/Switch Control, large-roster fixture, screenshots, main build.

## Slice 13: Apple Design Restraint and Hierarchy Pass

**Priority:** P3 after functional foundations. **Owner:** Mobile design system + screen owners. **Depends on:** Slices 5, 6, and 9.

- Prototype the revised Home action hierarchy, one booking/item detail surface, Search-to-result transition, and kiosk scan feedback on real devices before broad application.
- Reduce card-on-card framing, redundant pills, repeated status color, shadows, and decorative glass where native grouping already communicates structure.
- Keep Gotham only for intentional brand moments; use semantic system type for operational identity and prose.
- Make primary actions visually dominant and secondary metadata quiet on Home, reservations, Schedule, and kiosk.
- Preserve the system tab bar, native sheets, navigation, lists, swipe actions, and platform gestures.
- Acceptance: each audited screen has one obvious primary job; status is not repeated through more than the minimum useful combination of text, symbol, and color; material communicates elevation or modality rather than decoration.
- Verify: interactive prototype review, light/dark, iPhone/iPad, AX3/AX5, Reduce Motion/Transparency/Increase Contrast, slow-motion capture for custom transitions, and fresh-eye review with real students/counter staff.

## Deferred Decision: Settings Directory Duplication

Keep the Directory fallback until reachability or usability evidence shows More is sufficient. This is not a launch blocker and should not be bundled into the accessibility or typography foundations.

## Slice 14: Checkout Return Live Activity Restraint

**Status:** COMPLETE. **Owner:** Mobile/Live Activities.

- Replaced the nested lock-screen card and duplicated expanded-Island card with system-owned, surface-specific layouts.
- Changed normal urgency to neutral, warning to amber, critical/overdue to red, and returned to green.
- Removed requester photo/name/initials from lock-screen and Island presentation while preserving rollout-compatible attributes.
- Standardized every surface on minute precision and removed the one-second Island timeline.
- Changed the activity deep link to booking detail without automatically requesting Extend.
- Preserved next-use context, push-to-start, remote updates, token lifecycle, and returned dismissal behavior.
- Verified focused Live Activity source contracts and the Wisconsin simulator build including the widget extension.

## Full Verification Stack Per Shipped Slice

- Focused Swift or source-contract tests for the changed behavior.
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- `npm run ios:project:check`
- Relevant Wisconsin and/or WisconsinKiosk build.
- Required runtime proof named in the slice.
- `npm run codemap` when codemap-owned source changes.
- `npm run verify:docs`
- `git diff --check`
- Relevant `docs/AREA_*.md`, `docs/GAPS_AND_RISKS.md`, Decisions, and task-ledger closeout in the same shipping commit.

## Review

- Shipped: all source-level remediation slices, including kiosk scan atomicity, identified edit ownership, immediate session expiry recovery, fail-closed availability, resumable checkout context, accessibility semantics and announcements, scalable brand type, reduced-motion behavior, adaptive shift editing, Search presentation routing, assignment pagination, camera recovery, 44-point controls, guide/loading cleanup, restrained surface depth, and the simplified checkout-return Live Activity.
- Verified: 46 iOS test files and 170 tests passed; `drift:ios`, `audit:ios:gaps`, `ios:project:check`, both Wisconsin simulator builds, `build:app`, `verify:docs`, and `git diff --check` passed.
- Deferred proof: managed M2 iPad HID burst, camera permission, VoiceOver, AX5, Reduce Motion/Transparency/Contrast, rotation, and fresh-eye student/counter walkthrough.
- Blocked: no source blocker. Physical-device and human signoff cannot be manufactured by automated builds.
- Proof artifacts: command results recorded in the active task and audit handoff.
- Next slice or stop: stop source implementation; perform the managed-device signoff matrix before release.
