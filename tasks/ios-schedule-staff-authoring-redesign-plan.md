# Native Schedule Staff Authoring Redesign - 2026-07-18

## Goal

- Make Add Shift and Assign Person feel like one calm, trustworthy staff workflow inside the redesigned native Event detail.

## Route

- Owner area: `AREA_SHIFTS`
- Secondary area: `AREA_MOBILE`
- Ledger: this plan plus `tasks/todo.md`
- Existing references: `tasks/ios-schedule-core-redesign-plan.md`, `tasks/audit-event-detail-ios.md`, and `tasks/audit-schedule-ios.md`

## Source Checks

- Event detail already limits both sheets to staff/admin through its existing shift-management gate.
- Shift creation continues through `POST /api/shift-groups/[id]/shifts`; area, worker type, optional start/end overrides, serializable persistence, and auditing remain server-owned.
- Direct assignment continues through `POST /api/shift-assignments`; authoritative overlap, approved-time-off, eligibility, audit, and notification behavior remain server-owned.
- `GET /api/shifts/[id]/candidate-scores` already provides role, area, sport, availability, overlap, and workload recommendations to staff. Native iOS can consume this existing envelope without a backend or schema change.
- Ordinary availability conflicts remain advisory for staff. Approved time off remains a server-enforced blocker.

## Stop Conditions

- Stop if the candidate-score response cannot be decoded tolerantly without changing the server contract.
- Stop if either redesign would bypass current staff/admin permission gates or assignment confirmation behavior.
- Preserve all existing Schedule, Availability, Trade Board, reservation, and unrelated dirty-worktree changes.

## Slices

- [x] Rebuild Add Shift around event context, explicit area and worker-class decisions, a quiet inherited schedule, optional custom timing, inline validation, and one purple constructive action.
- [x] Add a tolerant native candidate-score client/model and redesign Assign Person around ranked candidates, area and roster fit, visible warnings, and explicit advisory-conflict confirmation.
- [x] Preserve search pagination, initial-load skeletons, refresh/error recovery, double-submit guards, Dynamic Type, VoiceOver, and reduced-motion behavior.
- [x] Update Event detail wiring, source-contract tests, area docs, gaps, audits, and task ledgers.

## Verification

- [x] Focused staff-authoring, Event detail, availability, and API source-contract tests.
- [x] Full `tests/ios-*.test.ts` native source-contract suite.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [ ] `npm run ios:project:check` (blocked by pre-existing checked-in XcodeGen project drift).
- [x] Wisconsin Simulator and generic iOS device builds.
- [ ] Runtime inspection of Add Shift and Assign Person without mutating live production scheduling data (app launched; simulator UI automation reported successful taps but did not navigate from Home).
- [x] `npm run codemap`, `npm run verify:docs`, and `git diff --check`.

## Review

- Shipped: Event-aware Add Shift with explicit slot decisions and a candidate-scored Assign Person flow with blocking and advisory conflict treatment.
- Verified: 43 focused contracts, 248 full native contracts, iOS drift and gap audits, Simulator build/run, unsigned generic-device build, codemap/docs verification, and whitespace checks.
- Deferred: Direct visual inspection of the two sheets. No production shift or assignment mutation was performed.
- Blocked: `npm run ios:project:check` reports pre-existing drift in `ios/Wisconsin.xcodeproj/project.pbxproj`; XcodeBuildMCP UI automation did not navigate despite successful element-ref actions.
- Proof artifacts: Successful XcodeBuildMCP build/run with no diagnostics and successful unsigned generic-device Xcode build.
- Next slice or stop: Continue to Edit Shift Times and Post Trade only if the user wants the remaining Schedule sheets redesigned; otherwise stop for visual review of these two authoring sheets.
