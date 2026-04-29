# Booking Flows Improvement Audit
**Date**: 2026-04-29
**Target**: `src/app/(app)/bookings/`, `src/components/booking-wizard/`, `src/components/booking-list/`, `src/components/booking-details/`, `src/components/BookingDetailsSheet.tsx`, `src/components/BookingListPage.tsx`, `src/app/api/bookings/`, `src/app/api/reservations/`
**Type**: System

---

## What's Smart

**1. `allowedActions` server-drives all client gate checks.**
The server computes allowed actions given booking state, kind, and user role. The client renders entirely from this list — no duplicated role logic on the client. Pattern lives in `BookingDetailPage.tsx` and `BookingContextMenu.tsx`. Should be replicated wherever action gating exists.

**2. Optimistic cancel with rollback** (`page.tsx:110–170`).
Handlers capture `prevItems`, optimistically update React Query cache, and roll back on failure with a specific toast. Clean and consistent.

**3. `useReducer` for wizard form** (`BookingWizard.tsx`).
Seven-field form with interdependencies (sport clears events, tieToEvent clears events) managed in a single `formReducer`. Correct choice vs N `useState` hooks.

**4. `If-Unmodified-Since` optimistic locking** (`BookingDetailsSheet.tsx`, `BookingDetailPage.tsx`).
Both PATCH paths send this header, preventing lost updates from concurrent editors.

**5. Conflict auto-removal on 409** (`BookingWizard.tsx:331`).
Submit-time 409 strips conflicting assets from selection and returns the user to Step 2 with per-item error messages. No manual hunting required.

**6. AbortController everywhere.**
`BookingEquipmentTab.tsx`, `BookingDetailsSheet.tsx`, and the wizard all properly create, use, and cancel AbortControllers on unmount/re-fetch.

**7. `MenuItems` shared between right-click and overflow** (`BookingContextMenu.tsx`).
Single menu implementation drives both `BookingContextMenuWrapper` and `BookingOverflowMenu`. Zero duplication.

**8. Live countdown with adaptive interval** (`BookingDetailPage.tsx`).
Overdue/critical bookings tick every 10s; normal bookings every 30s. Smart CPU tradeoff.

**9. Draft persistence** (`BookingWizard.tsx`).
Save draft & exit, resume from banner, auto-delete after successful submit — complete lifecycle handled.

**10. `InlineDateField` explicit Apply** (`InlineDateField.tsx`).
Calendar picker discards on close-without-Apply. Save status feedback (spinner/check/X) with auto-reset timer.

---

## What Doesn't Make Sense

**1. `?filter=overdue` is silently ignored by `GET /api/bookings`** (`api/bookings/route.ts`, `BookingListPage.tsx:61`).
`BookingListPage` sends `?filter=overdue` (or `due-today`) when a special filter is active on the "All" tab. The `GET /api/bookings` route reads `q`, `status`, `locationId`, `sportCode`, `requesterId` — but has no handler for `filter`. The parameter is silently dropped, returning unfiltered results. The special filter UI shows a result count but it's wrong. The checkout/reservation tab-specific routes may handle it differently, masking the bug on those tabs.

**2. Extend context menu actions absent from the "All" tab** (`BookingContextMenu.tsx:52–53`).
`kindForActions` maps `config.kind === "ALL"` to `null`, producing an empty allowed-action Set. This means "Extend +1 day" and "Extend +1 week" never appear in the "All" tab's context menu even for bookings where extend would be valid. Users on the "All" tab must navigate to the detail page to extend.

**3. Two independent paths to save booking title** (`BookingInfoTab.tsx:29`, `BookingDetailPage.tsx:224`).
`InlineTitle` in the page header and the `Input` in `BookingInfoTab` both call `onSave("title", v)` independently. Editing in one doesn't update the other until a full refetch. The UX shows stale data between the header and the info card.

**4. Custom extend popover auto-commits on close** (`BookingOverview.tsx:241–249`).
`onOpenChange` fires `handleCustomExtend(customValue)` if `customValue` is set — clicking outside the popover silently triggers the extend confirmation flow. Non-standard: closing a popover should discard changes, not commit them.

**5. `viewMode` flash on load** (`page.tsx:46–50`).
`viewMode` is read from `localStorage` in a `useEffect` rather than a `useState` lazy initializer. On first render, the page always renders in "cards" mode then switches to "table" if localStorage says "table" — causing a visible layout jump.

**6. `BookingDetailsSheet` overdue badge doesn't update in real-time** (`BookingDetailsSheet.tsx:579`).
The sheet reads `booking.isOverdue` (server-computed at fetch time). The full detail page has a live countdown; the sheet has no live update. A booking that goes overdue while the sheet is open never shows the overdue badge until a refetch.

---

## What Can Be Simplified

**1. Dead component files — 4 files, delete them.**
- `src/components/booking-list/ConfirmBookingDialog.tsx` — never imported anywhere. Full file is dead.
- `src/components/booking-details/BookingActions.tsx` — never imported anywhere (only in a barrel `index.ts` which is itself unused).
- `src/components/create-booking/DetailsSection.tsx` — never imported anywhere. Pre-wizard flow.
- `src/components/create-booking/EventSection.tsx` — never imported anywhere. Uses CSS classes `toggle`/`toggle.on` that don't exist in `globals.css`.

**2. `formatDuration` dead function** (`settings/bookings/page.tsx:33–38`).
Defined, never called anywhere in the file. Remove it.

**3. Dead props on `BookingDetailsSheet`** (`BookingDetailsSheet.tsx:47–48`).
`currentUserRole` is declared in Props but never destructured or used — the component fetches its own role from `useQuery(["me"])`. `initialTab` is declared but the sheet has no tab layout. Both should be removed from the Props type and all call sites.

**4. `canEditEquipment` prop always `false`** (`BookingDetailsSheet.tsx:725`, `BookingItems.tsx`).
`canEditEquipment` is passed as hardcoded `false` to `BookingItems` — the edit button never renders. Equipment editing in the sheet happens via a different affordance (`SectionHead` button). Remove the prop from `BookingItems` and its call site.

**5. `toLocalDateTimeValue` local duplicate** (`BookingOverview.tsx:44–47`).
Identical copy of the function already in `booking-details/helpers.ts`. Remove the local definition and import from helpers.

**6. Local `formatDateTime` duplicates** (`WizardStep3.tsx:33–40`).
Local `formatDateTime` duplicates `lib/format.formatDateTime`. Remove and import from `lib/format`. (`ConfirmBookingDialog.tsx` has the same issue but should be deleted entirely.)

**7. `reload` and `setItems` recreated every render** (`BookingListPage.tsx:78`, `BookingListPage.tsx:99–105`).
Both functions are defined without `useCallback` and passed to every row component. Wrap in `useCallback`:
- `const reload = useCallback(async () => { await refetch(); }, [refetch])`
- `const setItems = useCallback((updater) => { ... }, [queryClient, queryKey])`

**8. Extend presets fetch without React Query** (`BookingOverview.tsx:65–73`).
Raw `fetch()` inside `useEffect` with `.catch(() => {})` — no error handling, no AbortController, no caching. Every time the sheet opens and renders `BookingOverview`, this fetches. Replace with `useQuery(["extend-presets"], ..., { staleTime: 10 * 60 * 1000 })`.

**9. `useFetch` in settings page vs React Query everywhere else** (`settings/bookings/page.tsx:45`).
The settings page is the only booking-adjacent page using `useFetch`. Converting to `useQuery` removes the second data-fetching abstraction.

**10. Stale status cases in `ItemBookingsTab`** (`ItemBookingsTab.tsx:315–328`).
`bookingStatusLabel` switch includes `CHECKED_OUT`, `RETURNED`, `CONVERTED`, `CLOSED` — statuses not in the Prisma `BookingStatus` enum. These branches are dead. Remove them.

---

## What Can Be Rethought

**1. `BookingDetailsSheet` has 17 `useState` hooks and duplicates `BookingDetailPage` logic.**
Current model: sheet is a standalone component with its own fetch loop, edit state, equipment edit state, extend state, cancel state, convert state. Full detail page has identical logic independently. Result: bugs fixed in one are silently missing from the other (e.g., live countdown exists in detail page but not sheet; `window.location.href` exists in sheet but not detail page).
Alternative: Extract shared logic into hooks (`useBookingEditor`, `useBookingExtend`, `useBookingCancel`) used by both the sheet and the detail page. Each hook encapsulates state + API calls.
Tradeoff: 2–3 hours of hook extraction vs ongoing divergence. The duplicate surface area is already causing visible inconsistencies.

**2. `GET /api/bookings` filter handling vs per-kind routes.**
Current model: `/api/bookings` (for the "All" tab) handles status/location/sport/search filters inline in the route. The special filter (`overdue`, `due-today`) is not implemented, causing a silent bug.
Alternative: Move filter logic into the `listBookings` service function (where `/api/checkouts` and `/api/reservations` already delegate), then add `filter` param support in the service.
Tradeoff: Cleaner separation, one place to fix filter bugs — but requires touching the service and three routes.

---

## Consistency & Fit

### Pattern Drift

| Issue | Old pattern | Current standard | Files affected |
|-------|-------------|------------------|----------------|
| `useFetch` hook | `settings/bookings/page.tsx:45` | React Query everywhere else | 1 file |
| `toast` in `useMemo`/`useCallback` dep arrays | `page.tsx:122,254`, `BookingEquipmentTab.tsx:108` | Omit stable module-level imports per lessons.md | 3 occurrences |
| `window.location.href` for navigation | `BookingDetailsSheet.tsx:479` | `router.push()` | 1 occurrence |
| Raw `fetch` without React Query for supplemental data | `BookingOverview.tsx:65`, `BookingDetailsSheet.tsx:177` | React Query with `staleTime` | 2 occurrences |
| `role="link"` on sheet-opening rows | `BookingRow.tsx:40,159` | `role="button"` (rows open a sheet, don't navigate) | 2 occurrences |

### Dead Code

| Symbol | File:Line | Type |
|--------|-----------|------|
| `ConfirmBookingDialog` | `src/components/booking-list/ConfirmBookingDialog.tsx:1` | Entire file — never imported |
| `BookingActions` | `src/components/booking-details/BookingActions.tsx:1` | Entire file — never imported |
| `DetailsSection` | `src/components/create-booking/DetailsSection.tsx:1` | Entire file — never imported |
| `EventSection` | `src/components/create-booking/EventSection.tsx:1` | Entire file — never imported |
| `formatDuration` | `src/app/(app)/settings/bookings/page.tsx:33` | Function — defined, never called |
| `currentUserRole` prop | `src/components/BookingDetailsSheet.tsx:47` | Prop — declared, never destructured |
| `initialTab` prop | `src/components/BookingDetailsSheet.tsx:48` | Prop — declared, never used in body |
| `canEditEquipment` prop | `src/components/booking-details/BookingItems.tsx` (always passed `false`) | Prop — hardcoded false, button never renders |
| `toLocalDateTimeValue` | `src/components/booking-details/BookingOverview.tsx:44` | Function — duplicated from helpers.ts |
| `formatDateTime` | `src/components/booking-wizard/WizardStep3.tsx:33` | Function — duplicates `lib/format` |
| `bookingStatusLabel` stale cases (`CHECKED_OUT`, `RETURNED`, `CONVERTED`, `CLOSED`) | `src/app/(app)/items/[id]/ItemBookingsTab.tsx:315–328` | Dead switch cases — statuses not in schema |
| `GripVerticalIcon` | `src/app/(app)/settings/bookings/page.tsx:149` | Icon rendered with no drag implementation |
| Key `i` in `GearAvatarStack` | `src/components/booking-list/BookingCard.tsx:37` | Array index as key — should be `si.asset.id` |
| `<img>` instead of `next/image` | `src/app/(app)/bookings/BookingInfoTab.tsx:216` | Bypass with eslint-disable — loses lazy loading |

### Ripple Map

- **If `BookingDetailsSheet` Props type changes** (`currentUserRole`, `initialTab` removed) → all call sites of `BookingDetailsSheet` need updating: `BookingListPage.tsx` (line ~411)
- **If `canEditEquipment` is removed from `BookingItems`** → `BookingDetailsSheet.tsx:725` and any other `BookingItems` consumers
- **If `GET /api/bookings` adds `filter` param support** → no client changes needed (client already sends it); `BookingListPage.tsx:61` already sends the param
- **If `listBookings` service signature changes** → `api/bookings/route.ts`, `api/checkouts/route.ts`, `api/reservations/route.ts` all call it
- **If `BookingContextMenu`'s `MenuItems` changes its `Separator`/`Item` injection API** → `BookingContextMenuWrapper` and `BookingOverflowMenu` in the same file, plus `BookingCard.tsx` and `BookingRow.tsx`
- **If `booking.allowedActions` response shape changes** → `BookingDetailPage.tsx`, `BookingDetailsSheet.tsx`, `BookingContextMenu.tsx`

### Navigation Integrity

- `window.location.href = `/checkouts/${json.data.id}`` at `BookingDetailsSheet.tsx:479` — hardcoded navigation that bypasses Next.js router. Works correctly but breaks soft navigation and Back button behavior.
- `router.push("/bookings?tab=checkouts")` at `page.tsx:187` — correct use of Next.js router.
- All other links and pushes verified as pointing to existing routes. ✅

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ⚠️ | `ItemBookingsTab` calendar view hides with `max-md:hidden` on mobile with no fallback — user sees blank space |
| Skeleton fidelity | ✅ | |
| Silent mutations | ⚠️ | `page.tsx` convert handler (line 183–188): no `toast.success` after reservation convert. `BookingDetailsSheet` audit-log load-more failure (line 210): silently swallowed. |
| Confirmation quality | ✅ | |
| Mobile breakpoints | ⚠️ | `ItemBookingsTab` calendar: `max-md:hidden` with no mobile fallback |
| Error message quality | ✅ | |
| Button loading states | ⚠️ | `BookingWizard.tsx` "Save draft & exit" button (line 660): no `disabled` or spinner during `await saveDraft()` |
| Role gating | ⚠️ | `canEditEquipment` in `BookingDetailsSheet` hardcoded `false` (line 725) — equipment edit never shows even for admins |
| Performance (N+1, over-fetch) | ✅ | All API routes use `Promise.all` and Prisma `include`. No N+1 found. |
| Debug cleanup (console.log, TODOs) | ✅ | |
| Accessibility basics | ⚠️ | `BookingRow.tsx:40,159` uses `role="link"` on sheet-opening rows — should be `role="button"`. `BookingContextMenu.tsx:85` wraps `Separator` in `<span>` (may break Radix DOM structure). |

---

## Raise the Bar

**Conflict auto-removal on 409** (`BookingWizard.tsx`).
When the wizard submit hits a 409 (conflict), it parses the conflicting asset IDs from the response and automatically removes them from the selection, then returns the user to Step 2 with per-item error messages. No other creation flow in the app (checkouts/new, reservations/new) does this — they show a generic error and make the user start over. The wizard pattern should be adopted by the kiosk checkout flow if it doesn't already handle conflicts this way.

**`allowedActions` from server** (`BookingDetailPage.tsx`, `BookingContextMenu.tsx`).
Booking actions are computed server-side and returned with every booking detail response. Client code reads from this list rather than re-deriving from role + status. This eliminates permission drift between client and server and means permission changes deploy without client code changes. The kiosk, checkout detail (`checkouts/[id]`), and any other "action-driven" pages should adopt this pattern if they haven't already.

---

## Quick Wins

**1. `src/components/booking-list/ConfirmBookingDialog.tsx`, `src/components/booking-details/BookingActions.tsx`, `src/components/create-booking/DetailsSection.tsx`, `src/components/create-booking/EventSection.tsx`** — delete all four dead component files. Zero risk: confirmed by grep that nothing imports them. ~5 minutes.

**2. `src/components/BookingDetailsSheet.tsx:479`** — replace `window.location.href = \`/checkouts/${json.data.id}\`` with `router.push(\`/checkouts/${json.data.id}\`)`. Import `useRouter` if not already present. ~5 minutes.

**3. `src/app/(app)/settings/bookings/page.tsx:33`** — delete the unused `formatDuration` function (lines 33–38). ~2 minutes.

**4. `src/app/(app)/bookings/page.tsx:46–50`** — convert `viewMode` `useEffect` to a `useState` lazy initializer to eliminate the layout flash:
```ts
const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
  try { return localStorage.getItem("bookings-view-mode") === "table" ? "table" : "cards"; }
  catch { return "cards"; }
});
```
~5 minutes.

**5. `src/components/booking-details/BookingOverview.tsx:65–73`** — replace the bare `fetch()` + `useEffect` for extend presets with `useQuery(["extend-presets"], ..., { staleTime: 600_000 })`. Eliminates the unnecessary re-fetch every time the sheet opens, removes the silent swallowed error, and shares the cache with any other consumer. ~15 minutes.

---

## Bigger Bets

**1. Extract shared booking action hooks to eliminate `BookingDetailsSheet` / `BookingDetailPage` divergence.**
The sheet has 17 `useState` hooks implementing extend, cancel, convert, edit, equipment-edit — all of which are independently implemented in `BookingDetailPage.tsx` too. Extract `useBookingEditor`, `useBookingExtend`, `useBookingCancel`, `useBookingConvert` hooks used by both. This eliminates: the `window.location.href` vs `router.push` divergence, the live countdown missing from the sheet, and the missing success toast on sheet convert. Cost: ~3 hours. Worth it — the divergence is already causing user-visible inconsistencies and will get worse as features are added.

**2. Fix `?filter=overdue` / `?filter=due-today` in `GET /api/bookings`.**
The "All" tab special filter UI sends the param but the route ignores it. Result: the "overdue" filter on the All tab returns all bookings, not just overdue ones. Fix requires adding the filter cases to the `listBookings` service or inline in the route. Cost: ~45 minutes including testing. This is a correctness bug, not just polish.
