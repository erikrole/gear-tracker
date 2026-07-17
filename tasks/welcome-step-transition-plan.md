# Welcome Step Transition Plan - 2026-07-17

## Goal

- Make forward, back, and optional-skip changes in the web onboarding wizard feel connected without slowing data entry or adding motion to the surrounding Welcome page.

## Route

- Owner area: Users and onboarding.
- Ledger: this focused follow-up plan.
- Existing references: `tasks/first-session-onboarding-ownership-pass.md`, `docs/AREA_USERS.md`, and `docs/BRIEF_ONBOARDING_V1.md`.
- Scope boundary: web only. No mobile, iOS, schema, API, role, field-requirement, snooze, completion, or redirect changes.

## Source Checks

- `/welcome` mounts the shared `ProfileCompletionWizard`; the wizard is also used for returning-user prompts outside `/welcome`.
- The dialog shell already has its own open and close animation. The missing motion is the in-place replacement of the step title, description, and form body after Continue, Back, or Skip for now.
- The body already reserves a `min-h-[300px]`, so a transform-and-opacity transition can avoid layout animation.
- Existing product motion uses `motion/react`, 120 to 200 millisecond timings, and the strong local ease-out curve `[0.16, 1, 0.3, 1]`.
- Existing profile-completion source tests protect role-aware fields, the desktop boundary, and one-day snooze behavior.

## Stop Conditions

- Stop if the transition requires changing the shared Dialog primitive or its open and close animation.
- Stop if keyed step content remounts the outgoing form before its successful save is reflected in the profile-completion query cache.
- Stop if Back, Skip for now, completion, snooze, or the photo crop dialog loses its current focus, disabled-state, or error behavior.
- Stop if the implementation animates layout properties or adds movement when reduced motion is requested.
- Stop if authenticated browser proof shows clipped selects, overlapping fields, visible double content, or stale step copy during rapid navigation.

## Slice 1: Coordinated Step Motion

- [x] Track navigation direction explicitly: `1` for Continue and Skip for now, `-1` for Back. Automatic and manual dialog opening must not animate the initial step.
- [x] Key the changing title/description and form body by `step`, using `AnimatePresence initial={false}` and a shared transition definition.
- [x] Use a crisp overlapping transition rather than `mode="wait"`: incoming content starts at `opacity: 0` with `transform: translate3d(0, 4px, 0)` for forward navigation or `translate3d(0, -4px, 0)` for Back, then settles over 200ms with `[0.16, 1, 0.3, 1]`; outgoing content moves 4px in the opposite direction and fades over 120ms with `[0.4, 0, 0.2, 1]`.
- [x] Keep the dialog shell, step badge, progress rail, error alert, and footer controls outside the keyed form-body transition so the container remains spatially stable and actions stay responsive.
- [x] Honor `useReducedMotion()`: retain a short opacity-only transition and remove translation.
- [x] Preserve the current `min-h-[300px]` body reservation and animate only `transform` and `opacity`.
- [x] Keep focus behavior unchanged unless browser proof exposes a regression; do not auto-focus each step as part of this motion slice.

## Slice 2: Regression Coverage and Closeout

- [x] Extend `tests/profile-completion-web-source.test.ts` to pin `AnimatePresence initial={false}`, keyed step content, direction handling, reduced-motion handling, and transform-plus-opacity-only motion.
- [x] Re-run existing profile-completion behavior tests to prove role-specific steps, validation, snooze, photo, and completion semantics remain unchanged.
- [ ] Add an `AREA_USERS.md` changelog entry only after the transition ships and authenticated browser proof passes.
- [x] Close this plan with shipped, verified, deferred, blocked, proof artifacts, and stop recommendation.

## Verification

- [x] `npx vitest run tests/profile-completion-web-source.test.ts tests/profile-completion.test.ts`
- [x] Focused ESLint for `src/components/profile-completion/ProfileCompletionWizard.tsx` and `tests/profile-completion-web-source.test.ts`.
- [x] `npx tsc --noEmit --pretty false`
- [x] `git diff --check`
- [x] `npm run build:app`
- [ ] Authenticated desktop browser smoke on `/welcome`: initial open, Continue, Back, Skip for now, validation error, reduced-motion emulation, and photo-crop handoff.
- [ ] Slow-motion or frame-by-frame check for double content, abrupt easing, clipped controls, and progress/title/body timing drift.

## Review

- Shipped: Direction-aware, overlapping motion now connects the wizard heading and form body while the dialog shell, progress, error, and footer remain stable. Reduced-motion users receive opacity only.
- Verified: 12 focused tests, focused ESLint, TypeScript, 100 migration-prefix checks, whitespace checks, and `npm run build:app` pass. Authenticated `/welcome` loads at `http://localhost:3001/welcome` with no browser console errors.
- Deferred: conditional Other-field and error-alert entry motion remain separate opportunities; they are not bundled into this step-transition slice.
- Blocked: Erik's authenticated profile is already 100% complete, so the wizard correctly remains closed and the live step transition cannot be exercised without changing account data. The Users area changelog and frame-by-frame interaction proof remain open until an incomplete test account is available.
- Proof artifacts: focused test output, clean TypeScript and ESLint runs, successful app build, authenticated `/welcome` DOM snapshot, and empty browser error log from 2026-07-17.
- Next slice or stop: stop. Do not change account data solely to manufacture visual proof; finish the two remaining verification items with an incomplete test account.
