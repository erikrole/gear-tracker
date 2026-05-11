# Scan Ownership Pass

## Goal
Make the app `/scan` surface match the current custody contract: app scan is lookup-only, while checkout pickup and return scans run through kiosk routes.

## Sources Checked
- `docs/AREA_SCAN.md`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_DASHBOARD.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `tasks/kiosk-gate-pending-pickup-plan.md`
- `src/app/(app)/scan/page.tsx`
- `src/app/(app)/bookings/BookingDetailPage.tsx`
- `src/app/(app)/dashboard/overdue-banner.tsx`
- `src/components/AppShell.tsx`
- `src/app/api/checkouts/[id]/scan/route.ts`
- `src/app/api/checkouts/[id]/checkin-scan/route.ts`
- `tests/scan-route-gate-contract.test.ts`

## Plan
- [x] Confirm the app scan execution endpoints are kiosk-gated stubs.
- [x] Find all app UI links that still target `/scan?checkout=...`.
- [x] Convert `/scan` to a lookup-only surface with a legacy deep-link warning.
- [x] Remove the unused app booking-mode scan hook/components.
- [x] Replace stale checkout/check-in scan links with kiosk-handoff UI or checkout detail routing.
- [x] Update docs and the kiosk gate plan so the product contract is explicit.
- [x] Add regression coverage for lookup-only app scan UI.
- [x] Run focused tests, typecheck, full Vitest, production build, whitespace verification, and browser smoke.

## Review
Shipped as a lookup-only app scan pass. Verified `/scan` and a legacy `/scan?checkout=...&phase=CHECKIN` deep link in Chrome DevTools against a fresh dev server on port 3003. The lookup page rendered with the Lookup breadcrumb/nav label, manual entry submitted and produced a not-found feedback state, the legacy deep link rendered the kiosk handoff with View checkout/Clear actions, and the console had no warnings or errors.
