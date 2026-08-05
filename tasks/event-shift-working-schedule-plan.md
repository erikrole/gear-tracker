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
- [x] Add staff working-copy reads and the bounded quick actions appropriate on iPhone.
- [x] Keep bulk defaults, full diff review, and repair workflows web-only.
- [x] Run the affected source-contract tests, project consistency check, and Wisconsin simulator target build; authenticated device/runtime proof remains a rollout gate.

### 7. Local runtime recovery and explicit crew setup

- [x] Accept `localhost`, IPv4 loopback, and IPv6 loopback aliases on the same port for development-only CSRF checks while preserving strict production origin matching.
- [x] Make Set up crew use the saved Home/Away sport template for classified games and ask which template to use for Neutral or Non-game events.
- [x] Keep Start empty available when an event needs a fully custom crew.
- [x] Apply migration `0099_shift_group_working_copy`, verify Neon migration health, and prove authenticated Event detail and expanded Schedule behavior against the migrated runtime.

### 8. Draft assignment identity rehydration

- [x] Return a minimal assigned-user projection for every user referenced by the effective working schedule, including draft-only assignees outside the current picker page.
- [x] Resolve refreshed crew rows from that server-owned projection before falling back to published entry data or the active picker result.
- [x] Keep the stored working payload ID-only so user names and avatars remain current and are not duplicated into draft JSON.
- [x] Prove Ashley and Maddy remain named after refresh without publishing, with focused service/source tests and authenticated browser inspection.

### 9. Publish and assignment boundary repairs

- [x] Allow an assigned draft-only slot to reconcile into a new relational shift and assignment during publish.
- [x] Apply call-window edits at the assignment layer when a slot has a personal override, while preserving the slot fallback window.
- [x] Retry one serialization conflict around publish so concurrent schedule edits return a real stale/conflict response instead of an incidental server error.
- [x] Keep legacy Event detail and Schedule mutation controls read-only while a private working copy exists.
- [ ] Verify the repaired publish, assignment, and working-copy boundary behavior with focused tests and the required web gates.

### 10. Settings-owned current call-time synchronization

- [x] Make Sport settings offsets the source for upcoming timed shift coverage, including assigned and manually created slots, while preserving explicit slot and personal overrides.
- [x] Keep all-day and date-only events free of fabricated call times.
- [x] Synchronize active private working-copy payloads so a later publish cannot restore stale default times.
- [x] Add a reusable dry-run/apply repair path and wire future Sport settings changes through the same service.
- [x] Apply the current live correction and verify the settings, schedule, publication, and working-copy contracts.

### 11. Explicit assigned-slot convert-and-replace

- [x] Add one versioned `convertAndReplace` command that requires a target scheduling class and replacement user.
- [x] Reject active trades, linked bookings, inactive users, duplicate draft assignments, conflicts, and Student availability violations before changing the working copy.
- [x] Preserve assignment history while publishing the replacement by declining the old assignment and creating the new relational assignment.
- [x] Wire target-class replacement pickers into the web Schedule workstation and native Event detail flow.
- [x] Cover the command, publication reconciliation, web/native source contracts, TypeScript, lint, project check, drift check, and Wisconsin simulator build.

## Review: Slice 6 Native working-copy adoption

- Shipped: Staff Event detail now loads the additive working-schedule editor and routes Add Shift, Assign Person, unassign, duplicate, delete, and call-window actions through optimistic expected-version commands. Native Publish and Discard dialogs explain the private draft boundary and keep worker visibility on the last published crew until release.
- Preserved: Student open-shift pickup, collaborator Schedule, worker-facing reads, Trade Board, ICS, Dashboard, and existing old-client schedule reads remain published-only. Full diff, bulk defaults, and repair remain web or follow-up scope; assigned-slot replacement is covered in Slice 11.
- Verified: The focused native working-copy source contracts, TypeScript, project consistency check, and Wisconsin simulator target build pass. Authenticated native runtime/device proof and production rollout remain open.

## Review: Slice 8

- Shipped: the editor read model batches current user identity fields for every assignee referenced by the effective working schedule.
- Verified: focused working-copy tests pass, and an authenticated reload of Volleyball vs Alumni shows Maddy Pehler and Ashley Steltenpohl with no `Assigned worker` fallback.
- Preserved: working-copy JSON remains ID-only, and no publish, notification, relational schedule, or iOS read contract changed.
- Remaining: the broader plan still tracks narrow responsive proof and authenticated native runtime proof.

## Review: Slice 9

- Shipped: publish now accepts assigned draft-only slots, persists personal call-window overrides on assignments, retries one serialization conflict, and prevents legacy live schedule mutations from racing a private working copy.
- Verified: focused publication, working-copy, assignment, call-window, open-work, trade, auto-fill, and source-contract tests pass; TypeScript passes.
- Remaining: authenticated browser proof of the guarded legacy surfaces and authenticated native runtime proof remain open.

## Review: Slice 10

- Shipped: `sportDefaultShiftWindow` is the single fallback calculation for timed and all-day generation, regeneration, rebase, manual slots, template review, settings mutations, and current schedule synchronization. Settings call-time changes update future relational fallbacks and active working-copy payloads, refresh published snapshots, recalculate assignment conflicts, and preserve explicit slot or personal overrides.
- Preserved: all-day events retain date-only boundaries; assignment and slot call-window override fields are not overwritten; native and worker-facing reads remain published-only.
- Live correction: the shared dry-run/apply path corrected 35 fallback shift windows across 9 groups, 3 private working copies, and 1 published snapshot. The post-apply dry run reported zero remaining updates, zero invalid working copies, and zero missing configurations.
- Verification: focused default, generation, rebase, sync-service, TypeScript, and lint gates pass. Authenticated browser proof of the Settings save and published schedule notification surface remains open with GAP-60.

## Review: Slice 11

- Shipped: staff can explicitly replace an assigned person while converting the slot between Staff and Student. The versioned command chooses the target class and person together, clears stale personal call overrides, and keeps the draft private until publish. Active trades and linked bookings require explicit cleanup first; conflicts, inactive users, duplicate draft assignments, and Student availability are revalidated server-side.
- Published: an explicit replacement declines the prior relational assignment and creates the new assignment, preserving assignment history and worker-facing publication boundaries.
- Verified: focused working-copy, route-source, publication, and native source-contract tests pass; TypeScript, focused ESLint, `npm run ios:project:check`, `npm run drift:ios:warn`, and the Wisconsin simulator build pass. Authenticated browser/native runtime proof remains a rollout gate under GAP-60.

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
- Stop if restoring draft identity would require persisting user profile fields in the working JSON; the editor read model must hydrate current user data by ID instead.
- Preserve the unrelated kiosk work already present in the worktree.
