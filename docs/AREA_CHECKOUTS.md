# Checkouts Area Scope (V1 Hardened)

## Document Control
- Area: Checkouts
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-04-30
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
2. Equipment requirement rules enforced (e.g., camera body → batteries). Hard gate: cannot advance without satisfying requirements.
3. On mobile checkout: scan-first UI (camera open by default).

**Step 3 — Confirmation:**
1. Full summary with thumbnails, equipment list, kiosk pickup notice.
2. Submit → POST `/api/checkouts`. 409 conflicts shown inline (returns to Step 2).
3. Checkout is created with status `PENDING_PICKUP`. Gear must be picked up at a kiosk — no desktop/phone scanning allowed.

**Deep-link parameters:** `?title`, `?startsAt`, `?endsAt`, `?locationId`, `?newFor` (pre-select asset), `?eventId`, `?sportCode`, `?draftId`.

**Draft persistence:** "Save draft & exit" persists via `/api/drafts`. Resumable via `?draftId=`.

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
- Bulk items retain their quantity stepper pattern.

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
- `body-needs-batteries` (warning): "You selected a camera body — don't forget batteries and chargers."
- `lens-needs-body` (warning): "You've added lenses but no camera body."
- `audio-with-video` (info): "Don't forget audio gear."

Adding new rules: add entries to `EQUIPMENT_GUIDANCE_RULES` array in `src/lib/equipment-guidance.ts`. No schema changes required.

### Availability Preview Badges
When a booking date window is set (startsAt/endsAt), the picker calls `POST /api/availability/check` with all asset IDs to detect scheduling conflicts. Results are shown as:
- Amber conflict badge on each conflicting item row with booking title and date range.
- Conflicting items remain selectable (staff may need to override) but show warning styling.
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
- DRAFT is never shown in main checkout lists (only in Drafts lane)
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
2. Row click opens BookingDetailsSheet.
3. Desktop shows context actions directly.
4. Mobile uses action sheet with same behavior.
5. Event badge is informational only and must not block operations if source event changes.
6. Mobile list cards and quick actions follow `AREA_MOBILE.md`.

## Checkout Detail Page (Unified with Reservations)

The checkout detail page (`/checkouts/[id]`) uses the shared `BookingDetailPage` component with `kind="CHECKOUT"`. See `src/app/(app)/bookings/BookingDetailPage.tsx`.

### Architecture
- **Route**: `src/app/(app)/checkouts/[id]/page.tsx` — thin wrapper passing `kind="CHECKOUT"`
- **Shared component**: `BookingDetailPage` serves both checkout and reservation detail
- **Hooks**: `useBookingDetail` (fetch + reload + optimistic patch), `useBookingActions` (all action handlers)
- **API**: All reads and inline field saves go to `/api/bookings/[id]` (GET + PATCH)
- **Old route**: `GET /api/checkouts/[id]` redirects (308) to `/api/bookings/[id]`

### Checkout-Specific Behavior
- Status badge shows "Checked out" (not "OPEN") via `statusLabel()` helper
- "Due back" countdown rendered as urgency-colored Badge (red/orange/yellow/neutral)
- Action buttons: `[Actions ▼] [Edit] [Extend] [Check in]` — Check in is primary CTA
- Actions dropdown contains: Scan items out, Scan items in, Complete check in, Cancel
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
