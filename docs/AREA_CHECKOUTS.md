# Checkouts Area Scope (V1 Hardened)

## Document Control
- Area: Checkouts
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-13
- Status: Active — V1 Shipped
- Version: V1

## Direction
Optimize handoff and return execution so daily operators can move fast without data integrity regressions.

## Core Rules
1. Checkout records use the unified Booking model and states: `PENDING_PICKUP`, `OPEN`, `COMPLETED`, `CANCELLED`.
2. Event tie-in defaults ON at creation.
3. Event link is optional for ad hoc checkouts.
4. Status and availability logic remain derived from allocations, never authoritative stored status.
5. Role and ownership controls follow `AREA_USERS.md`.
6. `PENDING_PICKUP` checkout allocations block overlapping serialized-item reservations and checkouts because custody has not transferred yet but the gear is already committed.
7. Booking windows are half-open for availability: a booking ending exactly when the next pickup/reservation starts is allowed; any overrun past that start time conflicts.

## V1 Workflow

### Create Checkout (Wizard — `/checkouts/new`)
Multi-step wizard page (replaced the old side-sheet flow as of 2026-04-09):

**Step 1 — Context & Details:**
1. Event tie-in defaults ON. Select sport → event (next 30 days) → auto-fills title, dates, location.
2. If no event: manual title + optional sport.
3. Select requester (borrower), location, optional kit, start/end dates.
4. Client-side validation: title, requester, location required; dates must be valid range.

**Step 2 — Equipment:**
1. Full `EquipmentPicker` with section tabs, search, availability conflict markers, QR scan-to-add.
2. Equipment guidance warns about compatible battery availability and support gear. Battery units are selected by quantity here; kiosk pickup scans bind the actual numbered units.
3. On mobile checkout: scan-first UI (camera open by default).

**Step 3 — Confirmation:**
1. Full summary with thumbnails, equipment list, kiosk pickup notice.
2. Submit → POST `/api/checkouts`. 409 conflicts shown inline (returns to Step 2).
3. Checkout is created with status `PENDING_PICKUP`. Gear must be picked up at a kiosk — no desktop/phone scanning allowed.

**Deep-link parameters:** `?title`, `?startsAt`, `?endsAt`, `?locationId`, `?newFor` (pre-select asset), `?eventId`, `?sportCode`, `?requesterUserId`, `?draftId`.

**Draft persistence:** "Save draft & exit" persists via `/api/drafts`. Resumable via `?draftId=`. Multi-event drafts persist ordered `BookingEvent` links, return ordered `events[]` on resume, and keep `Booking.eventId` as the chronologically first linked event for legacy readers.

### Edit Checkout
1. User opens checkout detail via BookingDetailsSheet.
2. Editable fields respect role and ownership.
3. Equipment editing uses full `EquipmentPicker` in the Equipment tab (same UX as creation — QR scan-to-add, section tabs, availability conflicts).
4. Mutations must preserve overlap and transaction constraints.

### Extend Checkout
1. `OPEN` checkouts can be extended if no conflicts exist.
2. Conflict must show blocking item and conflicting booking window.

### Check In
1. Partial check-in allowed for multi-item allocations.
2. Checkout remains `OPEN` until all allocated items are returned.
3. Auto-transition to `COMPLETED` when full return is confirmed.
4. **Scan-to-return** available in BookingDetailsSheet Equipment tab — inline camera with audio/haptic feedback, local QR lookup (zero API round-trip), celebration on all items returned.

### Cancel Checkout
1. Allowed only by policy and role.
2. Canceled records remain auditable.
3. No hard delete.
4. Cancelling a `PENDING_PICKUP` or `OPEN` checkout releases serialized allocations, cancels open scan sessions, restores outstanding bulk stock with a compensating `CHECKIN` stock movement, and releases any scanned numbered units before the booking moves to `CANCELLED`.

## Equipment Picker (V2 — Multi-Select, Search, Availability Preview, Scan-to-Add)

The equipment picker is a standalone component (`src/components/EquipmentPicker.tsx`) extracted from BookingListPage. It uses a sectioned flow with free tab navigation. Supporting libraries: `src/lib/equipment-sections.ts`, `src/lib/equipment-guidance.ts`.

> **Component Roadmap:** See `tasks/item-picker-roadmap.md` for the V1→V2→V3 evolution plan covering decomposition, shadcn alignment, compound component API, and generic picker abstraction.

### Section Order
1. **Cameras** — camera bodies, camcorders, cinema cameras, DSLRs, mirrorless
2. **Lenses** — lenses
3. **Batteries** — batteries, chargers, power supplies, V-mount, gold mount
4. **Accessories** — monitors, recorders, rigs, cages, gimbals, transmitters
5. **Others** — cables, audio, tripods, and catch-all items

All section tabs are freely navigable (no forward-lock). Section tabs show selected item count.

### Checkbox Multi-Select
- Each serialized asset row has a checkbox for toggle selection (replaces one-click-to-add).
- "Select all available" button selects all items without conflicts or status issues in the visible section.
- "Deselect section" button clears all selections in the current section.
- Selected items summary strip shows all selections with remove buttons.
- Bulk items retain their quantity stepper pattern. Numbered batteries are quantity-only at creation and bind to specific unit numbers at kiosk pickup.

### Per-Section Search
- Each section has a persistent search input (switching tabs preserves each section's search term).
- Client-side filter on tagName, productName, brand, model, serialNumber.
- Match count displayed when search is active.
- No 50-item cap — search makes the full list manageable.

### Section Classification
Assets are classified into sections by keyword matching against the asset's `type` field (from Cheqroom category import). Classification is case-insensitive substring matching. Implementation: `classifyAssetType()` in `src/lib/equipment-sections.ts`.

### Equipment Guidance Rules
Context-aware hints appear per section based on what has already been selected in other sections. All matching rules for the active section are shown simultaneously. Implementation: `getActiveGuidance()` in `src/lib/equipment-guidance.ts`.

Current rules:
- `body-needs-batteries` (warning): camera body selected, check compatible battery availability before checkout.
- `lens-needs-body` (warning): "You've added lenses but no camera body."
- `audio-with-video` (info): "Don't forget audio gear."

Adding new rules: add entries to `EQUIPMENT_GUIDANCE_RULES` array in `src/lib/equipment-guidance.ts`. No schema changes required.

### Availability Preview Badges
When a booking date window is set (startsAt/endsAt), the picker calls `POST /api/availability/check` with all asset IDs to detect scheduling conflicts. Results are shown as:
- Amber conflict badge on each conflicting item row with booking title and date range.
- Blue "Back before" badge when an item is free for the selected window but already needed by the next future booking.
- Orange/red "Turnaround" badge when a technically valid booking has operational risk: short time until next use, next use at another location, recent damage/lost report, or tight future bulk commitment.
- Conflicting items remain selectable (staff may need to override) but show warning styling.
- Future-booking context also appears in the booking detail Equipment tab for active checkouts so extend decisions show the next needed time before action.
- Badges update automatically when the date range changes (debounced 500ms).
- When no dates are set, falls back to current derived-status dots only.

### Scan-to-Add
- "Scan" button in the picker header opens a camera overlay (modal, not full-page navigation).
- Scanning a QR code (`bg://item/<uuid>`, `bg://case/<uuid>`, or raw asset tag) matches against loaded assets.
- Matching asset is auto-selected and the picker navigates to the correct section tab.
- Bulk bin QR codes are also supported — adds the bulk SKU with quantity 1.
- Camera stays open for continuous scanning (2s debounce). Close button dismisses overlay.
- Success/error feedback shown inline below the camera. Haptic vibration on success.
- Camera permission denied handled with error feedback.

### DRAFT Booking State
- `DRAFT` is a pre-BOOKED state for interrupted checkout creation flows
- Allowed actions on DRAFT: `edit`, `cancel`
- DRAFT records appear in dashboard Drafts section for recovery
- DRAFT records can appear in the unified All Active recovery view, but are not shown in the default Checkouts work queue
- Auto-created when checkout creation is interrupted before final save
- Implementation: `BookingStatus.DRAFT` in `src/lib/services/checkout-rules.ts`

---

## Action Matrix by State

Source of truth: `src/lib/services/booking-rules.ts` — `STATE_ACTIONS[CHECKOUT]`

### `DRAFT`
- Allowed actions:
  - Edit (resume)
  - Cancel (discard)

### `PENDING_PICKUP`
- Created on desktop wizard submit
- Allocations and bulk stock held immediately
- Kiosk pickup requires successful scan evidence for every serialized item before confirmation can transition the checkout to `OPEN`.
- Auto-expires after 48 hours past `startsAt` during `morning-refresh` if the student never picks it up. Expiry cancels the checkout, releases serialized allocations, restores held bulk stock, releases scanned numbered units, cancels open scan sessions, and writes a system audit entry.
- Allowed actions:
  - View
  - Edit (staff+/owner)
  - Cancel (staff+/owner)
  - Pickup at kiosk → transitions to `OPEN`

### `OPEN`
- Allowed actions:
  - View
  - Edit (staff+ or owner)
  - Extend (staff+ or owner)
  - Cancel (staff+ only — students cannot cancel OPEN checkouts even if owner)
  - Check in (partial or full, staff+ or owner)

### `COMPLETED`
- Allowed actions:
  - View only

### `CANCELLED`
- Allowed actions:
  - View only

## List and Detail UX Requirements
1. Checkout list is action-first and grouped by urgency.
2. Default active Checkouts view includes both `OPEN` and `PENDING_PICKUP` records because both are daily checkout work.
3. Row click opens BookingDetailsSheet.
4. Desktop shows context actions directly.
5. Mobile uses action sheet with same behavior.
6. Event badge is informational only and must not block operations if source event changes.
7. Mobile list cards and quick actions follow `AREA_MOBILE.md`.

## Checkout Detail Page (Unified with Reservations)

The checkout detail page (`/checkouts/[id]`) uses the shared `BookingDetailPage` component with `kind="CHECKOUT"`. See `src/app/(app)/bookings/BookingDetailPage.tsx`.

### Architecture
- **Route**: `src/app/(app)/checkouts/[id]/page.tsx` — thin wrapper passing `kind="CHECKOUT"`
- **Shared component**: `BookingDetailPage` serves both checkout and reservation detail
- **Hooks**: `useBookingDetail` (fetch + reload + optimistic patch), `useBookingActions` (all action handlers)
- **API**: All reads and inline field saves go to `/api/bookings/[id]` (GET + PATCH)
- **Old route**: `GET /api/checkouts/[id]` redirects (308) to `/api/bookings/[id]`

### Checkout-Specific Behavior
- Status badge shows display labels via `statusLabel()` helper: `PENDING_PICKUP` -> "Pending Pickup", `OPEN` -> "Checked out".
- "Due back" countdown rendered as urgency-colored Badge (red/orange/yellow/neutral)
- Action buttons: `[Actions ▼] [Edit] [Extend]` for app-owned actions. Custody pickup/return scans happen at the kiosk.
- Actions dropdown contains: Nudge borrower, Force complete, Duplicate, and Cancel when each action is allowed. It must not link to `/scan?checkout=...`.
- Equipment tab auto-selects all returnable items with Select all / Clear selection toggle
- Equipment rows show hover-reveal "..." menu (View item, Select for return)
- Checkin progress bar in equipment header: `████░░░░ 12/30 returned`
- Optimistic UI: returned items show immediately before API confirms
- Success toasts on all actions (extend, return, cancel, complete)
- Returned items show green checkmark and muted row background
- Breadcrumb handled by global `PageBreadcrumb` in AppShell (no duplicate)

### Tabs (BookingDetailsSheet)
1. **Details** — Booking overview: dates, requester, location, event context, extend presets, checkin progress, conflict banner.
2. **Equipment** — Item list with thumbnails, scan-to-return camera (for checkouts with `canCheckin`), "Edit equipment" opens full `EquipmentPicker` with QR scan-to-add. Badge shows unreturned item count.
3. **History** — Audit timeline with ToggleGroup filters (All / Booking changes / Equipment changes), cursor-paginated load-more.

### Inline Editing
- Title: `InlineTitle` component with save status indicator (spinner/check/error)
- Notes: blur-save via `useSaveField` pattern
- PATCH `/api/bookings/[id]` with single-field partial update
- Audit entries capture before-snapshot for field-level diffs
- "Refreshing…" spinner shown during data reload after actions

## Bug Traps and Mitigations

### Trap: Double submit creates duplicate checkouts
- Mitigation:
  - Idempotency token on create requests.
  - Disable submit during in-flight mutation.

### Trap: Extend passes UI but fails at commit due to overlap race
- Mitigation:
  - Keep SERIALIZABLE mutation handling.
  - Retry-safe error path with explicit conflict feedback.

### Trap: Partial check-in incorrectly flips to `COMPLETED`
- Mitigation:
  - Completion state requires zero active allocations.
  - Add invariant check before state transition.

### Trap: Stale event metadata blocks checkout operations
- Mitigation:
  - Treat event link as contextual metadata.
  - Checkout edit/check-in flows cannot depend on event feed availability.

### Trap: Student edits non-owned checkout via direct request
- Mitigation:
  - Server-side ownership enforcement on every mutation.
  - Audit denied attempts.

## Edge Cases
- No events in next 30 days for selected sport.
- Event missing opponent, venue, or end time.
- Cross-midnight checkouts and DST boundaries.
- Multi-location allocations on one checkout.
- Borrower reassignment mid-lifecycle.
- Check-in at alternate location due to approved exception.

## Acceptance Criteria
- [x] AC-1: Event-linked checkout can be created without manual title/date entry.
- [x] AC-2: User can create ad hoc checkout without event linkage.
- [x] AC-3: State-based actions are enforced exactly by lifecycle state.
- [x] AC-4: Partial check-in does not complete booking until all items are returned.
- [x] AC-5: Extend flow blocks cleanly with actionable overlap details.
- [x] AC-6: Permission and ownership gates match `AREA_USERS.md`.
- [x] AC-7: Every mutation emits audit records with actor and diff context.

## Dependencies
- Event normalization read model from `AREA_EVENTS.md`.
- Equipment selection behavior from `AREA_ITEMS.md`.
- Permission policy from `AREA_USERS.md`.
- Integrity constraints and audit requirements from `DECISIONS.md` (D-001, D-006, D-007).
- Mobile operations contract from `AREA_MOBILE.md`.

## Roadmaps
- `tasks/item-picker-roadmap.md` — EquipmentPicker V1→V2→V3
- `tasks/booking-details-sheet-roadmap.md` — BookingDetailsSheet V1→V2→V3

## Out of Scope (V1)
1. Booking engine rewrite.
2. Kiosk mode.
3. Advanced automation flows.

## Developer Brief (No Code)
1. Implement deterministic checkout creation path with event-default and ad hoc fallback.
2. Enforce state transition rules and action gating by state, role, and ownership.
3. Implement safe extend and check-in flows with overlap-aware conflict handling.
4. Preserve transaction integrity and derived-status invariants in every mutation.
5. Add regression coverage for race conditions, partial returns, and permission bypass attempts.

## Change Log
- 2026-05-13: EquipmentPicker battery guidance now recommends compatible battery families when cameras are selected, keeps battery selection quantity-first, labels selected item-family quantities as requested, and reminds staff that exact units are scanned at kiosk pickup.
- 2026-05-13: **Pending-pickup auto-expiry** - GAP-33 closed. Morning-refresh now cancels `PENDING_PICKUP` checkouts older than 48 hours after `startsAt`, releases serialized allocations, restores held bulk stock, releases any scanned numbered units, cancels scan sessions, and writes a system audit entry.
- 2026-05-10: **Status/data wiring ship fixes** - Cancelling `PENDING_PICKUP` and `OPEN` checkouts now restores outstanding bulk stock, releases scanned numbered units, and clears allocations/scan sessions atomically. Booking list route semantics now preserve explicit status filters instead of widening special filters over them, and search/calendar surfaces only pull schedule-active booking states by default.
- 2026-03-01: Initial standalone area scope created.
- 2026-03-01: Rewritten into hardened V1 workflow, logic, and failure-mode spec.
- 2026-03-02: Added explicit mobile contract dependency and list-action alignment.
- 2026-03-09: Added Equipment Picker section (kit-first sectioned flow, locked progression, guidance rules, conflict feedback). Added DRAFT booking state. Reflected shipped implementation from PRs 22–25.
- 2026-03-11: Docs hardening — added `booking-rules.ts` as action matrix source of truth. Added cancel-on-OPEN staff-only rule. Updated AREA_PLATFORM_INTEGRITY ref to DECISIONS.md. Marked V1 as shipped.
- 2026-03-15: Equipment Picker V2 — extracted into standalone component. Added checkbox multi-select, per-section search, availability preview badges, and scan-to-add QR overlay.
- 2026-03-16: Booking reference numbers (D-024) — CO-XXXX format, global sequence, searchable, monospace badge in list/detail.
- 2026-03-17: **Shift context banner** — when creating a checkout tied to an event, shows "Your shift: AREA time–time" banner with gear status if user has a shift assignment for that event.
- 2026-03-22: **Unified detail page** — Checkout and reservation detail pages unified via shared `BookingDetailPage` component. Extracted `useBookingDetail` + `useBookingActions` hooks. Old `/api/checkouts/[id]` GET redirects to `/api/bookings/[id]`. PATCH returns enriched detail with before-snapshot audit. Shared `InlineTitle` component. Accessibility + dark mode hardening.
- 2026-03-22: **Detail page UX polish (3 rounds)** — (1) Auto-select all returnable items, info card heading, mobile-friendly buttons, faster countdown tick, reload spinner, consistent padding, InlineTitle save feedback, collapsible history preview, hover consistency. (2) Optimistic checkin, progress bar, success toasts, quick-extend from picker value, re-select after partial return. (3) shadcn Breadcrumb/Collapsible/ToggleGroup/Alert replacements. Status vocabulary: OPEN→"Checked out". Action buttons redesigned: `[Actions ▼] [Edit] [Extend] [Check in]`. Equipment row context menus. Avatar initials on people fields. Due-back as urgency Badge. Natural-language activity labels.
- 2026-03-22: **iPhone mobile polish** — Detail page header stacks title above buttons on mobile (`flex-col sm:flex-row`). Equipment card header stacks title above return actions on mobile. Row action menus always visible on touch (hover-reveal only on sm+).
- 2026-03-23: **Scan page hardening (5-pass)** — (1) Design system: Progress bar, Badge, Alert, Skeleton replace custom CSS (-35 lines dead CSS). (2) Data flow: refresh-preserves-data, 401 handling on all endpoints, double-click ref guards, processingRef consistency. (3) Resilience: auto-clear scan feedback (5s/8s), try/catch/finally on numbered bulk flow, spam-click guards on unit picker. (4) UX: optimistic checklist update on scan success, Loader2 spinners on all async buttons.
- 2026-03-24: **Equipment Picker: shadcn alignment + performance + a11y** — (1) Replaced raw HTML checkboxes with shadcn `Checkbox`, raw buttons with shadcn `Button`, status "Added" span with `Badge`. (2) Added `assetById`/`bulkById` Maps for O(1) lookups replacing O(n) `.find()` in render loops. (3) Full ARIA: `role="tablist/tab/tabpanel/listbox/option/dialog"`, `aria-selected`, `aria-pressed`, keyboard nav (Arrow keys for section tabs, Space/Enter for item toggle, Escape for scanner). (4) `cn()` for all className merging. CSS updated for shadcn Button reset in footer tags.
- 2026-03-24: **Item Picker — global search, photos, bulk toggle fix** — (1) Cross-section global search: persistent search bar above tabs filters all assets across every section simultaneously. Arrow key navigation + Enter to select/deselect highlighted item. Section badge shown per result. Escape clears search. (2) Asset thumbnails in chosen items footer: selected item tags now show imageUrl thumbnail (18×18px) when available, both in open picker footer and closed summary. (3) Bulk item toggle fix: clicking a selected bulk item now deselects it (previously no-op with `if (isSelected) return`). (4) API: form-options now includes `imageUrl` in asset select.
- 2026-03-24: **Equipment Picker stress test** — (1) Scan-to-add now checks `computedStatus` before selecting — MAINTENANCE/CHECKED_OUT items rejected with status feedback. (2) Rapid-scan race condition fixed with callback-level duplicate guard. (3) Bulk quantity stepper capped at `currentQuantity` with qty/max display.
- 2026-03-24: **BookingDetailsSheet stress test** — (1) CRITICAL: `cancelBooking()` and `cancelReservation()` upgraded from READ_COMMITTED to SERIALIZABLE isolation, matching all other booking mutations. Prevents concurrent cancel race creating duplicate audit entries. (2) HIGH: null-safe guards on `enterEquipEditMode` array access. (3) MEDIUM: double-submit guards on `handleSave`/`handleEquipSave`. (4) MEDIUM: empty-payload PATCH skipped with "No changes to save" toast.
- 2026-03-24: **BookingDetailsSheet hardening (4-pass)** — (1) Design system: custom tab buttons → shadcn Tabs, Spinner → Skeleton, raw textarea → shadcn Textarea, .conflict-error → shadcn Alert, .progress-* → shadcn Progress, .filter-chips → ToggleGroup, .timeline-* → Tailwind with cn(). Removed ~120 lines dead CSS. (2) Data flow: AbortController on fetchBooking prevents stale data overwrite, all 7 fetch calls use fetchWithTimeout, silent refresh after mutations preserves visible content, 401 handling redirects to login on all endpoints. (3) Resilience: Retry button on fetch error, null-safe guards (?? []) on all booking arrays, checkinLoading guard on handleCheckinItem. (4) UX: extend toast shows new date ("Extended to Mar 28"), cancel confirmation names type and consequence, checkin toast includes item tag.
- 2026-03-24: **Equipment Picker hardening (4-pass)** — (1) Design system: removed 48 lines dead CSS (old picker styles, raw checkbox styles, broken `:has(input:disabled)` selector), removed dead `highestReached` state + `sectionIndex` import. (2) Data flow: `selectedIdSet` (Set) replaces O(n) `.includes()` per row; AbortController on availability fetch prevents stale response overwrite on rapid date changes. (3) Resilience: scan already-selected items shows "already selected" feedback; availability errors show orange "retry" link; scan feedback timer cleaned on unmount. (4) UX: scan "not found" gives location context; empty section with "Only available" active links to "show all"; availability retry inline.
- 2026-03-25: Doc sync — standardized ACs to checkbox format, all 7 checked.
- 2026-03-25: **Booking page hardening (5-pass)** — (1) Design system: error state → shadcn Alert with destructive variant, removed dead `statusBadge` config and duplicate export. (2) Data flow: `useBookingDetail` rebuilt with AbortController (prevents stale data on rapid id changes), 401/403 redirect, differentiated error types (not-found/network/auth/server), reload-preserves-data pattern. `BookingListPage` list fetch hardened with AbortController + 401 redirect + skeleton-only-on-initial-load. `useBookingActions` callAction + saveField: 401 redirect on all mutation endpoints. (3) Resilience: all 4 context menu handlers (cancel/convert/duplicate) upgraded with 401 redirect via fetchAction helper, success toasts on cancel/duplicate, cancel confirmations state irreversibility, null-safe checkin guard. (4) UX: manual refresh button with RefreshCw icon + tooltip, extend toast shows new date ("Extended to Mar 28").
- 2026-03-25: **Kit-to-booking integration (GAP-18)** — `kitId` FK on Booking model, kit selector in CreateBookingSheet, kit badge on booking detail page.
- 2026-03-25: **Overdue priority sort** — Overdue bookings now float to top of checkout and reservation list pages via client-side re-sort in `BookingListPage`. Longest-overdue items appear first within the overdue group. Time labels switched to explicit format ("3 days 2 hours overdue").
- 2026-03-26: **BookingListPage hardened (5-pass)** — Extend action now shows success toast ("Extended by N day(s)"). Error state differentiates network ("You're offline" + wifi-off icon) from server ("Failed to load" + clipboard icon). All 8 resilience scenarios verified.
- 2026-03-31: **Booking sheet deep links** — (1) Redirect pages forward all URL search params to `/bookings`. (2) Dashboard buttons ("New checkout", "New reservation", "Prep gear", event dropdown) open CreateBookingSheet in-place on the dashboard — no page navigation. (3) Event-context buttons auto-fill sport, event tie-in, title, dates, and location. (4) Item detail "Check out"/"Reserve" deep-link with `?newFor=assetId` to pre-select the asset. (5) `initialEventId`/`initialSportCode` props added to CreateBookingSheet for event auto-selection.
- 2026-03-30: **Photo requirement + scan-only checkin (D-028)** — (1) New `BookingPhoto` model stores condition photos per booking per phase (CHECKOUT/CHECKIN). (2) Camera-only `PhotoCapture` component captures still frames via `getUserMedia`. (3) `PhotoCaptureDialog` intercepts completion flow on scan page — photo must be taken and uploaded before checkout/checkin can complete. (4) Photos uploaded to Vercel Blob (`bookings/{id}/{phase}/`), stored as `BookingPhoto` records. (5) `completeCheckoutScan()` and `completeCheckinScan()` now enforce photo existence (admin override bypasses). (6) Manual checkbox-based item return removed from `BookingEquipmentTab` — all checkins now require scan-based flow. (7) "Complete check in" dropdown action removed from detail page. (8) Condition photos displayed in booking info tab with checkout/checkin grouping, actor attribution, and clickable full-size view.
- 2026-04-06: **Auth permission gates** — (1) `GET /api/bookings/[id]/audit-logs` now enforces `requireBookingAction(id, user, "view")` — students can only see audit logs for their own bookings. (2) `POST /api/checkouts/[id]/photo` now checks student ownership — students can only upload photos for their own checkouts.
- 2026-04-09: **Booking flow overhaul** — (1) Creation flow moved from side-sheet to full-page 3-step wizard at `/checkouts/new`. Steps: Context & Details → Equipment → Confirmation. (2) BookingDetailsSheet gains 3rd "Equipment" tab with unreturned badge count, scan-to-return (inline camera, local QR lookup, audio/haptic feedback), and full EquipmentPicker in edit mode (QR scan-to-add, section tabs, availability conflicts). (3) `CreateBookingSheet` and `BookingEquipmentEditor` deleted — replaced by wizard pages and EquipmentPicker respectively. (4) Asset thumbnails (`<AssetImage size={36}>`) added to all equipment rows (items, editor, picker). (5) Bulk qty stepper capped at `currentQuantity`, touch targets 32px→44px. (6) Stress-tested: 12 issues found, 8 fixed (broken redirect URL, stale scan state, date validation, audit log deps, draft save await, form-options error state).
- 2026-04-09: **EquipmentPicker rebuild + hardening (5-pass)** — (1) Rebuilt from scratch: full-row button toggles (no separate Checkbox — fixes double-fire bug), CheckCircle2/Circle selection icons, selected items shelf at bottom with thumbnails + remove buttons. (2) Extracted `useConflictCheck` hook — availability re-fires on selectedAssetIds changes (was stale ref bug). Removed 3 deprecated no-op props (visible, onDone, onReopen). Removed dead legacyMode path. (3) Dead `sectionCounts` useMemo removed. (4) `usePickerSearch` now tracks `searchError` state — picker shows "Failed to load equipment" instead of misleading "Nothing available" on 500/network errors. (5) Wizard Step 2 now requires ≥1 item before advancing. 401 handling + res.json() crash guard added to wizard submit. `initialSheetTab` cleared on sheet close to prevent stale tab persistence.
- 2026-04-24: **Multi-event booking V1 (D-031)** — Checkouts and reservations can now link up to 3 calendar events via the new `BookingEvent` junction table. Wizard Step 1 multi-select with chip strip + cap-enforced rows. `startsAt`/`endsAt` auto-derive min-to-max across selected events with the existing travel buffer. API accepts `eventIds[]` (mutually exclusive with legacy `eventId`); `POST /api/bookings/[id]` response includes `events[]` sorted by ordinal. `Booking.eventId` preserved as the primary (ordinal 0) so all 36+ existing readers keep working unchanged. Migration `0042_booking_events` backfills a junction row for every legacy booking.
- 2026-04-29: **Wizard polish + notes surfaced** — `notes` (10k chars, optional) is now editable in Step 1 textarea, persisted through draft save/load (`/api/drafts` schema updated), and shown in Step 3 confirmation. Step 3 multi-event display gains per-event date, home/away badge, and a `Primary` tag on the chronologically-first event for clarity in 2- and 3-event bookings. Required-field asterisks on title/requester/location/dates. Draft-banner dismissal persists 1h via sessionStorage to reduce nag for users who intentionally abandoned a draft. Inline comment in `BookingWizard.tsx` now states the multi-event contract explicitly (always `eventIds[]`, never `eventId`).
- 2026-04-30: **Booking + scan hardening wins** — (1) Booking detail condition photos now use `next/image` in `BookingInfoTab` (removed lint bypass for raw `<img>`). (2) `useScanSubmission` and `useBookingActions` now use shared safe JSON parsing helpers from `src/lib/errors.ts` instead of ad-hoc `.json().catch(() => ({}))` swallowing. (3) Added operational DB indexes for `notifications.sent_at`, `override_events.created_at`, and `bulk_stock_balances.bulk_sku_id` (migration `0049_add_operational_indexes`).
- 2026-05-05: **Event command checkout context** — Missing-gear "Create checkout" links now preserve `requesterUserId` through the booking list redirect into `/checkouts/new`, so the wizard opens for the assigned crew member instead of defaulting back to the current user.
- 2026-05-05: **Bulk battery creation hardening** — Battery selection remains quantity-only at booking creation. Camera body battery guidance is now a warning, and compatible battery low-stock warnings appear when available units fall below threshold.
- 2026-05-05: **Camera battery compatibility mapping** — Creation warnings now match the current import snapshot for Sony NP-FZ100 bodies (FX3, A7/A1/A9 family) and Sony BP-U bodies (FX6). The same compatibility rules also feed the admin Battery Cockpit low-family panel as of 2026-05-06. Drone/action/JVC battery reporting remains deferred until matching SKUs exist.
- 2026-05-06: **Booking filter HTML cleanup** — Shared `FilterChip` active clear controls are now sibling buttons instead of nested buttons inside the popover trigger, clearing the booking-list hydration warning. Booking search fields now carry stable `id`/`name` attributes.
- 2026-05-06: **Bookings ownership pass** — `/bookings` tab changes now update URL state for shareable All/Checkouts/Reservations views. The All tab is active-only by default (`DRAFT`, `BOOKED`, `PENDING_PICKUP`, `OPEN`) until a separate past toggle is shipped, and it uses each row's real checkout/reservation kind for allowed actions. Desktop equipment counts now include bulk planned quantities instead of counting one bulk SKU as one item. The page-level tabs and view switcher now match the local shadcn tab underline and ToggleGroup patterns.
- 2026-05-07: **Avatar and shadcn cleanup** — Booking cards now render equipment through the shared item thumbnail stack instead of person-avatar primitives, and booking list filter clears use shadcn `Button` variants instead of one-off raw buttons.
- 2026-05-07: **Bookings past-scope toggle** — `/bookings` now has a URL-backed Active/Past scope. The All tab remains active-only by default through `active=true`; switching to Past sends `past=true` through combined, checkout, and reservation list APIs so completed/cancelled records are intentionally separated from daily active work.
- 2026-05-07: **Booking creation ownership pass** — `/checkouts/new` now uses the documented 30-day event picker window in the browser, and draft save/resume preserves multi-event links through `/api/drafts` so interrupted event-linked checkouts reopen with their selected events intact.
- 2026-05-07: **Booking creation shadcn alignment** — Checkout creation now follows the Items list standard more closely: shared `PageHeader`, shadcn `Switch`/`Button`/`Badge` primitives, item-form section headings and rows, quiet bordered card surfaces, exact transitions, and browser-clean field labels.
- 2026-05-07: **Booking creation item picker flow** — Checkout creation `EquipmentPicker` now hydrates deep-linked selected assets outside the current section, uses shadcn `Tabs`/`Input`/`Checkbox`/`Button`/`Item`/`Empty` composition, restores scan-to-add inside Step 2, adds select-visible and clear-section actions, and lets users review as soon as the selection is valid instead of forcing a pass through every section.
- 2026-05-07: **Booking creation item picker hardening** — Checkout creation picker availability now checks visible-section assets plus selected assets, preserves search text per equipment section, keeps conflict-warning rows selectable, and passes `excludeBookingId` from booking-detail equipment edit so a booking does not conflict with itself.
- 2026-05-07: **Booking creation stale selection recovery** — Checkout creation now surfaces unresolved deep-linked or draft asset IDs as removable unavailable rows, and unresolved serialized assets no longer count toward review readiness, confirmation totals, draft saves, or create payloads.
- 2026-05-07: **Booking creation Step 2 UX polish** — Checkout creation Step 2 now shows a compact valid/warning/unavailable selection summary and uses state-aware footer copy such as "Review with warnings" or "Remove unavailable item" so students get clearer recovery and staff keep a faster review path.
- 2026-05-07: **Booking creation final-screen polish** — Checkout confirmation now leads with kiosk handoff expectations, pickup location, due-back timing, and a clearer pending-pickup notice. The submit button now says "Create pickup" because custody still starts at kiosk scan.
- 2026-05-07: **Check-in report photo evidence** — Damaged/lost item reports can include optional photo evidence stored on `CheckinItemReport.imageUrl`; this supports exception review without restoring the scrubbed checkout/check-in condition-photo gates.
- 2026-05-10: **EquipmentPicker component audit closeout** — Scan-to-add now rejects unavailable serialized gear instead of silently selecting it, caps scanned bulk quantities at available stock, adds in-place retry for picker load failures, gives empty states direct recovery actions for search and available-only filters, and keeps the selected shelf actions stable while availability rechecks run.
- 2026-05-10: **Booking row action semantics cleanup** — Booking cards and mobile booking rows now use a real primary open button with overflow menus as sibling controls, and desktop booking table rows expose keyboard open behavior through the primary title cell instead of a fake button row that also contains an action menu.
- 2026-05-10: **Bookings mounted-route polish** — `/bookings` now responds to tab, Active/Past, search, status, location, requester, special-filter, create, `highlight`, and legacy `id` URL changes after the page is already mounted. Booking view preference now loads after mount to avoid first-render `localStorage` drift, and cross-page links such as search results and activity timeline booking links hydrate the list/sheet without a hard refresh.
- 2026-05-10: **Bookings state polish** — `PENDING_PICKUP` is now first-class in the web list/detail UI: client row actions match the server matrix (`edit`, `cancel` before kiosk pickup), list dots use the orange status token, detail and report badges show display labels instead of raw enum text, and dashboard Awaiting Pickup links deep-link to `/bookings?tab=checkouts&status=PENDING_PICKUP`. Reservation detail reads now mark past-due `BOOKED` reservations as overdue, matching the list/API filters.
- 2026-05-10: **Bookings status ship fixes** — The default Checkouts tab now queries both `OPEN` and `PENDING_PICKUP` records so active checkout work is visible without coming from the dashboard. Explicit status filters still narrow to one state.
- 2026-05-10: **Scan handoff cleanup** — Checkout detail no longer links to app `/scan?checkout=...` for pickup or return. Open checkout detail shows the kiosk return handoff, pending-pickup checkout detail shows the kiosk pickup handoff, and app `/scan` remains lookup-only.
- 2026-05-08: **API hardening Wave 13** — Booking search now has trigram indexes, booking edits require `If-Unmodified-Since` conflict headers, edit audits store a full before snapshot, draft listing prunes drafts older than 30 days, check-in reports dedupe rapid repeats, and failed report persistence cleans newly uploaded evidence blobs.
- 2026-05-08: **Kiosk pickup scan guard** — Pickup confirmation now requires successful serialized checkout scan evidence for every serialized item, and kiosk scan lookup recognizes asset tag, primary scan code, QR value, `qr-` fallback, and serial number values. Browser/API smoke verified confirm-without-scan returns 409, serial scan succeeds, confirm opens the checkout, and cleanup restores the item to available.
- 2026-05-08: **Busy-day availability stress** — Live overlap smoke verified overlapping reservations/checkouts now block on `BOOKED`, `PENDING_PICKUP`, and `OPEN` serialized allocations, while non-overlapping same-day reservations still pass. Exact handoff boundaries are half-open: ending exactly at the next pickup/start is allowed, while ending one minute late conflicts. Bulk reservation commitments now subtract overlapping `BOOKED` reservation quantities from on-hand availability before create.
- 2026-05-08: **Future booking context** — Availability checks now return the next future serialized commitment per item, and checkout creation/edit plus active checkout equipment rows surface a blue "Back before" badge with the exact next needed time.
- 2026-05-08: **Turnaround risk guard** — Availability checks now return advisory serialized and bulk turnaround risks, and checkout creation/edit plus active checkout equipment rows surface compact "Turnaround" warnings for short handoffs, next-use location transfers, recent damage/lost reports, and tight future bulk bookings.
- 2026-05-09: **Badge achievements Slice 2** — checkout completion paths now emit feature-flagged returned badge events from the status-transition boundary: `markCheckoutCompleted`, partial serialized auto-complete, bulk auto-complete, and kiosk check-in auto-complete. On-time uses the D-034 15-minute UTC grace window.
