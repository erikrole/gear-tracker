# Plan 052: Gate restricted Settings routes before rendering their controls

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9e92580f..HEAD -- src/app/\(app\)/settings/layout.tsx src/lib/nav-sections.ts tests/settings-route-role-gate.test.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e92580f`, 2026-07-09
- **Execution**: IMPLEMENTED 2026-07-10. Automated regression, full test, lint, TypeScript, migration, docs, and app-build gates pass. Authenticated direct-route proof remains blocked until a dedicated identity is available on an isolated target.

## Why this matters

Settings navigation hides pages by role, but the shared layout renders any requested child for every authenticated user. A direct URL can therefore mount admin-only controls for students or staff before the API rejects their actions. Server-side API authorization remains intact, but the UI violates the role-adaptive product contract and creates a confusing failure-at-submit experience.

## Current state

- `src/lib/nav-sections.ts` is the canonical Settings route registry and already defines `requiredRole`, `meetsRoleRequirement`, and `isSectionVisible`.
- `src/app/(app)/settings/layout.tsx` filters links through that registry, but its child branch is only `currentUser ? children : null`.
- Personal routes (`profile`, `security`, `notifications`, `appearance`) must remain available to STUDENT.
- STAFF routes include Allowed Emails, Sports, Categories, Departments, and Calendar. ADMIN-only routes include checkout policies, reservation rules, locations, venue mappings, extend presets, escalation, kiosk, database, data export, and audit.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/settings-route-role-gate.test.ts tests/settings-navigation-role-source.test.ts` | all pass |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0 |
| Lint | `npx eslint 'src/app/(app)/settings/layout.tsx' src/lib/nav-sections.ts --max-warnings=0` | exit 0 |
| App build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

## Scope

**In scope**:
- `src/lib/nav-sections.ts`
- `src/app/(app)/settings/layout.tsx`
- `tests/settings-route-role-gate.test.ts` (create)
- Relevant Settings/design docs and task closeout files when implementation ships

**Out of scope**:
- Changing API RBAC
- Moving the Settings directory tree into route groups
- Changing which role owns a Settings page
- Hiding personal Settings from students

## Steps

1. Add a pure helper to `src/lib/nav-sections.ts` that resolves the most-specific Settings section for a pathname and returns whether a role may render it. `/settings` itself must remain available to every authenticated user.
   - **Verify**: focused unit cases cover overview, personal, STAFF, ADMIN, nested paths, and unknown Settings paths.
2. Update the shared Settings layout so it does not render `children` until identity is loaded and the resolved route is permitted. For a known but forbidden route, show a clear access-denied state with a route back to Settings overview or redirect there. Do not briefly mount the restricted page.
   - **Verify**: source/component coverage proves forbidden children are absent for STUDENT and STAFF while allowed children render.
3. Browser-smoke direct URLs as STUDENT, STAFF, and ADMIN. Check one personal, one STAFF, and one ADMIN route per role; verify no privileged controls flash before recovery.
   - **Verify**: authenticated browser notes or screenshots recorded under `tasks/archive/proofs/`.
4. Sync `docs/AREA_SETTINGS.md`, `docs/GAPS_AND_RISKS.md`, and the active task ledger because this corrects the stale claim that Settings route access is fully closed.

## Done criteria

- [x] Direct route rendering follows `SETTINGS_SECTIONS.requiredRole` for all three roles.
- [x] Forbidden child content never mounts visibly.
- [x] Personal Settings remain available to STUDENT.
- [x] Focused tests, TypeScript, focused lint, app build, and whitespace checks pass.
- [ ] Authenticated direct-route proof is recorded.

## STOP conditions

- The route registry no longer uniquely maps Settings paths.
- Correct gating requires changing API permissions or route ownership.
- The implementation would duplicate role matrices across individual pages instead of using the shared registry.

## Maintenance notes

Every new Settings page must be added to `SETTINGS_SECTIONS`; otherwise the shared gate cannot make an intentional role decision. Review unknown-path behavior carefully so typos do not become an authorization bypass or a confusing blank page.
