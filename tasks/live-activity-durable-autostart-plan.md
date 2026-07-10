# Live Activity Durable Auto-Start Plan - 2026-07-10

## Goal
- Start an eligible checkout-return Live Activity approximately 30 minutes before return without requiring the iOS app to launch and without relying on sub-daily Vercel Cron.

## Route
- Owner area: Mobile / Live Activities
- Secondary area: Booking lifecycle and Vercel deployment infrastructure
- Existing implementation: push-to-start tokens and `startDueCheckoutReturnLiveActivities`

## Source Checks
- ActivityKit push-to-start and per-activity token registration already ship.
- The protected `/api/cron/live-activities` sweep already starts eligible activities idempotently.
- `vercel.json` intentionally does not schedule the sweep because repository deployment truth is Vercel Hobby.
- Vercel Workflow supports durable `sleep(Date)` and resumes without holding a serverless function open.

## Stop Conditions
- Stop if Workflow cannot build with the existing Next.js/Sentry configuration.
- Stop if scheduling would run before the booking transaction commits.
- A stale workflow must re-read the booking and no-op when the booking was returned, cancelled, rescheduled, reassigned, or already started.
- Preserve the current protected sweep as a repair/manual fallback.

## Slices
- [ ] Add current secure Workflow SDK and Next.js integration.
- [ ] Add a booking-specific durable workflow that sleeps until `endsAt - 30 minutes`, then revalidates and sends push-to-start.
- [ ] Schedule a fresh run after checkout creation and every return-time change; stale runs fail closed through expected timestamp validation.
- [ ] Add source/service coverage for due, rescheduled, cancelled, returned, missing-token, already-started, and revoked-token paths.
- [ ] Sync Mobile, gaps, task ledger, and codemaps.

## Verification
- [ ] Focused Live Activity and workflow tests
- [ ] `npx tsc --noEmit --pretty false`
- [ ] `npm run db:migrate:check`
- [ ] `npm run build:app`
- [ ] `npm run drift:ios`
- [ ] `npm run audit:ios:gaps`
- [ ] Wisconsin simulator build
- [ ] `npm run verify:docs`
- [ ] `git diff --check`

## Review
- Shipped:
- Verified:
- Deferred:
- Blocked:
- Proof artifacts:
- Next slice or stop:
