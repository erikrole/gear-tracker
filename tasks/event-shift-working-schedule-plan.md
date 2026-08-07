# Event Shift Working Schedule Plan

Status: Active
Owner area: Schedule
Started: 2026-07-21

## Outcome

Make the expanded web Schedule list the primary crew workstation: fast Staff and Student slot changes, assignment, removal, worker-class conversion, and a trustworthy ten-minute staging window. Pending edits stay private and quiet until ten minutes have passed without another edit; then the newest version releases automatically to worker-facing Schedule reads and sends one consolidated notification. Existing iOS clients continue reading the last released schedule while current web and native staff surfaces expose the timer and recovery state without manual Draft or Publish actions.

## Product contract

> Superseding direction accepted 2026-08-07: the timed-release contract below replaces the earlier deliberate manual-publish contract wherever they conflict. D-046 records the accepted architecture; D-042 remains historical context for the staging data model.

- Web is the high-volume editing surface. Multiple events may stay expanded.
- The last released relational schedule remains the worker-facing source for My Shifts, Dashboard, ICS, Open Work, Trade Board, collaborator Schedule, and existing iOS clients.
- Every staff edit writes a versioned pending copy and pre-enqueues a durable ten-minute release. Another edit creates a newer version and restarts the quiet period; an older workflow must no-op when it wakes.
- Automatic release validates and reconciles the newest pending copy atomically, increments the released version, and sends at most one event summary per affected worker. A permanent validation blocker becomes visible recovery state rather than an indefinitely silent pending copy.
- Draft, Publish, Republish, Discard draft, and Unacknowledged are retired as active product concepts. Pending changes may be reverted before release. Historical publication and acknowledgement fields remain for compatibility and audit history.
- Staff and Student are scheduling classes from `User.staffingType`, not permission roles.
- Active collaborators with published-Schedule access may be assigned to Staff slots. They do not participate in Student availability, open-work pickup, or Trade Board workflows.
- Only Student slots and Student assignments have call times. Staff and collaborator coverage does not expose a call-time value, event-time substitute, label, or editor; staff are expected to know when they need to arrive.
- An assigned slot cannot be converted to a class that conflicts with its assignee without an explicit replace or unassign choice. Active trades must be resolved explicitly.
- Every eligible future event receives configured default shifts. Home events use their sport Home template; Away and neutral-site games with an opponent use the sport Away template; events without an opponent use the Settings-owned Non-game template. Cancelled, hidden, and archived events are excluded.
- Default staffing changes apply to newly generated schedules and conservatively rebase upcoming pending or released schedules. Assigned and manually touched slots remain protected.
- An explicit event-level Student call-time action can set one shared window across Student slots, clearing Student personal overrides while keeping the change private until timed release. Staff and collaborator slots retain event-window storage for integrity but expose no call-time value or event-time substitute.

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

### 12. Event-level call-time controls and one-time current repair

- [x] Add the versioned `setCallWindowForAll` command to the shared working-copy contract, preserving assignment notes and clearing personal call-time overrides.
- [x] Add web Schedule and native Event detail controls with paired-window validation, conflict checks, and explicit private-until-publish copy.
- [x] Keep ordinary settings synchronization conservative while exposing an explicit override mode for a one-time repair.
- [x] Run the override dry run, apply it to the authorized active future-event scope, and verify relational rows, private working copies, publication versions, and audit records.

### 13. Assignment-scoped acknowledgement integrity

- [x] Treat a non-null assignment acknowledgement as current until publication explicitly clears that assignment.
- [x] Keep unchanged coworkers acknowledged when another worker's assignment, call window, or slot changes.
- [x] Align Schedule summaries, Event detail, and My Shifts on the assignment-scoped acknowledgement contract.
- [x] Add focused regression coverage and run the web and documentation verification gates.
- [ ] Complete authenticated browser proof against an isolated non-production identity.

### 14. Ten-minute automatic release foundation

- [x] Amend D-042 with the superseding timed-release decision and retire manual Draft/Publish terminology from active contracts.
- [x] Persist the pending release due time, durable workflow run identity, and actionable release error on the versioned staging row.
- [x] Pre-enqueue the version-specific Workflow run before committing each edit so a saved pending version cannot exist without a timer.
- [x] Sleep for ten minutes, release only when the stored version still matches, and let superseded runs no-op safely.
- [x] Preserve atomic reconciliation, history, conflict, booking, trade, audit, notification-dedupe, and old-client boundaries.

### 15. Web and API timed-release workflow

- [x] Return pending-release timing and failure state from the editor response.
- [x] Remove manual Publish/Republish/preview controls and Draft/Published/Changed labels from Schedule and Event detail.
- [x] Show quiet pending copy with the release time, restart feedback after edits, Revert pending changes, and actionable blocked-release recovery.
- [x] Keep all mutations permission-checked, rate-limited, version-checked, serializable, and audited.

### 16. Defaults for every eligible event

- [x] Add a Settings-owned Non-game template with per-area Staff and Student counts plus Student call-time offsets.
- [x] Route events without an opponent through that template and neutral games with an opponent through the sport Away template.
- [x] Generate an event's configured slots and call times on sync and manual creation, and backfill missing upcoming Non-game schedules after Settings changes.
- [x] Keep cancelled, hidden, archived, assigned, history-bearing, and manually touched records protected.

### 17. Student-only call times

- [x] Keep Staff coverage stored on the event window for scheduling integrity while exposing no Staff call-time value or event-time substitute; Student slots use configured call-time offsets.
- [x] Reject Staff/collaborator call-time overrides at the working-schedule API boundary and normalize obsolete overrides during synchronization/release.
- [x] Hide call-time labels and controls for Staff/collaborators across web, notifications, exports, ICS, Schedule, Event detail, and iOS.
- [x] Rename event-wide call-time actions to Student call time and apply them only to Student slots/assignments.

### 18. Collaborator assignment support

- [x] Treat an active collaborator with `PUBLISHED_SCHEDULE_VIEW` as eligible for manual Staff-slot assignment.
- [x] Include eligible collaborators in staff pickers without broadening collaborator directory, contact, availability, Trade Board, or Open Work access.
- [x] Give an assigned collaborator worker-facing event visibility and consolidated assignment notifications through the existing sanitized released Schedule contract.
- [x] Keep collaborator reservation-to-schedule inference out of scope unless separately authorized.

### 19. Retire acknowledgements from active scheduling

- [x] Remove acknowledge actions, Unacknowledged filters/readiness counts, and acknowledgement-dependent copy from active web and iOS scheduling surfaces.
- [x] Keep historical fields and tolerant response decoding during rollout; release state reports zero acknowledgement counts.
- [ ] Remove acknowledgement columns from active exports and remaining legacy reporting vocabulary after compatibility review.

### 20. Native iOS adoption and comprehensive verification

- [x] Replace Publish/Discard controls with pending-release timing, revert, and blocked-release recovery in native staff Schedule authoring.
- [x] Keep student and collaborator reads on the last released relational/snapshot schedule and preserve additive rollout tolerance.
- [x] Run focused services/routes/workflow/defaults/collaborator/call-time/trade tests, TypeScript, focused lint, Prisma gates, `build:app`, codemap/docs checks, and diff hygiene.
- [x] Run iOS source contracts, project/drift checks, and the Wisconsin iPhone 16 Pro simulator build; authenticated web/native runtime proof remains open.

## Review: Slices 14–20 (2026-08-07)

- Shipped locally: every working-schedule edit pre-enqueues an exact-version durable Workflow release ten minutes out. Newer edits supersede sleeping runs, permanent validation blockers persist on the pending version, and the old manual release endpoint returns `410`.
- Defaults and people: Settings owns Non-game Staff/Student counts and Student offsets; sync, backfill, and manual event creation generate missing schedules. Neutral-site games with an opponent use the sport Away template. Active collaborators with published-Schedule access may be selected for Staff slots only.
- Timing and visibility: Staff/collaborator slots retain event-window storage for schedule integrity but expose no call-time value or event-time substitute across notifications, exports, ICS, web, and iOS. Only Student slots expose call-time controls. Active acknowledgement controls and readiness state are retired while historical fields remain compatible.
- Verified: 67 focused scheduling/notification/native source tests, TypeScript, focused ESLint, `npm run build:app`, codemap/docs checks, iOS project/drift checks, and the exact iPhone 16 Pro simulator build pass after the neutral/Staff-timing correction. The full repository suite passes 2,974 tests and retains three unrelated failures from concurrent App Store, login-domain, and Social-area work; repository-wide lint still stops in `.tmp/call-time-sync-bundle.mjs`.
- Remaining: apply migration `0109_schedule_timed_release`, deploy the Workflow-capable server before clients, and prove an authenticated ten-minute release and consolidated notification on web/native.

## Review: Slice 6 Native working-copy adoption

- Shipped: Staff Event detail now loads the additive working-schedule editor and routes Add Shift, Assign Person, unassign, duplicate, delete, and call-window actions through optimistic expected-version commands. Native Publish and Discard dialogs explain the private draft boundary and keep worker visibility on the last published crew until release.
- Preserved: Student open-shift pickup, collaborator Schedule, worker-facing reads, Trade Board, ICS, Dashboard, and existing old-client schedule reads remain published-only. Full diff and the one-time repair remain web-only; the native all-assigned call-time action is covered in Slice 12. Assigned-slot replacement is covered in Slice 11.
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

## Review: New-slot call-time fallback follow-up (2026-08-05)

- Shipped: the first new working-copy slot for an area and scheduling class now uses the same Sport settings default window as direct shift creation. The editor response exposes that window so native Add Shift shows and seeds from the configured call time.
- Preserved: an existing same-class peer remains the inheritance source, explicit call-window overrides remain explicit, and all-day events retain date-only boundaries.
- Verified: focused working-copy, editor, route-source, native source-contract, and default-window tests pass; TypeScript, focused ESLint, iOS project consistency, iOS drift, `npm run build:app`, and the generic iOS simulator build pass. The named iPhone 16 Pro destination remains unavailable from the local CoreSimulator service, so device/runtime proof is still open.

## Review: Slice 12 (2026-08-05)

- Shipped: web and native staff authoring can set one call/coverage window for every slot in an event. The action clears personal call-time overrides, validates all assigned users against conflicts and Student availability, and remains private until publish.
- Live correction: with explicit authorization, the settings-owned override inspected 145 active future events across 118 groups, changed 2 groups and 2 shifts, cleared 2 shift overrides and 6 assignment overrides, rebased 1 private working copy, refreshed 1 published group, preserved 83 all-day events as date-only, skipped 5 missing configurations, and wrote two audit records. A post-apply read found no remaining targeted drift.
- Verified: focused call-time, working-copy, route-source, and native source-contract tests pass. Production data verification confirmed the current Women's Soccer group uses 17:00Z–21:00Z and the already-published Volleyball group has its working-copy version and publication version rebased. Authenticated browser and native runtime proof remain open under GAP-60, and these code changes are not deployed from this worktree.

## Review: Slice 13

- Shipped: acknowledgement validity is now assignment-scoped across Schedule summaries, Event detail, and My Shifts. A later group publish no longer makes an unchanged coworker appear unacknowledged; publication continues clearing acknowledgement fields for changed or replaced assignments.
- Verified: 29 focused publication/source-contract tests pass, including the older-acknowledgement regression; focused ESLint, TypeScript, `npm run build:app`, codemap/docs verification, and `git diff --check` pass.
- Preserved: no schema, publication transaction, notification, permission, working-copy, or native response shape changed. Existing unrelated Schedule, iOS, kiosk, schema, and documentation work remains in place.
- Blocked: repository-wide lint still reports two pre-existing errors in `.tmp/call-time-sync-bundle.mjs`; authenticated browser proof is unavailable because the required isolated target and Playwright identity are not configured.
- Next slice or stop: stop after this integrity repair unless an isolated browser identity becomes available or another concrete Schedule failure is selected.

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
