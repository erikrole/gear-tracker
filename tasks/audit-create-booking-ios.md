# Audit: create booking (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but raw `.blue/.orange` colors leak through the equipment picker, asset-search has a stale-write race, asset-load errors during the picker step are silent, submit success/error fire no haptic, and `hasUnsavedInput` misses date/requester edits.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `CreateBookingSheet` + `CreateBookingViewModel` + `AssetPickerRow` + the shared `FormCard` / `FormPickerRow` / `OptionPickerView` declared in this file at `ios/Wisconsin/Views/CreateBookingSheet.swift`.

**Surrounding context:** the create-booking flow is the primary self-service action — student or staff starts a reservation. Two-step UI: (1) details (title, requester, location, dates, notes), (2) equipment picker. Now wired from THREE entry points: bookings tab `+`, items list swipe + context menu (per the prior audit's reserve-prefill fix), and the new item-detail Reserve CTA shipped earlier today. Conflict pre-flight check runs after asset selection changes.

## 2026-07-03 Simulator Follow-Up

- [x] Details step screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_be781ccb-539a-46a8-9157-454cc6a581be.jpg`
- [x] Fixed shared picker-row wrapping. The simulator screenshot showed the `Pickup` label wrapping into two lines in the Details step because `FormPickerRow` forced labels into a 40-point column. `FormPickerRow` now keeps labels on one line at intrinsic width and lets long values truncate instead.
- [x] Linked all-day event screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_42458b1d-e7e6-4b76-ae41-ff4f3c8faf55.jpg`
- [x] Prefilled event shortcut screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_727630f0-9885-4808-841f-db79be8dd194.jpg`
- [x] Fixed all-day linked-event header copy. Selecting Football Media Day previously made the Details header say `Jul 7, 2026 at 12:00 AM to 12:00 AM`; event-detail prefill had the same issue through `prefillEventId`. Both paths now use date-only `All day` copy while preserving timed copy after manual window edits.
- [x] Fixed picker hit targets. Pickup/requester picker rows now explicitly make the full row rectangle tappable so the visual row and runtime tap target match.
- [x] Equipment step screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_1832e80e-a63e-4352-b3ec-2e2582af6855.jpg`
- [x] Hid attachment categories from native reservation equipment browsing. Stored category values still include names such as `Accessories`, but the reservation picker now treats those as attachments and keeps them out of default browse/category/search results.
- [x] Confirm step screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_93ea3475-ab44-4f38-8d60-0d3b3a4cbdba.jpg`
- [x] Fixed all-day review copy. The Confirm step now reuses date-only all-day semantics and says `Return after event` instead of showing midnight pickup/return timestamps.

## P0 — blocks MVP

_None._ Auth/role gating is correct (`canPickRequester` is STAFF/ADMIN; STUDENTs are locked to self). Pull-to-refresh on options. Discard confirmation on Cancel with unsaved input. Conflict pre-check is intentionally fire-and-forget per `APIClient.checkAvailability`'s contract. Two-step navigation works.

## P1 — polish before ship

- [x] [Flows] **No haptic on create success or failure.** Same gap pattern shipped on every other mutation surface today (booking detail edit, item detail edit, kiosk completes). Submit on a slow network leaves the user staring at the spinner with no tactile signal that the API actually fired.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:427-435`.
      Suggested fix: `Haptics.success()` after `vm.submit()` returns, before `dismiss()`; `Haptics.warning()` in the catch.

- [x] [UI polish] **`AssetPickerRow` checkmark uses raw `.blue` / `.orange`.** Drifts from the `StatusTone` token system established across the rest of the app today. The conflict label uses `Color.statusText(.orange)` ✓ but the checkmark icon (line 491) uses `.orange` and `.blue` literals.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:489-492`.
      Suggested fix: `Color.statusText(.orange)` for conflicted, `Color.statusText(.blue)` for selected. Same token pass shipped on kiosk surfaces.

- [x] [Hardening] **Stale-write race in `loadAvailableAssets(reset: true)`.** `onSearchChange` debounces 350 ms, then calls `loadAvailableAssets(reset: true)`. The function guards against concurrent loads with `guard !isLoadingAssets`, but if a load IS in flight, the new search gets dropped silently — the user types more, debounce fires, load is gated, and the search doesn't update. Inverse of the global-search race fixed today.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:112-134, 136-143`.
      Why it matters: typing fast in the equipment picker can leave the displayed list stuck on the prior query's results. The user sees stale matches and assumes the search is broken.
      Suggested fix: same query-snapshot pattern shipped on global search. Inside `loadAvailableAssets`, after the API call returns, check `vm.assetSearch == capturedSearch` before writing. Drop the `isLoadingAssets` guard for `reset: true` calls (let them run concurrently and let the snapshot guard sort out which writes win) — for `reset: false` (pagination) the guard stays.

- [x] [Hardening] **Asset-load errors during the picker step are silent.** `loadAvailableAssets`'s catch sets `vm.error`, but the equipment picker view (lines 371-425) only renders the asset list / loading spinner / "No available equipment found" empty state — never the error. So a server failure mid-picker leaves the user staring at "No available equipment found" with no clue it's a network issue.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:371-425`.
      Suggested fix: render `vm.error` (when set + asset list is empty + not loading) as a `wifi.exclamationmark` row with a Retry button that re-runs `loadAvailableAssets(reset: true)`. Mirrors the pattern shipped on global search and the kiosk return detail-load error today.

- [x] [Flows] **`hasUnsavedInput` only checks title / notes / selectedAssetIds.** A STAFF user picks "Erik" as requester, picks a different location, edits dates, leaves the title blank, taps Cancel — the discard confirm doesn't fire because none of the three tracked fields changed. They lose their entire setup with no warning.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:190-194`.
      Suggested fix: include `selectedUserId != initialUserId`, `selectedLocationId != initialLocationId`, and date deltas. Capture the initial values at view init (`onAppear` or in the model's reset).

- [x] [UI polish] **Equipment-picker list missing `scrollDismissesKeyboard`.** Same gap as global search pre-fix. With the search field in the first section, scrolling the asset list with the keyboard up covers the bottom rows.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:372-424`.
      Suggested fix: `.scrollDismissesKeyboard(.immediately)` on the `List`.

- [x] [UI polish] **Create button overlays a ProgressView on top of the "Create" text.** Visual collision — the spinner sits ON TOP of the word "Create" while submitting. The matching pattern across the rest of the app today is to swap the label entirely (Save → spinner). The overlay is a hold-over from before the spinner-replacement convention took hold.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:267-276`.
      Suggested fix: render `ProgressView().controlSize(.small)` in the label when `vm.isSubmitting`, otherwise "Create" with `.fontWeight(.semibold)`. Match the booking-detail / item-detail Save patterns shipped today.

- [x] [A11y] **Conflict label and selected-pill expose icon names** ("checkmark.circle.fill, X items selected" and "exclamationmark.triangle.fill, Scheduling conflict"). Same shape of fix as everywhere else today.
      `ios/Wisconsin/Views/CreateBookingSheet.swift:381-383, 480-484`.
      Suggested fix: explicit `.accessibilityLabel(...)` on each Label so the icon stays decorative.

- [x] [Flows] **Submit error alert has no Retry path** — user has to dismiss the OK alert and re-tap Create. Minor but the error is often something they CAN retry (transient network).
      `ios/Wisconsin/Views/CreateBookingSheet.swift:217-224`.
      Suggested fix: switch the alert to a `confirmationDialog` with "Try again" + "OK" buttons. Try again calls `create()`; OK just dismisses.

## P2 — post-MVP

- [x] [Polish] **Shipped, superseding this note.** The equipment picker was rebuilt around a search-first flow with a persistent cart bar and a dedicated `EquipmentCartSheet` drawer (`CreateBookingEquipmentPicker.swift`, `CreateBookingEquipmentRows.swift`). Every selected asset gets an explicit remove (X) button via `SelectedEquipmentRow`, independent of search/filter state. Reconciled 2026-07-08 during Snow Leopard Slice 4.
- [ ] [Polish] **Deferred.** Step progress indicator ("1 of 2", "2 of 2"). Title changes serve a similar purpose ("New Reservation" → "Add Equipment") and the toolbar button labels (Next / Back) cover navigation. Skip.
- [ ] [Polish] **Deferred.** Role badges on `OptionPickerView` rows when picking a requester. Web shows them; iOS just shows the name. Floor users picking from a few hundred names benefit from "ADMIN" / "STAFF" / "STUDENT" tags. Worth considering when roster sizes grow.
- [ ] [Polish] **Deferred.** Prefill last-used location / requester from `UserDefaults`. Friction reduction; today every fresh sheet picks defaults from `session.currentUser`. Skip until requested.

## Acceptance criteria status

Per `AREA_BOOKINGS.md` and the prior bookings audit:

- [x] AC: title, requester, location, dates, notes captured.
- [x] AC: STUDENTs locked to self as requester (STAFF/ADMIN can pick).
- [x] AC: equipment picker with multi-select.
- [x] AC: conflict pre-check (non-blocking).
- [x] AC: discard confirmation on Cancel with unsaved input — **broadened by P1 fix.**
- [x] AC: submit success reports tactile confirmation — **closed by P1 haptic fix.**
- [x] AC: stale searches don't show prior results — **closed by P1 race fix.**
- [x] AC: asset-load failure is recoverable — **closed by P1 surfacing fix.**
- [x] AC: equipment picker tokens align with cross-app `StatusTone` — **closed by P1 token fix.**
- [x] AC: submit error is recoverable in one tap — **closed by P1 retry fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web has the same shape — two steps, conflict check; role badges in picker deferred)
- [x] Accessibility
