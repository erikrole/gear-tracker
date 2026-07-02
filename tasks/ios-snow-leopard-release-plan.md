# iOS Snow Leopard Release Plan

Created: 2026-07-02

## Goal

Ship a broad iOS polish and foundation release without changing the current product contract: native SwiftUI, action-first Home, five-tab compact shell, kiosk-owned custody, and web-owned heavy admin workflows.

Apple feel is a hard constraint for every slice: prefer native SwiftUI controls, system navigation, sheets, toolbars, search, lists, menus, button styles, materials, accessibility behavior, and current platform APIs before inventing custom chrome.

## Source Baseline

- `docs/AREA_MOBILE.md`: native iOS Home is an action queue, Search stays one tap in the tab bar, and scan lives inside Search.
- `docs/AREA_DASHBOARD.md`: dashboard is an action console, not a reporting surface.
- `docs/DECISIONS.md`: D-015 keeps mobile student-first and role-adaptive; D-040 keeps custody kiosk-owned.
- `docs/GAPS_AND_RISKS.md`: remaining iOS gaps are expected staff-mobile parity items, not V1 blockers.
- `tasks/audit-dashboard-ios.md`: original Home P0/P1 issues are closed; remaining Home work is P2 polish.
- `docs/IOS_PATTERNS.md`: keep status tokens, native controls, shared card surfaces, centralized haptics, explicit accessibility labels, and source-contract tests.
- Apple Human Interface Guidelines and SwiftUI docs: use the current Apple guidance as the design tiebreaker for tab identity, navigation, search placement, sheets, buttons, lists, toolbars, accessibility, and modern framework adoption.

## Slice Order

1. [x] Baseline iOS drift and audit inventory.
2. [x] Slice 1: Home polish and release-proofing.
   - Reconcile stale Home audit notes against current source.
   - Make the stat strip read as quick triage, not another full card stack.
   - Keep all-clear recovery aligned with the Search tab plus in-surface scan contract.
   - Add source coverage for the no-debug-kiosk release posture.
3. [x] Slice 2: Booking Detail action polish.
   - Review current `BookingDetailView.swift`, `ExtendBookingSheet.swift`, booking action policy, and active audit notes before changing controls.
   - Check native SwiftUI/HIG fit before changing any action placement, sheet behavior, or button style.
   - Improve low-risk copy/action hierarchy only if the source still shows friction.
4. [x] Slice 3: Bookings tab freshness and queue clarity.
   - Remove stale cached-row flashes on tab entry, refresh, search, and scope changes.
   - Prefer a native segmented scope control for Mine, All, and Needs Attention.
   - Surface refresh trust without turning the list into a dashboard.
   - Keep creation visibly reservation-first under D-040.
5. [ ] Slice 4: Create Booking equipment recovery check.
   - Reconcile the older selected-items audit note with the split Create Booking sources.
   - Patch only if current selected-equipment removal is still hard to recover.
6. [ ] Slice 5: Search and scan recovery sweep.
   - Verify camera-denied, typed-code, retry, and result routing stay coherent after Search became the trailing tab.
   - Keep scanner entry inside the native Search surface unless current Apple guidance or a real field workflow proves a better native pattern.
7. [ ] Slice 6: Foundation hardening.
   - Sweep Codable tolerance, source-contract gaps, stale audit notes, and iOS project membership before final verification.

## Verification Gates

- Focused Vitest source-contract tests for each slice.
- `npm run drift:ios`.
- `npm run audit:ios:gaps`.
- `npm run ios:project:check` when Swift file membership changes.
- `git diff --check`.
- `npm run verify:docs`.
- `npm run ios:xcode:verify` before calling the release pass ready.
- `npm run build:app` before commit or push if shared web/docs/package behavior changes.

## Review

- 2026-07-02: Started Snow Leopard with a current-source audit. Baseline `npm run drift:ios` and `npm run audit:ios:gaps` passed before implementation.
- 2026-07-02: Slice 1 shipped locally. Home stat tiles now use the raised tile surface and active-only tone shadow, the all-clear recovery points to Search or Scan, and source tests guard that Home does not reintroduce DEBUG kiosk entry points. Verified focused Vitest, TypeScript, iOS drift, iOS audit gaps, docs check, whitespace, and unsandboxed iOS Xcode verification.
- 2026-07-02: User clarified that Snow Leopard should stay Swift-native and Apple-feeling, using Apple HIG and the newest appropriate SwiftUI frameworks as guidance. Added that as a release guardrail before continuing with Slice 2.
- 2026-07-02: Home all-day event follow-up shipped locally. Event-work rows now use the existing Schedule all-day display math, show date-only `All day` metadata, suppress call-time sublines, and avoid midnight pickup copy for all-day event gear prep.
- 2026-07-02: Home header follow-up removed the AFM/deterministic summary subline. The hero now keeps the date, a deterministic day-varying local greeting, and the user's first name while leaving operational urgency in the stat strip and Next Up queue.
- 2026-07-02: Slice 2 details-edit pass shipped locally. Booking Detail now has a clear Details card with `Edit Details`, an HIG-shaped edit sheet using standard Cancel/Save toolbar actions, reservation pickup-location editing through the existing optimistic-lock booking PATCH path, and read-only Equipment copy that keeps item custody in kiosk workflows.
- 2026-07-02: Slice 3 started from the current native Bookings source after the user reported old or ghost rows flashing on tab entry and refresh. The slice now covers freshness, native scope controls, Needs Attention, row scan clarity, and explicit New Reservation wording.
- 2026-07-02: Slice 3 shipped locally. Bookings no longer paints cached booking rows during normal list loading, so old rows cannot flash as current state before live results settle. The tab now uses a native `Mine / All / Attention` segmented control, shows last-updated/refreshing state, leads rows with the operational timing cue, and keeps the create affordance reservation-first. Verified focused source contracts, iOS drift, audit gaps, docs, whitespace, and Xcode.
