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
- [x] Add current secure Workflow SDK and Next.js integration.
- [x] Add a booking-specific durable workflow that sleeps until `endsAt - 30 minutes`, then revalidates and sends push-to-start.
- [x] Schedule a fresh run after checkout creation and every return-time change; stale runs fail closed through expected timestamp validation.
- [x] Add source coverage for scheduling plus stale, cancelled, returned, missing-token, already-started, and revoked-token guards.
- [x] Sync Mobile, gaps, task ledger, and codemaps.

## Verification
- [x] Focused Live Activity and workflow tests
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run db:migrate:check`
- [x] `npm run build:app`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin simulator build
- [x] `npm run verify:docs`
- [x] `git diff --check`

## Review
- Shipped: Durable per-checkout scheduling for direct kiosk checkout, reservation pickup, lifecycle edits/extensions, and kiosk return-time edits. A stale run revalidates booking state and expected return time before APNs push-to-start.
- Verified: Production dependency audit reports zero vulnerabilities; focused Vitest 8/8; TypeScript, migration guard, production Next build, iOS drift and audit inventory, Wisconsin simulator build, codemaps, docs, and whitespace all pass.
- Deferred: Production deployment and a real-device timed push-to-start observation.
- Blocked: Live Vercel project/tier inspection remains unavailable through the connected team scope (403), but the source and production build are complete.
- Proof artifacts: Workflow build discovered 1 workflow and 5 steps and generated the expected `/.well-known/workflow/v1/*` routes. Xcode ended with `BUILD SUCCEEDED`.
- Next slice or stop: Deploy, open a short checkout on a real signed-in device with a registered push-to-start token, and verify the card appears at the 30-minute threshold without launching Wisconsin.
