# Plan 050: Make iOS booking creation showtime-ready

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 182c9de9..HEAD -- ios/Wisconsin/Views/CreateBookingSheet.swift ios/Wisconsin/Core/APIClient.swift ios/Wisconsin/Models/ScheduleModels.swift src/lib/sports.ts src/components/create-booking/use-event-context.ts src/components/booking-wizard/WizardStep3.tsx tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts docs/AREA_MOBILE.md docs/AREA_RESERVATIONS.md docs/GAPS_AND_RISKS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch that changes the intended behavior, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `182c9de9`, 2026-06-11

## Why this matters

Native iOS reservation creation now links events and picks bulk/counted equipment, but the current UI still leaks confusing semantics: event titles do not match the web naming contract, the booking location reads like event venue instead of pickup point, counted item families are visually split from normal equipment, and review over-explains linked events while under-showing equipment. This pass makes the flow feel production-ready without changing booking API semantics, Prisma models, or server enforcement. The intended outcome is a mobile-first Apple-like creation flow where students and staff can create game-day reservations with the same mental model they use on web.

## Current state

- `ios/Wisconsin/Views/CreateBookingSheet.swift` owns the native three-step booking sheet. It currently tracks event selection, bulk quantities, serialized asset selection, and review UI in one file.
- `src/lib/sports.ts` is the current web source for event-title generation. It produces sport-code titles such as `MBB vs Texas` and `FB at Minnesota`.
- `src/components/create-booking/use-event-context.ts` shows the web event auto-fill behavior and currently returns `title`, `startsAt`, `endsAt`, and `locationId` from selected events.
- `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`, `docs/AREA_RESERVATIONS.md`, `docs/AREA_MOBILE.md`, `docs/DECISIONS.md`, `docs/GAPS_AND_RISKS.md`, and `prisma/schema.prisma` are the docs/schema sources this slice must respect.

Key source facts:

```swift
// ios/Wisconsin/Views/CreateBookingSheet.swift:213-222
private func applySelectedEventsToDetails() {
    let picked = selectedEvents
    guard let first = picked.first else { return }
    if !userEditedTitle || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        title = "Gear - \(first.summary)"
        userEditedTitle = false
    }
    if !userEditedLocation, let locationId = first.location?.id {
        selectedLocationId = locationId
    }
```

```swift
// ios/Wisconsin/Views/CreateBookingSheet.swift:641-654
OptionPickerView(
    title: "Location",
    options: vm.options?.locations.map { ($0.id, $0.name) } ?? [],
    selection: Binding(
        get: { vm.selectedLocationId },
        set: { vm.setLocationFromUser($0) }
    )
) label: {
    FormPickerRow(
        label: "At",
        value: vm.selectedLocation?.name ?? "Select location"
    )
}
```

```swift
// ios/Wisconsin/Views/CreateBookingSheet.swift:796-815
if !vm.availableBulkSkus.isEmpty {
    Section {
        ForEach(vm.availableBulkSkus) { sku in
            BulkQuantityRow(...)
        }
    } header: {
        Text("Batteries & Counted Items")
    }
}
```

```swift
// ios/Wisconsin/Views/CreateBookingSheet.swift:899-904
Text(vm.startsAt.formatted(date: .abbreviated, time: .shortened))
Text("Ends \(vm.endsAt.formatted(date: .abbreviated, time: .shortened))")
```

```swift
// ios/Wisconsin/Views/CreateBookingSheet.swift:1035-1052
if !vm.selectedEvents.isEmpty {
    VStack(alignment: .leading, spacing: 8) {
        Text(vm.selectedEvents.count == 1 ? "Linked Event" : "Linked Events")
        ...
        ReviewEventRow(event: event)
    }
}
```

```swift
// ios/Wisconsin/Views/CreateBookingSheet.swift:1648-1655
private extension ScheduleEvent {
    var shortBookingEventTitle: String {
        if let label = sportLabel(sportCode), let opponent, !opponent.isEmpty {
            let prefix = isHome == false ? "at" : "vs"
            return "\(label) \(prefix) \(opponent)"
        }
        return summary
    }
}
```

```ts
// src/lib/sports.ts:52-67
/**
 * Generate a checkout title from an event.
 * - Home: "{sportCode} vs {opponent}"
 * - Away: "{sportCode} at {opponent}"
 * - Neutral/unknown: "{sportCode} vs {opponent} (Neutral)"
 */
export function generateEventTitle(
  sportCode: string,
  opponent: string | null | undefined,
  isHome: boolean | null | undefined
): string {
  const opp = opponent || "TBD";
  if (isHome === true) return `${sportCode} vs ${opp}`;
  if (isHome === false) return `${sportCode} at ${opp}`;
  return `${sportCode} vs ${opp} (Neutral)`;
}
```

```tsx
// src/components/booking-wizard/WizardStep3.tsx:229-263
<AssetImage src={asset.imageUrl} alt={asset.assetTag} size={40} className="rounded-md shrink-0" />
...
<AssetImage src={bi.imageUrl} alt={bi.name} size={40} className="rounded-md shrink-0" />
...
<span className="text-xs font-bold text-muted-foreground tabular-nums">
  &times; {bi.quantity}
</span>
```

```prisma
// prisma/schema.prisma:360-373
requester User @relation("BookingRequester", fields: [requesterUserId], references: [id], onDelete: Restrict)
location  Location @relation(fields: [locationId], references: [id], onDelete: Restrict)
event     CalendarEvent? @relation(fields: [eventId], references: [id], onDelete: SetNull)
events    BookingEvent[]
serializedItems BookingSerializedItem[]
bulkItems BookingBulkItem[]
```

Important product constraints:

- Multi-event booking V1 keeps `Booking.eventId` as primary event and `BookingEvent` rows for additional event links; booking windows may span all selected events (`docs/BRIEF_MULTI_EVENT_BOOKING_V1.md:20-24`, `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md:85-90`).
- Reservation creation requires at least one equipment item and rejects duplicate multi-event links and duplicate bulk lines at the shared service boundary (`docs/AREA_RESERVATIONS.md:13-22`).
- Native iOS creation is documented as a three-step rhythm with linked events, searchable serialized assets, scan-to-add, countable bulk selection, and authoritative server availability checks (`docs/AREA_RESERVATIONS.md:36-42`).
- Mobile rows need compact summaries with title, owner, status, and item thumbnail strips, and tap targets must stay at 44px or larger (`docs/AREA_MOBILE.md:16-25`, `docs/AREA_MOBILE.md:51-60`).
- Item families are normal catalog items for users; `BulkSku` is only the implementation record. Product UI should not imply batteries/counted items are a separate normal-user bucket (`docs/DECISIONS.md:353-378`, `docs/AREA_BULK_INVENTORY.md:10-25`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused iOS source-contract tests | `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts` | exit 0, all tests pass |
| iOS drift check | `npm run drift:ios` | exit 0 |
| iOS audit inventory | `npm run audit:ios:gaps` | exit 0 |
| Whitespace check | `git diff --check` | exit 0 |
| Simulator build | XcodeBuildMCP `build_sim` for scheme `Wisconsin`, or `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -configuration Debug build` | `BUILD SUCCEEDED` |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0, or only the already-known unrelated `tests/booking-create-ux.test.ts` syntax blocker remains |

## Suggested executor toolkit

- Use the `build-ios-apps:swiftui-ui-patterns` skill if available. This is an existing SwiftUI screen, so keep state SwiftUI-native, keep subviews small, and build with focused subviews instead of adding more logic inside `body`.
- Use the repo source-contract test style in `tests/ios-create-booking-picker-parity.test.ts` and `tests/student-field-contracts.test.ts`. These tests intentionally read Swift source to pin mobile contracts.

## Scope

**In scope**:
- `ios/Wisconsin/Views/CreateBookingSheet.swift`
- `tests/ios-create-booking-picker-parity.test.ts`
- `tests/student-field-contracts.test.ts`
- `docs/AREA_MOBILE.md`
- `docs/AREA_RESERVATIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `tasks/todo.md` if the implementation workflow requires task tracking

**Allowed only if needed by compile/test drift**:
- `ios/Wisconsin/Core/APIClient.swift`
- `ios/Wisconsin/Models/ScheduleModels.swift`

**Out of scope**:
- Prisma schema or migrations.
- Booking service or API behavior, except preserving the existing `eventIds[]`, `serializedAssetIds`, and `bulkItems` request shape.
- Web booking UI changes. Read web as reference only.
- Kiosk custody and scan flows.
- Broad `CreateBookingSheet.swift` decomposition. That belongs to `plans/013-split-ios-create-booking-sheet.md`.

## Git workflow

- Branch: `codex/050-ios-booking-showtime-polish`.
- Commit message: `feat: polish iOS reservation creation`.
- Do not push or open a PR unless the operator asks.
- Preserve unrelated dirty worktree changes. At plan time, `git status --short` showed many unrelated modified files plus existing plan files `043` and `049`; do not revert or reformat them.

## Steps

### Step 1: Align event display titles with web booking names

In `CreateBookingSheet.swift`, replace `shortBookingEventTitle` semantics with a booking-display title that mirrors the web `generateEventTitle()` contract but follows the product feedback exactly:

- If `sportCode` and `opponent` exist:
  - `isHome == false` -> `"<sportCode> at <opponent>"`
  - `isHome == true` -> `"<sportCode> vs <opponent>"`
  - `isHome == nil` -> `"<sportCode> vs <opponent>"`
- Do not expand sport codes to full names for the booking title.
- Do not append `" (Neutral)"`.
- If only `summary` exists, use `summary`.
- Use this same formatter in event rows, chips, review fact rows, accessibility labels, and title auto-fill.

Then update `applySelectedEventsToDetails()` so selecting a primary event auto-fills `title` with the formatter output, not `"Gear - \(first.summary)"`.

Keep `sportLabel()` available for secondary UI where full sport names are useful, but do not use it for the reservation title. Examples to pin in tests: `VB vs Maryland`, `FB at Minnesota`, `MBB vs Texas`.

**Verify**: `npx vitest run tests/ios-create-booking-picker-parity.test.ts` initially may fail until tests are updated in Step 5, but the Swift source must no longer contain `title = "Gear - \(first.summary)"`.

### Step 2: Make booking location explicitly mean pickup location

In `CreateBookingSheet.swift`, rename the visible location copy:

- `OptionPickerView(title:)` should read `"Pickup location"`.
- The inline row label should read `"Pickup"` instead of `"At"`.
- Placeholder should read `"Select pickup"`.
- Review should display the selected pickup location under the requester, not as event venue.

Remove the event-to-location assignment from `applySelectedEventsToDetails()`:

```swift
if !userEditedLocation, let locationId = first.location?.id {
    selectedLocationId = locationId
}
```

Do not silently treat event venue as pickup location. For defaults, preserve current form-option behavior unless you can find an existing location whose name is exactly or case-insensitively `Camp Randall`. If adding a default helper, make it explicit and small, for example `defaultPickupLocationId(from:)`, and only apply it when `selectedLocationId` is empty and options have loaded.

Keep event venue visible only in event row subtitles. The event subtitle can still include `Home/Away` and venue text because that is event context, not pickup location.

**Verify**: `rg -n 'label: "At"|OptionPickerView\\(\\s*title: "Location"|first\\.location\\?\\.id' ios/Wisconsin/Views/CreateBookingSheet.swift` returns no matches for the old booking-location path. It is acceptable for event subtitles to still reference `event.location`.

### Step 3: Unify serialized and counted equipment in the picker

Refactor the equipment picker so counted item families are not a separate top-level section called `"Batteries & Counted Items"`.

Target behavior:

- Keep Search and Scan as top controls.
- Keep one selected-equipment summary section when anything is selected.
- Render one normal equipment list for both `availableBulkSkus` and `availableAssets`.
- Search should continue to filter both serialized assets and bulk SKUs.
- Preserve `selectedAssetSnapshots`, because selected serialized assets must remain removable after filtering.
- Preserve separate payloads: serialized assets still submit through `serializedAssetIds`; bulk/countable item families still submit through `bulkItems`.
- Keep 44pt or larger tap targets for rows and steppers.

Implementation shape:

- Add a small enum or local display adapter, for example:

```swift
private enum EquipmentChoice: Identifiable {
    case bulk(FormBulkSku)
    case asset(Asset)

    var id: String {
        switch self {
        case .bulk(let sku): "bulk-\(sku.id)"
        case .asset(let asset): "asset-\(asset.id)"
        }
    }
}
```

- Add `var equipmentChoices: [EquipmentChoice]` on the view model, combining `availableBulkSkus` and `availableAssets`. A conservative ordering is selected bulk first, selected assets next, then available bulk SKUs, then available assets, all sorted by display name inside each type.
- Replace the separate bulk section header with a single section header like `"Equipment"`, or no header if the list header already says Equipment. Do not use `"Batteries & Counted Items"`.
- Keep `BulkQuantityRow` and `AssetPickerRow` if that is the smallest safe implementation, but visually they should read as peers. If time allows, introduce a shared thumbnail subview so both row types use the same 44x44 image/icon slot.

**Verify**: `rg -n 'Batteries & Counted Items' ios/Wisconsin/Views/CreateBookingSheet.swift tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts` returns no matches.

### Step 4: Make review compact, thumbnail-led, and pickup/return oriented

Update `reviewStep`:

- Rename time copy from start/end language to pickup/return language:
  - Primary label/value should say `Pickup` or visibly indicate pickup time.
  - Secondary label/value should say `Return`, not `Ends`.
- Keep the calendar icon `calendar.badge.checkmark` when events are linked, but remove the separate linked event card and delete `ReviewEventRow` unless another active use remains.
- Represent linked event context inside the existing fact table or header, with an icon and concise label. Examples:
  - `calendar.badge.checkmark` + `VB vs Maryland`
  - `calendar.badge.checkmark` + `3 linked events`
- Do not create a new card for linked events.
- Add thumbnails to review equipment rows:
  - Serialized assets should reuse the `AsyncImage`/placeholder treatment from `AssetPickerRow`.
  - Bulk SKUs should use `sku.imageUrl` if available. If `FormBulkSku` lacks `imageUrl`, add it only if the existing API/model already exposes it; otherwise use the same `shippingbox` thumbnail as the picker. Do not change the API solely to fetch images in this slice.
  - Bulk quantities stay visible as `xN` or `×N` and right-aligned.

If `FormBulkSku` already has `imageUrl` in `ios/Wisconsin/Models/Models.swift`, prefer real thumbnails. If it does not, stop before changing API shape and report whether adding image URLs is worth a follow-up.

**Verify**: `rg -n 'Ends |Linked Event|Linked Events|ReviewEventRow' ios/Wisconsin/Views/CreateBookingSheet.swift` returns no matches, except historical comments if they are intentionally updated.

### Step 5: Update source-contract tests around the new UX contract

Update `tests/ios-create-booking-picker-parity.test.ts`:

- Assert the event title formatter uses sport code plus `vs`/`at`, not `sportLabel`.
- Assert neutral/unknown venue uses `vs` without appending `(Neutral)`.
- Assert iOS source no longer contains `"Gear - \(first.summary)"`.
- Assert iOS source no longer copies `first.location?.id` into booking pickup location.
- Assert location copy uses `"Pickup"` / `"Pickup location"`.
- Assert the picker no longer contains `"Batteries & Counted Items"`.
- Assert review uses `"Pickup"` and `"Return"` and no longer contains `ReviewEventRow` or `"Linked Event"` card copy.
- Assert review equipment rows include thumbnail rendering for serialized assets and peer thumbnail/icon treatment for bulk rows.

Update `tests/student-field-contracts.test.ts`:

- Replace the old `Text("Batteries & Counted Items")` expectation with the unified equipment contract.
- Keep the existing `selectedAssetSnapshots`, `SelectedEquipmentRow`, bulk quantity, scan-to-add, and remove-row expectations unless implementation replaces those symbols. If symbols change, preserve equivalent assertions against the new names.

**Verify**: `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts` exits 0.

### Step 6: Sync docs and task tracking

Update docs only after the source behavior exists:

- `docs/AREA_MOBILE.md` change log: add a 2026-06-11 entry that iOS booking creation now uses web-aligned event titles, explicit pickup/return copy, unified equipment picker treatment for serialized and counted item families, thumbnail-led review rows, and compact linked-event indication.
- `docs/AREA_RESERVATIONS.md` native iOS create section: change the line that says selected events auto-fill title, location, and window. It should say selected events auto-fill title and pickup/return window, while pickup location remains the booking pickup location.
- `docs/GAPS_AND_RISKS.md`: add a no-new-gap update if this closes the visible iOS polish issue without creating schema/API work. If real thumbnails for bulk rows require an API addition, record that as a deferred polish gap instead of silently expanding this slice.
- `tasks/todo.md`: update if the active repo workflow requires it.

**Verify**: `git diff --check` exits 0.

### Step 7: Run final verification

Run all gates:

1. `npx vitest run tests/ios-create-booking-picker-parity.test.ts tests/student-field-contracts.test.ts`
2. `npm run drift:ios`
3. `npm run audit:ios:gaps`
4. `git diff --check`
5. XcodeBuildMCP `build_sim` for Wisconsin, or shell fallback:
   `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -configuration Debug build`
6. `npx tsc --noEmit --pretty false`

If `npx tsc --noEmit --pretty false` fails only on the pre-existing unrelated `tests/booking-create-ux.test.ts` syntax issue, record that in the final handoff and include the focused passing commands. If it fails on files touched by this slice, fix before declaring done.

## Test plan

- Update `tests/ios-create-booking-picker-parity.test.ts` as the primary source-contract test for the native picker and review UX.
- Update `tests/student-field-contracts.test.ts` to keep mobile action clarity and selected-equipment recovery pinned after the row/component rename.
- Do not add backend tests unless implementation unexpectedly touches API behavior. This plan should not change request/response contracts.

## Done criteria

All must hold:

- [ ] Event-linked iOS booking titles use `sportCode vs/at opponent`: `VB vs Maryland`, `FB at Minnesota`, `MBB vs Texas`.
- [ ] Neutral/unknown `isHome` uses `vs`, with no extra `(Neutral)` suffix in iOS booking titles.
- [ ] Selecting an event does not overwrite booking pickup location with event venue.
- [ ] Details and review copy use pickup/return language.
- [ ] No separate `"Batteries & Counted Items"` picker section remains.
- [ ] Review equipment rows show thumbnails or thumbnail slots for both serialized and counted equipment.
- [ ] Linked events are indicated inline by icon/fact-row treatment, not a separate review card.
- [ ] Existing `eventIds[]`, `serializedAssetIds`, and `bulkItems` payload semantics are preserved.
- [ ] Focused vitest command exits 0.
- [ ] `npm run drift:ios`, `npm run audit:ios:gaps`, and `git diff --check` exit 0.
- [ ] iOS simulator build succeeds.
- [ ] Docs reflect shipped behavior, and `plans/README.md` status is updated.

## STOP conditions

Stop and report back if:

- The live `CreateBookingSheet.swift` no longer contains the current event-linking/equipment/review structure cited above.
- Fixing bulk thumbnails requires changing `/api/form-options` or server models. That is a separate API contract slice unless the operator approves expansion.
- The existing web title helper has changed away from sport-code `vs/at` semantics.
- Any implementation path requires changing Prisma schema, booking lifecycle service behavior, or kiosk custody flows.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- The apparent web mismatch is deliberate for this iOS slice: web `generateEventTitle()` currently appends `" (Neutral)"` for unknown `isHome`, but the requested iOS behavior is `vs` for neutral without extra copy. If product wants web to remove the neutral suffix too, plan a separate web parity change.
- The current web `deriveFromPrimary()` still returns `locationId: primary.location?.id`. The user clarified location under requester means pickup location, not event venue. This plan fixes iOS only; if web must change too, create a separate web plan.
- Keep the `selectedAssetSnapshots` pattern. Prior mobile work found it prevents selected serialized assets from becoming unremovable after search/filter changes.
- Do not fold this into the larger `CreateBookingSheet` decomposition plan. This is a visible behavior and polish slice that can land first.
