# Active Queue Cleanup - 2026-06-18

Moved from `tasks/todo.md` so the active queue only advertises current work. These sections were already fully checked off and retained here for review/proof history.

---

## Active: Schedule crew UI trim pass (2026-06-18)

- [x] Remove attendance tracking affordances from shift detail UI.
- [x] Remove visible crew template review actions from Event detail and shift detail.
- [x] Remove the Changed recently badge path while keeping review-required change signals.
- [x] Normalize Event detail and Crew badge sizing, casing, and tone.
- [x] Sync Schedule docs, tests, lessons, and codemaps.
- [x] Run focused verification plus type/build checks.

### Review
- Event detail and Shift Detail no longer surface attendance controls, Review template, or Changed recently. Crew badges were normalized locally while retaining Draft, Publish, Review changes, auto-fill preview, and gear readiness.
- Verification: `./node_modules/.bin/tsc --noEmit`; focused Schedule source tests; `git diff --check`; `npm run verify:docs`.
- Broader lint/build-safe checks are being carried forward into the next Schedule event-editing pass so the final working tree is verified as one coherent UI slice.

---

## Active: Schedule event editing clarity pass (2026-06-18)

- [x] Expose manual event type editing for Home, Away, Neutral, and quiet Non-game classification.
- [x] Rename the event edit `Location` control to `Pickup location` and preserve calendar venue as source context.
- [x] Keep Non-game quiet in event detail metadata instead of repeating it across Crew rows.
- [x] Collapse Event detail Crew rows to one call-time range per shift row.
- [x] Sync Schedule/Event docs, source-contract tests, codemaps, and lessons.
- [x] Run focused tests, type/doc checks, whitespace, and build-safe verification.

### Review
- Event edit now has an Event type control for Home, Away, Neutral, and Non-game. Game types expose an Opponent field; Non-game clears the opponent and stays quiet in the event metadata row.
- The old Location selector is now Pickup location. Calendar venue remains separate source context through the imported raw venue text.
- Event detail Crew rows now render one effective call range per row, using personal assignment call time when present and otherwise the slot/default call time. Source badges are suppressed in the dense row so the visible text stays crew-facing.
- Verification: `./node_modules/.bin/tsc --noEmit`; `npm run test -- tests/calendar-events-route.test.ts tests/calendar-sync.test.ts tests/schedule-source-truth-smoke-contract.test.ts tests/schedule-gear-readiness-source.test.ts tests/schedule-template-review-source.test.ts`; `git diff --check`; `npm run verify:docs`; `npm run lint`; `./node_modules/.bin/next build`.
- Note: `npm run build` was not used as final proof because it runs Prisma migration deploy against Neon. This slice did not add a schema migration, so local `next build` is the safer compile proof.

---

## Active: Schedule first-class UI polish pass (2026-06-18)

- [x] Calm the Schedule overview by reducing duplicate top-level metrics and making Automation review collapsed/contextual.
- [x] Tighten Schedule event rows so only action-changing badges stay prominent.
- [x] Make Event detail action priority state-aware, with Set up crew leading when no crew exists.
- [x] Reduce Event detail source/status duplication and make Crew the dominant operational summary.
- [x] Improve Assign shifts and Trade Board empty states with clearer context and recovery actions.
- [x] Make the New event sheet feel content-sized and cleaner without adding unsupported fields.
- [x] Sync Schedule/Event docs and run focused verification.

### Review
- Shipped the Schedule overview, event row, Event detail, Assign empty state, Trade Board empty state, and New Event sheet UI polish pass.
- Verification: `./node_modules/.bin/tsc --noEmit`; focused Schedule/Event source tests; `npm run lint`; `npm run verify:docs`; `./node_modules/.bin/next build`.
- Note: `npm run build` was not used as final proof because it runs Prisma migration deploy against Neon. The sandboxed attempt failed DNS, and escalation was rejected because the command can mutate the shared database. The safer local `next build` passed.

---

## Active: iOS Schedule all-day display correction (2026-06-16)

- [x] Trace the latest screenshots to regular native Schedule and EventDetailSheet, not kiosk.
- [x] Preserve manual event titles when sport metadata has no opponent.
- [x] Use all-day display fallback for list-row timing, EventDetail call-time prompts, and crew-row time columns.
- [x] Add focused source-contract coverage for the iPhone Schedule regression.
- [x] Verify focused tests, iOS drift/audit, whitespace, and simulator build status.

### Review
- 2026-06-18: Verification-only pass completed. The iOS Schedule all-day display contract remains intact: manual titles use `scheduleEventDisplayTitle(event)`, all-day list rows resolve through `timeRowText`/`eventTimeLabel`, and EventDetailSheet hides all-day call-time and crew-row time chrome. The source-contract test was updated to assert the current centralized branch instead of the old inline `Text("All day")` shape.
- Verification: `npm test -- tests/ios-schedule-all-day-display.test.ts`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, `npm run verify:docs`, and XcodeBuildMCP `build_sim` for `Wisconsin` on iPad Pro 13-inch (M5) passed. Build log: `/Users/erole/Library/Developer/XcodeBuildMCP/workspaces/gear-tracker-ff0dd6451482/logs/build_sim_2026-06-18T23-44-37-495Z_pid81673_ae43441b.log`.

---

## Active: Kiosk all-day fallback correction (2026-06-16)

- [x] Re-check the kiosk screenshot and identify every visible time still leaking for the all-day event.
- [x] Add server fallback detection for local midnight-to-midnight event spans when `CalendarEvent.allDay` is stale.
- [x] Add native fallback detection for all-day display when the deployed API payload is stale or missing the flag.
- [x] Suppress aggregate call times and worker call ranges for derived all-day events.
- [x] Verify kiosk route coverage, iOS source contract, drift/audit, whitespace, build status.

### Review
- 2026-06-16: The kiosk now treats local midnight-to-midnight event spans as all-day even when the stored `CalendarEvent.allDay` flag is stale or an older API payload omits it. `/api/kiosk/dashboard` derives `allDay`, nulls aggregate event call ranges, and nulls worker call ranges for those derived all-day events. Native `KioskEvent.displayAllDay` applies the same fallback before rendering the idle row, detail timing rows, and worker sublines.
- Verification: `npx vitest run tests/kiosk-dashboard-route.test.ts tests/ios-kiosk-all-day-contract.test.ts`, focused `npx eslint`, `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check`, `npx next build`, and XcodeBuildMCP `build_sim` on iPad Pro 13-inch (M5) passed. `npx tsc --noEmit --pretty false` remains blocked only by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: Dashboard upcoming event title cleanup (2026-06-16)

- [x] Trace the web Upcoming Events row formatter from the screenshot symptom.
- [x] Confirm the API already provides the real event title plus sport metadata.
- [x] Preserve manual event titles when no opponent exists.
- [x] Add focused regression coverage for the Lambeau-style case.
- [x] Verify focused test, lint, whitespace, typecheck/build status.

### Review
- 2026-06-16: Dashboard Upcoming Events now preserves manual event titles when `sportCode` exists without an opponent, so the Lambeau Field Visit card renders as `Lambeau Field Visit` instead of falling back to `Football`. Structured sport matchups still render with sport plus vs/at opponent copy.
- Verification: `npx vitest run tests/dashboard-event-title.test.ts`, focused `npx eslint`, `git diff --check`, and `npx next build` passed. The first `npx tsc --noEmit --pretty false` run failed before build because stale `.next/types` files were missing; after `npx next build`, `tsc` returned only the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning.

---

## Active: iOS kiosk all-day call-time cleanup (2026-06-16)

- [x] Audit kiosk docs, mobile/event/shift contracts, Prisma event/shift fields, and prior kiosk event/call split.
- [x] Confirm `/api/kiosk/dashboard` owns the iOS idle event payload and currently omits `allDay`.
- [x] Add `allDay` to the kiosk dashboard event contract with rollout-safe Swift decoding.
- [x] Suppress kiosk call-time rows for all-day events while preserving timed event call ranges.
- [x] Add focused regression coverage and verify web/API plus iOS checks.

### Review
- 2026-06-16: iOS kiosk now receives `allDay` on idle dashboard events, decodes it safely in `KioskEvent`, shows all-day rows as `All day`, hides the event detail `Call` row, and removes worker call ranges for all-day events. Timed kiosk events still show event and call ranges separately.
- Verification: `npx vitest run tests/kiosk-dashboard-route.test.ts tests/ios-kiosk-all-day-contract.test.ts`, focused `npx eslint`, `git diff --check`, `npm run drift:ios`, `npm run audit:ios:gaps`, XcodeBuildMCP `build_sim` on iPad Pro 13-inch (M5), and `npx next build` passed. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. The broad `tests/student-field-contracts.test.ts` suite also has pre-existing stale source assertions unrelated to this slice.

---

## Active: Laowa 10mm item detail crash trace (2026-06-16)

- [x] Trace the items-list click path for the Laowa 10mm lens.
- [x] Inspect the newly-created item row and compare it with working item rows.
- [x] Identify whether the failure is route construction, API shape, data shape, or client rendering.
- [x] Fix the smallest root cause if code is responsible.
- [x] Verify with focused tests/build checks and browser/API proof where the environment allows.

### Review
- 2026-06-16: Root cause was client rendering, not route construction. Item detail treated `serialNumber` as a required string even though `Asset.serialNumber` is nullable; a newly-created Laowa 10mm lens with no serial number passed `null` into the Serial text field, which called `.trim()` during render and tripped the app error boundary. The shared item-detail text field now normalizes null/undefined values to an empty string, the detail type reflects nullable serial numbers, and the serial copy callback plus image-search seed helper are null-safe.
- Verification: focused Vitest (`tests/item-detail-firmware-display.test.ts`, `tests/items-response-parsing.test.ts`, `tests/item-detail-actions-source.test.ts`), focused ESLint, `git diff --check`, and `npx next build` passed. `npx tsc --noEmit --pretty false` is still blocked only by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. Live Prisma/API proof for the real Laowa row could not run because this environment cannot reach the Neon database, even with approval.

---

## Active: Event all-day call-window display cleanup (2026-06-16)

- [x] Reproduce the visible issue from the screenshot: the event header shows the all-day date and a duplicate inherited `Call Jun 17, 12:00 AM - Jun 18, 12:00 AM` range.
- [x] Confirm the route uses `CalendarEvent.allDay` with exclusive end dates and shift default windows inherited from the event boundary.
- [x] Hide inherited midnight-to-midnight call windows on all-day event detail chrome while preserving explicit slot or personal call-time overrides.
- [x] Add focused regression coverage for hidden inherited all-day windows and visible explicit overrides.
- [x] Verify focused tests, typecheck status, whitespace, and build. Browser smoke was attempted but blocked because Neon was unreachable from this environment.

### Review
- 2026-06-16: The double label was display duplication, not two separate operational call times. The event title cluster already owns the all-day event date; default shift and assignment call windows were inheriting the same local full-day boundary and rendering it as midnight-to-midnight. Event detail and schedule list now suppress inherited full-day default windows, leaving the date-only event label and crew rows without the redundant time.
- Verification: `npx vitest run tests/shift-call-windows.test.ts tests/calendar-event-dates.test.ts`, focused `npx eslint`, `git diff --check`, `npm run db:migrate:check`, and `npx next build` passed. `npx tsc --noEmit --pretty false` remains blocked by the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined warning. Browser smoke could not reach the real event because both sandboxed and approved Prisma reads could not connect to Neon.

---

## Active: Kiosk-only custody contract (2026-06-15)

Plan: `tasks/kiosk-only-custody-plan.md`

- [x] Capture the product decision: app/web cannot check out or return gear; only kiosk custody flows can.
- [x] Ground the plan in current checkout, reservation, scan, kiosk, and schema contracts.
- [x] Decide the source-reservation close state when kiosk pickup creates the active checkout.
- [x] Slice 1: Contract docs and decision sync.
- [x] Slice 2: Server-side custody boundary enforcement.
- [x] Slice 3: Web/app affordance removal and reservation-first creation.
- [x] Slice 4: Kiosk reservation pickup path.
- [x] Slice 5: Reporting, search, wording, tests, and build verification.

### Review
- 2026-06-15: Product direction is now explicit: checkout in its current web/app form is eliminated. If a user is not physically at a kiosk picking gear up, they reserve gear. Direct immediate checkout remains kiosk-only. Return remains kiosk-only. `PENDING_PICKUP` may survive as a derived waiting state once a reservation reaches its start window but has not yet been collected, not as a web/app-created custody path.
- 2026-06-15: Slice 1 synced the durable contract into `DECISIONS.md`, checkout/reservation/kiosk/scan area docs, and `GAPS_AND_RISKS.md`. Source reservations fulfilled by kiosk pickup should close as `COMPLETED`, preserving `sourceReservationId` on the linked checkout.
- 2026-06-15: Slice 2 shipped the server boundary: regular authenticated checkout creation, reservation conversion, checkout pickup completion, check-in completion, item/bulk returns, and custody scan-session starts now return kiosk-boundary errors. Focused Vitest coverage passed; TypeScript still stops on the pre-existing `tests/bulk-unit-adjustment-routes.test.ts:171` warning.
- 2026-06-15: Slice 3 removed non-kiosk checkout creation, conversion, and return affordances from web and native non-kiosk surfaces. Dashboard, item detail, bookings, event missing-gear, and `/checkouts/new` now route remote booking creation to reservations; checkout detail/list views remain for active custody and history.
- 2026-06-18: Slice 4 shipped the server-side kiosk reservation pickup path. Due `BOOKED` reservations now appear as pickup work at the kiosk, pickup detail/scan/confirm accepts reservations, serialized and numbered-unit scans stage on the source reservation, and confirmation creates an `OPEN` linked checkout through `sourceReservationId`, binds exact numbered units, completes the source reservation, writes kiosk pickup audit, and preserves legacy `PENDING_PICKUP` checkout behavior.
- Verification: `npm test -- tests/kiosk-bulk-detail-routes.test.ts tests/bulk-unit-kiosk-scans.test.ts tests/create-booking.test.ts tests/ios-kiosk-reservation-pickup-contract.test.ts`, `./node_modules/.bin/tsc --noEmit --pretty false`, `npm run verify:docs`, `git diff --check`, `./node_modules/.bin/next build`, and XcodeBuildMCP `build_sim` for `Wisconsin` on iPad Pro 13-inch (M5) passed.
- 2026-06-18: Slice 5 tightened checkout reporting/search wording around the kiosk-only custody contract. Dashboard counts already kept `OPEN` overdue custody, `PENDING_PICKUP` awaiting pickup, and stale `BOOKED` reservations separate; global search already labels checked-out, awaiting-pickup, and booked rows separately. Reports now count checkout activity only for actual custody rows (`OPEN` and `COMPLETED`) across metrics, recent rows, top requesters, heatmap, and CSV export. Reports docs, risk notes, and the reports task note were updated to remove the stale non-draft analytics assumption.
- Verification: `npm test -- tests/reports-service.test.ts`, `./node_modules/.bin/tsc --noEmit --pretty false`, `npm run verify:docs`, `git diff --check`, and `./node_modules/.bin/next build` passed. Authenticated browser smoke on `http://localhost:3045` loaded dashboard, `/reports/checkouts`, `/bookings?tab=checkouts&status=PENDING_PICKUP`, `/reservations`, and `/search` without browser console errors or Next overlays; local API smoke confirmed `/api/reports/checkouts?days=30` returned only `COMPLETED` recent checkout rows, `/api/reservations?status=BOOKED` returned `BOOKED` rows, and dashboard kept pending pickups and stale reservations as separate zero-count lanes. Build emitted existing app-wide lint warnings outside this slice. No native code changed after the Slice 4 simulator proof.

