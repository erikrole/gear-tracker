# Profile Completion Wizard Ownership Pass - 2026-07-15

## Goal
- Ask returning web users for missing contact, Wiscard, and apparel details through a resumable desktop wizard without blocking normal work.
- Keep the same missing-field truth visible on the signed-in user's web profile, with incomplete fields clearly identified.

## Route
- Owner area: Users
- Surfaces: authenticated web shell, `/users/[id]` for the signed-in user, and self-profile APIs
- Ledger: this file
- Existing references: `docs/AREA_USERS.md`, `docs/BRIEF_ONBOARDING_V1.md`, D-029/D-037 in `docs/DECISIONS.md`
- Unrelated dirty work: booking title and booking lifecycle changes present before this slice; preserve them and avoid shared-file overlap where possible.

## Source Checks
- `User` already owns login email, one legacy phone value, a unique nullable Wiscard lookup value, Athletics email, top size, and shoe size.
- `/api/me/profile` is authenticated, rate-limited, audited, and currently owns the narrow Settings profile editor contract.
- `/profile` redirects to `/users/{currentUserId}`, so profile-page completion state belongs on the self user-detail surface.
- `AppShell` is the one authenticated web owner that can present a return-user prompt once without route duplication.
- Wiscard lookup currently exact-matches the normalized stored value. The completion flow must preserve that lookup token while capturing card number and issue code separately.

## Peer Patterns Checked
- `src/components/onboarding/OnboardingDialog.tsx` for bounded dialog composition, recovery copy, and stable pending actions.
- `src/components/booking-wizard/BookingWizard.tsx` for explicit step state and progress-oriented handoff.
- `src/app/(app)/settings/profile/page.tsx` for current self-profile fetch, save, duplicate-conflict, and cache behavior.

## Stop Conditions
- Stop if real Wiscard lookup requires a delimiter or transformation beyond the confirmed `card number + issue code` concatenation.
- Stop if an existing migration already owns any proposed profile-completion column or enum name.
- Stop if the profile mutation would expose personal/work phone data more broadly than existing PII scopes.
- Stop if current unrelated edits overlap a file in a way that cannot be preserved coherently.

## Slices
- [x] Slice 1: Add additive profile-completion schema fields and a migration that preserves the legacy phone and Wiscard lookup values.
- [x] Slice 2: Add one authenticated, audited profile-completion API and shared missing-field calculation.
- [x] Slice 3: Add the four-step desktop web wizard with per-step saves and a 24-hour server-backed snooze.
- [x] Slice 4: Add self-profile completion guidance and highlight missing fields without changing other users' profile views.
- [x] Slice 5: Add focused API, source-contract, and completion-calculation tests; sync Users docs and risks.
- [x] Hardening follow-up: Make profile and audit writes atomic, mask sensitive audit values, enforce explicit self-profile permission, minimize the response, and validate phone digit count.

## Verification
- [x] Focused Vitest for profile completion, API authorization/validation, and web source contracts.
- [x] `npx prisma generate`
- [x] `npm run db:migrate:check`
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for touched web/API files.
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] Clean production Next build (`npx next build --no-lint`) with focused ESLint verified independently.
- [ ] Authenticated desktop browser smoke for automatic prompt, step saves, snooze, resume, and profile highlighting, or record the concrete blocker.

## Review
- Shipped: Additive profile fields and migration; server-derived completion state; audited per-step saves; 24-hour snooze; desktop-only four-step web wizard; self-profile missing-detail badges and review handoff; legacy phone and kiosk Wiscard compatibility writes; atomic profile/audit transactions; masked audit metadata; explicit self-edit authorization; stricter phone validation.
- Verified: 42 focused profile, PII, wrapper, and route-wrapper tests; Prisma generate and validation; 94 unique migration prefixes; TypeScript; focused ESLint; codemap/docs; whitespace; clean production Next build with all 198 static pages generated. Full suite reached 2,058 passing tests with 7 failures in four unrelated pre-existing dirty-work areas (`booking-lifecycle-route-contract`, `ios-api-contract`, `ios-forced-password`, and `kiosk-checkout-complete-bulk-units`).
- Deferred: Migration deployment and any production rollout remain outside this implementation turn.
- Blocked: Authenticated browser proof is unavailable because no isolated Playwright target or credentials are configured, and a real runtime also needs migration 0092 applied first. The earlier build stall was isolated to stale `.next` output; a clean production build completed successfully with lint verified independently.
- Proof artifacts: Focused command output in this task session; no browser screenshots claimed.
- Next slice or stop: Stop implementation. Apply migration 0092 in a controlled environment, then run authenticated desktop smoke for auto-open, each saved step, one-day snooze, resume, and profile review.
