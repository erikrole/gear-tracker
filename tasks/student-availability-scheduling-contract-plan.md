# Student Availability Scheduling Contract Plan - 2026-06-30

## Goal
- Make student availability follow the user's scheduling class so profile, scheduling, auto-assign, Open Work, Trade Board, and iOS all treat Student workers consistently even when app permission role is Staff.

## Route
- Owner area: Schedule
- Secondary areas: Users, Mobile
- Ledger: `tasks/todo.md`
- Existing plan/archive references: `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`, `docs/AREA_SHIFTS.md`, `docs/AREA_USERS.md`, `docs/AREA_MOBILE.md`

## Source Checks
- `docs/NORTH_STAR.md` says permission role and scheduling class are separate when workflows need the distinction.
- `docs/AREA_SHIFTS.md` records `User.staffingType` as the Schedule source for assignment routing, candidate scoring, Open Work pickup, and trade eligibility.
- `docs/AREA_USERS.md` still describes Availability Blocks as student-owned by role, which now needs updated wording.
- `docs/BRIEF_STUDENT_AVAILABILITY_V1.md` records the original role-based V1 plus later preference/time-off expansion.
- `prisma/schema.prisma` already stores `StudentAvailabilityBlock` independently from `User.role`, and `User.staffingType` already exists.
- `src/app/api/users/[id]/availability/route.ts` currently rejects targets whose app role is not `STUDENT`.
- `src/app/(app)/users/[id]/page.tsx` currently shows the Availability tab only when `profile.role === "STUDENT"`.
- `ios/Wisconsin/Views/ProfileView.swift` currently shows My Availability only from `session.currentUser.role == "STUDENT"`.
- `ios/Wisconsin/Models/Models.swift` does not decode `CurrentUser.staffingType`, so native cannot apply the scheduling-class contract yet.

## Stop Conditions
- Stop if `/api/me` cannot safely expose `staffingType` to the native session model.
- Stop if existing tests prove availability must remain app-role-only despite the Schedule worker-class decision.
- Stop if changing the target eligibility would allow non-Student scheduling classes into Student availability blocks.

## Slices
- [x] Slice 1: Align availability ownership and entry points with scheduling class.
- [x] Slice 2: Add profile availability impact summary and clearer buckets.
- [x] Slice 3: Improve auto-fill skipped-reason explanations.
- [x] Slice 4: Surface availability blockers and preferences earlier in Open Work and Trade Board rows.
- [x] Slice 5: Expand native iOS availability display and creation parity for weekly, ad hoc, preference, dislike, and time off signals.
- [x] Slice 6: Recompute affected future assignment conflict state when availability changes.

## Verification
- [x] Focused Vitest for availability routes and source contracts: `npm test -- --run tests/student-availability-routes.test.ts tests/student-field-contracts.test.ts`.
- [x] iOS source-contract coverage for `CurrentUser.staffingType` and My Availability scheduling-class gating.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [ ] `npm run ios:xcode:verify` current full native build proof, or record why blocked.
- [x] XcodeBuildMCP simulator build, launch, and UI snapshot for native runtime proof.
- [x] Focused source-contract coverage for profile availability impact copy.
- [x] Focused Vitest for auto-fill skipped-reason explanations: `npm test -- --run tests/auto-fill-preview.test.ts tests/auto-assign-preview-commit.test.ts`.
- [x] Focused Vitest for Open Work and Trade Board availability context: `npm test -- --run tests/schedule-open-work.test.ts tests/shift-trades.test.ts tests/shift-trades-route.test.ts tests/schedule-open-work-source.test.ts`.
- [x] Focused source-contract coverage for iOS availability parity: `npm test -- --run tests/student-field-contracts.test.ts`.
- [x] Focused Vitest for availability conflict refresh: `npm test -- --run tests/student-availability-routes.test.ts`.
- [ ] Authenticated browser smoke for `/users/[id]?tab=availability`, or record why blocked.

## Review
- Shipped: Slice 1 aligns availability ownership with `User.staffingType = ST`; web profile Availability tab and native iOS My Availability now follow Student scheduling class; `/api/me` and login responses include `staffingType`. Slice 2 adds the web profile Scheduling impact summary, separates blocking approved time off from advisory conflicts and preferred windows, skips denied time off for next dated exception, and broadens weekly/dated bucket labels. Slice 3 adds stable auto-fill skipped reason codes plus candidate, scheduling-class, area-fit, approved time-off, overlap, and already-proposed counts; Shift Detail and Event detail preview dialogs render the concise reason plus supporting details. Slice 4 adds availability context to Open Work and Trade Board rows, moves approved-time-off blocked trade claims into Waiting or Blocked, shows staff claimed-worker blockers before approval, and rejects approved-time-off trade claims before staff review. Slice 5 expands native iOS My Availability beyond weekly class conflicts so it displays and creates weekly, ad hoc, preference, dislike, and time-off signals through the existing availability API. Slice 6 recomputes future active assignment conflict flags after availability create, update, review, and delete so Schedule queues, exports, and assignment review do not keep stale conflict state.
- Verified: Focused Vitest, TypeScript, codemap/docs checks, whitespace check, and `npm run build:app` passed for Slice 2. Focused auto-fill Vitest, TypeScript, codemap/docs checks, whitespace check, and `npm run build:app` passed for Slice 3; the app build still reports the existing unused `kind` warnings in `src/lib/booking-status-display.ts`. Focused Open Work and Trade Board availability-context Vitest and TypeScript passed for Slice 4. Earlier Slice 1 iOS drift, iOS gap audit, and unsandboxed Xcode verification passed. Slice 5 passed focused source-contract Vitest, TypeScript, iOS drift, iOS gap audit, codemap/docs checks, whitespace check, and `npm run build:app`. Slice 6 passed focused availability route Vitest, TypeScript, codemap/docs checks, whitespace check, and `npm run build:app`; the app build still reports the existing unused `kind` warnings in `src/lib/booking-status-display.ts`. Continuation proof on 2026-06-30 passed the combined availability-focused suite (`87` tests across route, source-contract, profile UI, auto-fill, Open Work, and Trade Board coverage), `npm run drift:ios`, and `npm run audit:ios:gaps`.
- Deferred: No further implementation slices remain in this plan; final browser runtime proof still needs an approval path or an already-running authenticated runtime.
- Blocked: Current `npm run ios:xcode:verify` reached source compilation but failed in the sandbox because CoreSimulator was unavailable and Swift macro plugin calls were sandbox-blocked. The required unsandboxed rerun was rejected by the approval layer before execution. XcodeBuildMCP then provided native runtime proof: simulator compile succeeded with no diagnostics, build/install/launch succeeded on the configured iPhone 17 simulator, and a UI snapshot confirmed the launched app rendered the Wisconsin Creative sign-in screen. Authenticated browser smoke remains blocked in this environment: Chrome has only `about:blank`, `npm run dev` failed with sandbox `listen EPERM` on `0.0.0.0:3000`, and the unsandboxed dev-server request was rejected by the approval layer before execution.
- Proof artifacts: Terminal output from the commands listed above; current focused web/API/iOS source-contract coverage passed, current iOS drift/audit checks passed, XcodeBuildMCP artifacts are in `/Users/erole/Library/Developer/XcodeBuildMCP/workspaces/gear-tracker-ff0dd6451482/logs/`, and current dev-server runtime attempts failed for environment/approval reasons.
- Next slice or stop: Keep the plan active until authenticated browser smoke can run, or the user explicitly accepts source/build proof in place of browser proof for this availability goal.
