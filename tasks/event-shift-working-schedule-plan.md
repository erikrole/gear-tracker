# Event Shift Working Schedule Plan

Status: Active
Owner area: Schedule
Started: 2026-07-21

## Outcome

Make the expanded web Schedule list the primary crew workstation: fast Staff and Student slot changes, assignment, removal, worker-class conversion, and a deliberate publish review. Unpublished edits must stay private and quiet. Existing iOS clients must continue reading the last published schedule while newer clients gain bounded staff quick actions.

## Product contract

- Web is the high-volume editing surface. Multiple events may stay expanded.
- The last published relational schedule remains the worker-facing source for My Shifts, Dashboard, ICS, Open Work, Trade Board, collaborator Schedule, and existing iOS clients.
- Staff edits a versioned working copy. Draft edits do not notify workers or change published reads.
- Publish reviews the worker-visible diff, reconciles it atomically, increments the published version, resets acknowledgement only where worker-visible details changed, and sends at most one event summary per affected worker.
- Staff and Student are scheduling classes from `User.staffingType`, not permission roles.
- An assigned slot cannot be converted to a class that conflicts with its assignee without an explicit replace or unassign choice. Active trades must be resolved explicitly.
- Default staffing changes apply to newly generated schedules and conservatively rebase upcoming unpublished schedules. Assigned and manually touched slots are protected; published schedules and active working copies require explicit review.

## Slices

### 1. Lifecycle decision and persistence foundation

- [x] Record the accepted working-copy/publication decision.
- [x] Add published and working version metadata plus one validated JSON working copy per shift group.
- [x] Add the incremental Prisma migration and schema contract tests.
- [x] Preserve current published read behavior while the additive editor service is wired.

### 2. Working-copy service and API

- [x] Define the server-owned working crew payload and Zod validation.
- [x] Materialize a working copy from the last published/live schedule on first edit.
- [x] Add Staff/Student slot count, convert, assign, unassign, call-window, discard, diff-preview, and publish operations.
- [x] Require `shift.manage`, rate-limit mutations, use `SERIALIZABLE`, enforce optimistic working-version checks, and write before/after audit entries.
- [x] Keep draft operations notification-free.

### 3. Publish reconciliation

- [x] Reconcile the working copy into relational shifts and assignments atomically.
- [x] Preserve stable IDs and booking/trade history where possible; block destructive ambiguity for active trades or linked bookings.
- [ ] Reset acknowledgements only for changed worker-visible assignments.
- [x] Bundle publish delivery to one event summary per affected worker and make retry dedupe version-based.
- [x] Confirm My Shifts, Dashboard, ICS, Open Work, Trade Board, collaborator Schedule, and old iOS clients remain published-only.

### 4. Expanded Schedule workstation

- [x] Allow multiple expanded events.
- [x] Group rows by operational area with visible `Staff - count +` and `Student - count +` controls.
- [x] Keep assigned people, open Assign actions, removal, conversion, and call-time editing inline.
- [x] Add Draft, Published, and Unpublished changes state plus Preview, Discard, and Publish review controls.
- [x] Keep Event detail for deeper context instead of duplicating the primary quick-action workflow.
- [ ] Verify the authenticated desktop route and narrow responsive behavior.

### 5. Default staffing hardening

- [x] Buffer edits per sport with explicit Save and Discard.
- [x] Replace the ten-column matrix with compact area rows and Home/Away totals.
- [x] Remove silent one-Student-per-area activation defaults.
- [x] Handle Neutral and Non-game events explicitly instead of silently treating unknown venue class as Home.
- [x] Automatically rebase eligible upcoming unpublished schedules after default saves, using generated-slot provenance to add, remove, or retime only safe openings.
- [x] Count occupied and manually touched slots toward the new target without removing or converting them.
- [x] Skip published schedules and active working copies so they remain deliberate review/publish changes.

### 6. Native iOS compatibility and quick actions

- [x] Keep existing models tolerant of additive publication metadata.
- [x] Keep student and old-client reads on the published schedule.
- [ ] Add staff working-copy reads and the bounded quick actions appropriate on iPhone.
- [x] Keep bulk defaults, full diff review, and repair workflows web-only.
- [ ] Run affected source-contract tests and Xcode simulator/device builds.

### 7. Local runtime recovery and explicit crew setup

- [x] Accept `localhost`, IPv4 loopback, and IPv6 loopback aliases on the same port for development-only CSRF checks while preserving strict production origin matching.
- [x] Make Set up crew use the saved Home/Away sport template for classified games and ask which template to use for Neutral or Non-game events.
- [x] Keep Start empty available when an event needs a fully custom crew.
- [x] Apply migration `0099_shift_group_working_copy`, verify Neon migration health, and prove authenticated Event detail and expanded Schedule behavior against the migrated runtime.

## Verification

- Focused service and route tests for validation, authorization, stale versions, draft privacy, publish atomicity, notification dedupe, class conversion, trade safety, and compatibility reads.
- `npx prisma format`, `npx prisma validate`, `npm run prisma:generate`, and `npm run db:migrate:check` for every schema slice.
- `npx tsc --noEmit --pretty false`, focused lint, `npm run build:app`, and authenticated browser proof for web slices.
- iOS source-contract tests, drift check, project check, and affected Xcode builds for native slices.
- `git diff --check`, docs/codemap verification, relevant area-doc acceptance/changelog updates, and a final diff audit.

## Stop conditions

- Stop before applying a live migration or deploy-shaped build unless the environment is explicitly controlled for migration work.
- Stop before applying migration `0099_shift_group_working_copy` to the shared Neon database without explicit user approval.
- Stop rather than delete or sever a shift, assignment, trade, or booking relationship that the working payload cannot reconcile safely.
- Stop if current iOS contracts require a breaking response change; ship an additive server contract first.
- Preserve the unrelated kiosk work already present in the worktree.
