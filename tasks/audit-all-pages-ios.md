# Audit: all pages (iOS) - 2026-05-13

**MVP verdict:** READY

This is a consolidated source-grounded audit of all current Wisconsin iOS pages, sheets, and kiosk surfaces. It does not fix code. It reconciles current source against the existing per-surface audit records, the mobile area contract, the decision log, and the open gaps registry.

## Verification

- [x] `npm run drift:ios` passes: no anti-patterns across 45 Swift files.
- [x] `npm run audit:ios:gaps` passes: 34 audit-worthy surfaces, 34 covered, 0 missing audit records.
- [x] `xcodebuild -scheme Wisconsin -project ios/Wisconsin.xcodeproj -destination 'generic/platform=iOS Simulator' -configuration Debug build` succeeds.
- [x] Initial root-level `xcodebuild` attempt failed because the repo root is not the Xcode project directory; rerun with `-project ios/Wisconsin.xcodeproj` succeeded.

## Sources

- `docs/AREA_MOBILE.md`
- `docs/AREA_KIOSK.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `ios/Wisconsin/App/WisconsinApp.swift`
- `ios/Wisconsin/App/AppDelegate.swift`
- `ios/Wisconsin/Core/APIClient.swift`
- `ios/Wisconsin/Core/AppState.swift`
- `ios/Wisconsin/Core/GearStore.swift`
- `ios/Wisconsin/Core/NetworkMonitor.swift`
- `ios/Wisconsin/Core/SearchService.swift`
- `ios/Wisconsin/Core/SessionStore.swift`
- `ios/Wisconsin/Models/*.swift`
- `ios/Wisconsin/Views/**/*.swift`
- `ios/Wisconsin/Kiosk/*.swift`
- `tasks/audit-*-ios.md`
- `tasks/hig-audit-ios.md`

## Executive finding

No current P0 or P1 source-verifiable blockers remain across the iOS app pages. The app matches the V1 mobile direction: Home is action-first, Scan is one tap from the tab bar, student flows prioritize own due/overdue work, staff/admin controls are present without crowding the student path, and kiosk is the canonical checkout/pickup/return execution surface.

The remaining gaps are expected P2 parity or scale items already documented in `docs/GAPS_AND_RISKS.md`, `docs/AREA_KIOSK.md`, and the per-surface audit records. They should not block TestFlight or MVP unless product direction changes toward staff-mobile parity.

## Surface verdicts

| Surface | Verdict | Notes |
|---|---:|---|
| Login | READY | Email trim/lowercase, password manager hints, forgot-password link, visible loading/error state, and error accessibility announcement are present. |
| Root/App shell | READY | Session restore, kiosk routing, push pre-prompt, theme selection, memory warning cache cleanup, foreground badge refresh, and offline banner paths are wired. |
| Tab navigation | READY | Home, Bookings, Items, Scan, Schedule, and Users are exposed; Scan is one tap and uses search-role tab semantics; badges and reset behavior are present. |
| Home/dashboard | READY | Current source is action-queue-first with stat strip, overdue/due/pickup/shift prioritization, staff exception work below the main queue, notification/profile/create entry points, push routing, and empty/error states. |
| Profile/preferences | READY | Notification pause/channel controls, OS push permission truth, theme selection, staff tools, sign-out confirmation, and web-account handoff are present. |
| Notifications sheet | READY | Loading, empty, error, refresh, infinite pagination, mark-read gestures, and routing to booking/trade/asset/user destinations are present. |
| Global search | READY | Results route to item, booking, and user details; server failure is distinct from no-results; scanner entry and recents are present. |
| Scan | READY | Camera permission pre-prompt, denied fallback, VoiceOver manual-entry fallback, manual entry, torch handling, duplicate-scan suppression, retry, and direct item routing are present. |
| Bookings list | READY | Reservation/checkout toggle, mine-only filter, search, loading, empty, error, pagination retry, stale-load cancellation, pull refresh, create sheet, and detail routing are present. |
| Booking detail | READY | Loading/error paths, refresh, role/ownership-gated actions, edit sheet discard protection, extend sheet, cancel confirmation, kiosk pickup/return handoff copy, and item/bulk sections are present. |
| Create booking | READY | Existing audit P0/P1 items are closed; current callers route newly created bookings back into the navigation stack. |
| Extend booking | READY | Existing audit P0/P1 items are closed; inline loading, discard protection, disabled in-flight picker, presets, haptics, and server error surfacing are present. |
| Items list | READY | Search, status filter, favorites, reserve from row, loading, empty, error, pagination retry, stale-load cancellation, and detail routing are present. |
| Item detail | READY | Loading/error paths, favorite rollback/toast, staff/admin edit gate, reserve CTA, edit sheet discard protection, QR copy feedback, active booking, reservations, parent/accessory, and notes sections are present. |
| Schedule | READY | List/calendar modes, my-shifts filter, staff/admin past-events toggle, trade board, ICS subscription, stale-data indicator, non-blocking refresh error, event detail sheet, push routing, and tab reset are present. |
| Event detail | READY | Existing audit P0/P1 items are closed; staff/student shift actions and event gear context are covered by current models and API client methods. |
| Add shift | READY | Existing audit P0/P1 items are closed; remaining discard/picker polish is P2. |
| Assign student | READY | Existing audit P0/P1 items are closed; sport-roster filtering and pagination are P2. |
| Post trade | READY | Existing audit P0/P1 items are closed; empty-state and object-return polish is P2. |
| Trade board | READY | Existing audit P0/P1 items are closed; pagination/filter polish is P2. |
| Users list | READY | Search, role filters, inactive toggle, pagination, row routing, role/identity treatment, and reset behavior are covered by current source and prior audit closure. |
| User detail | READY | Profile header, avatar, badges/gallery, contact rows, booking context, and notification routing are covered by current source and prior audit closure. |
| Overdue report | READY | Staff/admin report exists with loading/error/empty states and booking-row drilldown; remaining web chart/export parity is intentionally out of mobile V1. |
| Link sticker wizard | READY | Staff tool only; current audit P0/P1 items are closed. Existing QR overwrite warning/history/bulk-linking items remain P2. |
| Kiosk activation | READY | Activation code entry, paste, loading/error, stored device state, session validation, and activation fallback are present. |
| Kiosk idle | READY | Location roster, live dashboard polling, stale data, deactivation confirmation, and avatar polish are covered; roster search is P2 scale work. |
| Kiosk student hub | READY | Student checkout/pickup/return/reservation context and action routing are present; cart-in-progress hint is P2. |
| Kiosk checkout | READY | HID scanner field, camera fallback, scan feedback, remove mis-scan, race guard, complete path, and server error surfacing are covered by current audit closure. |
| Kiosk pickup | READY | Serialized and numbered battery scan checklist, confirm guard, server error surfacing, camera feedback, race guard, and success routing are covered. Mid-session scan-state hydration from server remains P2. |
| Kiosk return | READY | Serialized and numbered battery return checklist, complete guard, server-counted success, server error surfacing, camera feedback, and race guard are covered. |
| Kiosk success | READY | Terminal success with haptic/VoiceOver/Done path is covered; celebration variants are P2. |

## Open P2 items

These are not MVP blockers:

- `GAP-34`: iOS Bookings list does not expose the full web status scope and column sorting. This is acceptable for V1 because mobile is focused on student active work, not desk-style filtering.
- `GAP-35`: iOS Booking detail does not show per-item conflict badges. Server enforcement remains authoritative; client preflight badges are staff parity.
- `GAP-36`: iOS Item detail does not expose Duplicate, Retire, Delete, or Needs Maintenance. V1 mobile keeps destructive/admin lifecycle work web-owned.
- Kiosk does not expose manual tag entry, roster search/filter, or wrong-person undo. `AREA_KIOSK.md` explicitly treats those as acceptable V1 tradeoffs for staffed-counter operation.
- Global Search does not deep-link category-level "view all" into destination tabs and does not cancel in-flight URLSession requests. Current source drops stale results and surfaces errors, so this is bandwidth/polish work.
- Notifications mark-read calls are optimistic and can temporarily lie until refresh if the server fails. The current list can be refreshed and the action is not custody-critical.
- Schedule lacks web-style week view, full filter bar, My Hours strip, and shift detail panel. This is parity work, not a student core-flow blocker.
- Licenses are web-owned for V1. The iOS audit record keeps a possible "My license" mobile surface as post-MVP.

## Readiness lenses

- Student core flows: covered across Home, Bookings, Items, Scan, Schedule, Notifications, Profile, and Kiosk.
- Loading/empty/error/success paths: covered on all high-traffic pages and kiosk flows; non-blocking stale/refresh states exist where needed.
- Offline/intermittent network: global offline banner, humanized network errors, cached booking/item/schedule seeds, and retry paths exist. Full offline mutation queue remains intentionally out of V1 scope.
- Expired session: `APIClient.perform` posts `.sessionDidExpire`; `SessionStore` clears the user and RootView returns to Login.
- Role-specific affordances: staff/admin controls are gated in Home, Profile, Bookings, Booking Detail, Item Detail, Schedule, Users, and Overdue Report; students keep own-work paths.
- SwiftUI navigation and sheets: route wrappers avoid ambiguous `String` destinations where needed; sheets have detents and reset paths; tab reselection resets local stacks/filters.
- Safe area/Dynamic Type/dark mode/tap targets/SF Symbols: current source uses standard SwiftUI controls, 44pt toolbar controls in key surfaces, dark-mode token colors, combined accessibility rows, hidden decorative icons, and VoiceOver scanner fallback.
- API rollout skew: current iOS models decode active dashboard, booking, item, user, notification, schedule, badge, and kiosk payloads; build proof confirms the current schema compiles.
- Web/iOS parity: remaining gaps are informational P2 parity items unless staff-mobile becomes the next product direction.

## Staff-engineer conclusion

Ship candidate. The app is not "perfect parity with web"; that is the point of the current iOS direction. The source and checks support TestFlight/MVP readiness for student daily work and staffed kiosk execution. The next sensible fix batch, if you want one after this audit, is not broad readiness work. It is one focused P2 slice: either booking conflict badges, item admin lifecycle actions, or kiosk roster/manual-entry scale polish.
