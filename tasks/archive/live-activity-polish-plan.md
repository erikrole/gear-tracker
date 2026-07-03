# Live Activity Polish: lifecycle timing, returned state, continuous gradient, overdue push

Source plan: `/Users/erole/.claude/plans/anything-you-d-improve-with-staged-flame.md`

## Slice 1: Server lifecycle (cron cadence, returned end state, overdue push)
- [x] `vercel.json`: bump `/api/cron/live-activities` schedule from `*/15 * * * *` to `*/5 * * * *`
- [x] `src/lib/push/apns.ts`: `endCheckoutReturnLiveActivityTokens` sends terminal `urgency: "returned"` content-state with `dismissal-date` = now + 120s
- [x] `src/lib/push/apns.ts`: `updateCheckoutReturnLiveActivityTokens` accepts optional `alert: { title, body }` and includes it in `aps` when present
- [x] `src/lib/services/live-activities.ts`: add overdue sweep (OPEN checkouts, active LiveActivityToken, endsAt in last ~6 min), send update push with urgency "overdue" + alert
- [x] `src/app/api/cron/live-activities/route.ts`: call the new sweep alongside `startDueCheckoutReturnLiveActivities`
- [x] No Prisma schema changes

## Slice 2: iOS rendering (returned state, continuous gradient)
- [x] `ios/Wisconsin/LiveActivities/CheckoutReturnActivityAttributes.swift`: add `case returned`, tolerant decoder falling back to `.normal`
- [x] `ios/WisconsinLiveActivities/CheckoutReturnLiveActivityWidget.swift`: continuous piecewise-linear red ramp replacing 4-step switch
- [x] Same file: green "Returned" card state (lock screen + Dynamic Island expanded/compact/minimal with `checkmark.circle.fill`), using `Color.statusText(.green)` brand token
- [x] `ios/Wisconsin/LiveActivities/CheckoutReturnLiveActivityManager.swift`: end current user's activity with `.returned` state + `.after(now+120s)` dismissal when checkout no longer open; keep `.immediate` for stale-activity housekeeping
- [x] No new Swift files -> no xcodegen run needed

## Slice 3: Verification + doc sync
- [x] `npm run build` passes
- [x] iOS: build `Wisconsin` scheme via xcodebuild (includes `WisconsinLiveActivities` extension dependency)
- [x] Add/extend `#Preview` coverage in widget file: normal/warning/critical/overdue/returned
- [x] Change-log entry in `docs/AREA_MOBILE.md`
- [x] Move this plan file to `tasks/archive/` when done
- [x] Single `feat:` commit, push to main
