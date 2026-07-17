# First-session onboarding ownership pass

## Goal

Ship a web-only, role-aware first-session setup flow that begins after invited registration, distinguishes operational readiness from full profile completion, and gives staff/admin one onboarding status view for invitations and active accounts.

## Scope

- Move Wiscard collection from registration to `/welcome`.
- Reuse the existing profile-completion fields and avatar crop/upload path.
- Keep Student, Staff/Admin, and Collaborator requirements distinct.
- Preserve one-day snooze for returning users.
- Derive readiness for all active accounts without storing duplicate status.
- Extend `/users/onboarding-status` with registered-account readiness.

## Verification

- Focused profile-completion, registration, readiness, and source-contract tests.
- TypeScript, lint, app build, and migration health/deploy checks.
- Authenticated browser proof for registration redirect, `/welcome`, returning prompt, and onboarding status when local credentials permit.

## Current state

- Implemented: role-aware completion model, `/welcome` registration handoff, photo crop/upload step, one-day continue-later behavior, and combined invitation/account readiness status.
- Verified: TypeScript, focused unit/route/source tests, lint, local migration-folder integrity, and live Neon health through `0098`.
- Verified: production app build, current docs/codemaps, authenticated `/welcome`, registration without Wiscard collection, and combined onboarding readiness in the local browser.
- Deferred: a destructive end-to-end registration claim and local avatar upload were not performed against shared data/storage. The route and source contracts are covered by focused tests; production storage remains the appropriate upload environment.
