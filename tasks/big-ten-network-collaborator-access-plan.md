# Big Ten Network Collaborator Access Plan - 2026-07-16

## Goal
- Ship a fixed, default-deny Big Ten Network collaborator profile across web, native iOS, and kiosk before inviting Trey Escobar.
- Replace the fixed profile implementation with one admin-managed, default-deny policy per affiliation while preserving BTN behavior and creating Learfield suspended with no grants.
- Allow reviewed collaborator policies to grant a minimized People directory because BTN, Learfield, Staff, and Students work together in the same physical operation.

## Route
- Owner area: Users and authorization.
- Secondary areas: Reservations, Items, Schedule, Notifications, Mobile, Kiosk, Settings/onboarding.
- Ledger: `tasks/big-ten-network-collaborator-access-plan.md`.
- Existing reference: deferred access matrix in `tasks/todo.md`.

## Source Checks
- The current schema exposes only `ADMIN`, `STAFF`, and `STUDENT`; `AllowedEmail` carries only a role.
- Current role-only permission checks would overgrant a collaborator if represented as a Student or Staff account.
- `ShiftGroup.lastPublishedSnapshot` already preserves approved shift and assignment IDs, so collaborator Schedule reads can avoid live draft state.
- Kiosk identity already supports a staffed name picker; its roster is currently location-scoped.
- Web registration is invite-first, and native iOS links invitees to the web registration flow.

## Stop Conditions
- Stop if a collaborator can reach an internal role-gated route without an explicit capability allowance.
- Stop if published Schedule responses require live draft records or expose internal notes/private contact data.
- Stop if schema generation produces a destructive migration or live migration history disagrees with local folders.
- Stop if existing internal accounts or older iOS clients cannot tolerate the additive auth payload.
- Stop before inviting Trey unless authenticated web, iOS, kiosk, and production authorization proof is complete.
- Stop if affiliation identity becomes the authorization key, an unknown capability can grant access, or a policy save can partially update grants, history, audit, and notifications.
- Stop if the additive policy migration cannot backfill BTN without rewriting already-numbered migrations or breaking rollout-tolerant clients.
- Stop if People-directory access exposes personal phones, Wiscard values, birthdays, apparel sizes, internal activity, bookings, shifts, audit data, hidden users, or inactive users to collaborators.
- Stop if web or native navigation exposes People without the matching server-owned capability.

## Slices
- [x] Slice 1: Add collaborator identity/profile schema, migration, capability policy, auth payload, and invite/registration propagation.
- [x] Slice 2: Add default-deny reservation-safe gear, own-booking, profile redaction, and kiosk roster behavior.
- [x] Slice 3: Add published-snapshot Schedule reads, event follows, auto-follow, and republish notifications.
- [x] Slice 4: Add reduced web collaborator shell and admin onboarding/People presentation.
- [x] Slice 5: Add rollout-tolerant native iOS collaborator models and reduced gear/Schedule/profile surfaces.
- [x] Slice 6: Add focused authorization, privacy, onboarding, Schedule, notification, kiosk, web, and iOS contract coverage.
- [x] Slice 7: Harden every booking response branch, omit linked event objects, deny direct audit history, restrict collaborator event linking to published events, add live-route negative coverage, centralize the fixed profile registry, and make follow state/audit atomic and no-op aware.
- [x] Slice 8: Sync decisions, AREA docs, gaps, codemaps, and this ledger; complete local rollout verification.
- [x] Slice 9: Add affiliation, policy, grant, and immutable revision schema plus an additive BTN backfill and suspended Learfield seed.
- [x] Slice 10: Add the nine-capability catalog, dependency normalization, live policy authorization, suspension, history/restore, previews, auditing, and change notifications.
- [x] Slice 11: Add admin-only affiliation policy APIs and wire invitations, registration, People management, kiosk, reservations, Schedule, and auth payloads to policy grants.
- [x] Slice 12: Add the Collaborator Access Settings editor with risky-change confirmation, affected counts, history, restore, and constrained archival.
- [x] Slice 13: Make web and iOS collaborator navigation capability-driven while preserving additive response decoding and the fixed BTN rollout fallback.
- [x] Slice 14: Add policy matrix, privacy, IDOR, migration, and native verification; amend collaborator decisions/docs and close the local implementation phase. Authenticated production smoke remains a deployment gate.
- [x] Slice 15: Add `PEOPLE_DIRECTORY_VIEW`, grant it to BTN and Learfield through an additive audited policy migration, expose a minimized active-user directory and profile response, wire capability-driven web and native navigation, and add authorization/privacy regression coverage.
- [x] Slice 16: Repair collaborator mobile onboarding so the server and native models expose only the optional photo step and Skip enters the app without requiring a phone.
- [x] Slice 17: Retire the legacy BTN capability fallback, reject policy-less collaborator sessions, and neutralize BTN-specific copy on shared Schedule and People surfaces.

## Verification
- [x] Focused Vitest suites for collaborator onboarding, capability denial, privacy, reservations, Schedule snapshots/follows, notifications, and kiosk roster.
- [x] `npx prisma format`
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npm run db:migrate:health` (100/100 applied through `0098`; no pending, failed, or database-only rows)
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin and WisconsinKiosk simulator and generic-device verification builds.
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Controlled full `npm run build` after migration deploy approval; Neon fallback found no pending migrations and the production app build passed.
- [ ] Authenticated browser smoke for admin invite, collaborator registration, reduced navigation, reservations, published Schedule, following, privacy, and denied routes.
- [ ] Authenticated browser and native smoke for collaborator People list/detail access, capability denial, and private-field omission.
- [x] Add `npm run smoke:collaborator` as the credential-injected production proof for People capability, list/detail minimization, active/visible roster scope, and representative denied routes.

## Review
- Shipped locally: database-backed affiliation policies, ten validated capabilities, invite-first onboarding, skippable collaborator photo setup, minimized People access, sanitized gear, own reservations, kiosk roster/custody, published Schedule/follows/notifications, capability-driven web and native shells, immutable revisions, and suspension/reactivation.
- Production smoke command: `COLLABORATOR_SMOKE_EMAIL=... COLLABORATOR_SMOKE_PASSWORD=... COLLABORATOR_SMOKE_EXPECTED_AFFILIATION=LEARFIELD npm run smoke:collaborator`.
- Verified: 66 focused affiliation, authorization, onboarding, Schedule, and capability-aware iOS tests pass. TypeScript, full ESLint, `build:app`, the controlled deploy-shaped build, codemap/docs verification, iOS drift/audit, and both Wisconsin and WisconsinKiosk simulator and generic-device builds pass. Prisma validation, formatting, migration checks, and live migration health pass.
- Hardening verification covers response redaction, audit-history denial, prohibited live routes, cross-user IDOR behavior, dependency normalization, unknown-grant rejection, optimistic conflicts, atomic revisions/audits/notifications, published-only event linking, and follow mutation behavior.
- 2026-07-16: Live Neon health confirms 100/100 local migrations applied through `0098_affiliation_policy_editor` with no pending, failed, or database-only rows. The deploy-shaped build independently confirmed that the Neon fallback had no pending migrations.
- Deferred:
- Authenticated browser smoke and production temporary-account smoke remain deferred until deployment credentials and a safe disposable collaborator account are available.
- Blocked:
- The repository-wide Vitest run is not fully green: after reconciling the three capability-aware source contracts, 2,160 of 2,170 tests pass. The remaining 10 failures across 7 files belong to unrelated active work in booking title normalization/idempotency, kiosk/guide UI source contracts, forced-password source expectations, and `SaveableField` accessibility. Affiliation-focused suites remain green.
- 2026-07-16: Canonical migration generation failed twice with a blank Prisma schema-engine error and live TLS failed with P1011. After explicit user approval, reviewed additive SQL was written as two migrations so PostgreSQL does not consume a newly added enum value in the same transaction that creates it.
- 2026-07-16: After explicit user authorization to migrate everything, reviewed additive migration `0098` was applied through the Neon HTTP fallback. Health now reports 100/100 applied with no pending, failed, or database-only rows.
- Proof artifacts:
- `prisma/schema.prisma`, migrations `0095` through `0098`, policy and negative-route tests, migration health, and both Wisconsin target verification builds contain the implementation proof.
- Next slice or stop:
- Deploy the server and clients, run authenticated production smoke with a temporary account, configure and activate Learfield only after admin review, then invite Trey. Do not invite external collaborators from the current local-only state.
