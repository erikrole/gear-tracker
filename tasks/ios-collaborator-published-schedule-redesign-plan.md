# Native Collaborator Published Schedule Redesign - 2026-07-18

## Goal

- Bring the collaborator Published Schedule up to the internal Schedule design standard while preserving its published-snapshot privacy boundary and capability-driven follow behavior.

## Route

- Owner area: `AREA_COLLABORATORS`
- Secondary areas: `AREA_SHIFTS`, `AREA_MOBILE`
- Ledger: this plan plus `tasks/todo.md`
- Existing references: `tasks/big-ten-network-collaborator-access-plan.md`, `tasks/ios-schedule-core-redesign-plan.md`, and `tasks/audit-schedule-ios.md`

## Source Checks

- Native collaborators currently receive one inset grouped list whose event metadata is embedded in section headers and whose crew rows repeat without a full-screen event destination.
- Published Schedule data is snapshot-backed and already excludes drafts, unpublished edits, notes, Open Work, availability, trades, acknowledgements, candidate scores, and publication metadata.
- Follow is independently capability-gated, rate-limited, transactional, audited, and no-op aware.
- The list endpoint orders by event start but does not constrain results to current/upcoming work, so a bounded first page can be consumed by old published events.
- The detail endpoint already returns one sanitized published event and does not require a new response contract.

## Stop Conditions

- Stop if the native screen needs internal Schedule APIs or live draft data.
- Stop if crew contact details, notes, assignment state, publication metadata, trades, availability, gear, or internal controls become visible.
- Stop if Follow is exposed without `SCHEDULE_FOLLOW` or mutation failure can silently change the displayed state.
- Preserve all current Schedule redesign and unrelated dirty-worktree changes.

## Slices

- [x] Limit published-list discovery to current and upcoming events while retaining published-only snapshot and hidden/archive gates.
- [x] Rebuild the native list around date groups, Schedule-style event cards, venue rails, crew previews, skeleton-first loading, pull-to-refresh, and non-blocking refresh recovery.
- [x] Add a full-screen read-only Published Event detail with compact event identity, explicit follow state, and crew grouped by operational area.
- [x] Keep capability revocation, mutation retry, duplicate-action guards, Dynamic Type, VoiceOver, reduced motion, and server-returned follow truth intact.
- [x] Add focused API/native contracts and sync Collaborators, Shifts, Mobile, gaps, audits, and task ledgers.

## Verification

- [x] Focused collaborator Schedule service, route, follow, and native source-contract tests.
- [x] Full `tests/ios-*.test.ts` native source-contract suite.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:project:check`, or record existing project drift precisely.
- [x] Wisconsin Simulator and generic iOS device builds.
- [ ] Authenticated collaborator runtime inspection. Blocked because the reset Simulator has no safe disposable collaborator session; the existing collaborator rollout ledger retains temporary-account smoke.
- [x] `npm run codemap`, `npm run verify:docs`, and `git diff --check`.

## Review

- Shipped: Upcoming-only discovery, date-grouped event cards, full-screen published event detail, area-grouped crew, capability-gated follow/mute, and sanitized notification routing.
- Verified: 37 focused collaborator/native contracts, all 262 native source contracts, TypeScript, iOS drift, audit coverage, and unsigned Simulator plus generic-device builds pass.
- Deferred: Authenticated collaborator appearance, Dynamic Type, VoiceOver, and reduced-motion runtime inspection.
- Blocked: The reset Simulator has no safe disposable collaborator session. `ios:project:check` also continues reporting the pre-existing checked-in `ios/Wisconsin.xcodeproj/project.pbxproj` XcodeGen drift.
- Proof artifacts: Source contracts and build logs from this closeout; no new authenticated screenshot was captured.
- Next slice or stop: Stop the Schedule redesign after documentation gates. Resume only for authenticated collaborator smoke or a concrete runtime correction.
