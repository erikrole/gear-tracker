# Notifications support hardening plan

Scope: tighten current notification reliability without changing delivery policy, APNs credentials, escalation timing, or native iOS settings behavior.

- [x] Audit current notification docs, schema, services, web inbox, app shell badge count, iOS sheet/settings, and focused tests.
- [x] Route app-shell unread badge refresh through the lightweight count endpoint instead of the full inbox endpoint.
- [x] Make the unread-count endpoint no-store so browser cache does not preserve stale bell counts after read-state changes.
- [x] Keep web notification type styling aligned with current reseeded checkout escalation types.
- [x] Restore license notification sent timestamps and category-gated expiry push delivery.
- [x] Keep manual badge awards inbox-only per the documented badge notification contract.
- [x] Refresh the stale cron source assertion for the intentional live-activities cron route.
- [x] Add focused source-contract coverage for the badge-count and type-styling contracts.
- [x] Sync Notifications docs and task ledger.
- [x] Reconcile stale D-009, cron timing, and active-risk notification documentation.
- [x] Run focused tests, TypeScript, docs/codemap check, whitespace, and app build.

## Review

- 2026-07-03: Audit found the shell was calling `/api/notifications?limit=0&unread=true`; `parsePagination` treats `limit=0` as the default page size, so chrome count refreshes could fetch inbox rows instead of using the dedicated count route. The count route also returned a short private cache response, which can keep the bell stale after mark-read actions. Current escalation migrations reseeded checkout types to `checkout_due_1h`, `checkout_overdue_1h`, `checkout_overdue_3h`, and `checkout_overdue_8h`, while the web inbox styling only recognized the older `checkout_due_reminder` and `checkout_overdue_2h` names. Follow-up doc reconciliation updated stale D-009, cron timing, and fatigue-risk wording to current shipped behavior.
- 2026-07-03: Second audit wave found license notifications without `sentAt`, license-expiry pushes bypassing the exposed `licenseExpiry` category toggle, manual badge awards sending push despite the inbox-only badge contract, and a stale schedule automation test that did not allow the intentional live-activities cron route. Those are folded into this slice.
- 2026-07-03: Verification passed with focused Vitest (`tests/notifications-support-hardening.test.ts`, `tests/notifications-count-route.test.ts`, badge, cron, route, nudge, policy, and iOS category tests), `npx tsc --noEmit`, codemap regeneration, `npm run verify:docs`, `git diff --check`, and `npm run build:app`.

## Follow-ups from audit

- APNs send helpers still need explicit request/session timeouts so stalled push delivery cannot consume cron/serverless budgets.
- iOS cold-start push routing should buffer pending destinations before `sharedAppState` exists.
- Generic pushed `href` payloads, badge/license/firmware push tap-through, and low-stock `bulkSkuId` inbox routing need a dedicated native navigation slice.
- iOS Home/app-icon unread badge freshness needs a product decision on visible numeric count and APNs `aps.badge` behavior.
