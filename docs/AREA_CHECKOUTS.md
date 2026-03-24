# Checkouts Area Scope (V1 Hardened)

## Document Control
- Area: Checkouts
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-22
- Status: Active — V1 Shipped
- Version: V1

## Direction
Optimize handoff and return execution so daily operators can move fast without data integrity regressions.

## Core Rules
1. Checkout records use the unified Booking model and states: `BOOKED`, `OPEN`, `COMPLETED`, `CANCELLED`.
2. Event tie-in defaults ON at creation.
3. Event link is optional for ad hoc checkouts.
4. Status and availability logic remain derived from allocations, never authoritative stored status.
5. Role and ownership controls follow `AREA_USERS.md`.

## V1 Workflow

### Create Checkout
1. Start from `New Checkout`.
2. Event tie-in defaults ON.
3. If event tie-in ON:
   - Select sport
   - Select event in next 30 days (30-day window via `resolveEventDefaults` in `src/lib/services/event-defaults.ts`)
   - Prefill title, time window, and location from event context
4. Select borrower/owner.
5. Select equipment using the sectioned picker (see Equipment Picker section below).
6. Save as:
   - `OPEN` for immediate handoff
   - `BOOKED` for future handoff
7. Interrupted flows save as `DRAFT` and are recoverable from dashboard Drafts section.

### Edit Checkout
1. User opens checkout detail.
2. Editable fields respect role and ownership.
3. Mutations must preserve overlap and transaction constraints.

### Extend Checkout
1. `OPEN` checkouts can be extended if no conflicts exist.
2. Conflict must show blocking item and conflicting booking window.

### Check In
1. Partial check-in allowed for multi-item allocations.
2. Checkout remains `OPEN` until all allocated items are returned.
3. Auto-transition to `COMPLETED` when full return is confirmed.

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

### `BOOKED`
- Allowed actions:
  - View
  - Edit
  - Cancel
  - Convert to `OPEN`

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

### Tabs
1. **Info** — Card with "Checkout details" heading. SaveableField rows: title (editable), location, from/to dates, requester (with avatar), creator (with avatar), notes (editable), created. Mixed-location Alert if applicable.
2. **Equipment** — Card with progress bar, search (3+ items), serialized rows with context menu, bulk rows with return controls
3. **History** — Collapsible section with one-line preview when collapsed, ToggleGroup filters (All / Booking changes / Equipment changes), natural-language action labels

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
1. Event-linked checkout can be created without manual title/date entry.
2. User can create ad hoc checkout without event linkage.
3. State-based actions are enforced exactly by lifecycle state.
4. Partial check-in does not complete booking until all items are returned.
5. Extend flow blocks cleanly with actionable overlap details.
6. Permission and ownership gates match `AREA_USERS.md`.
7. Every mutation emits audit records with actor and diff context.

## Dependencies
- Event normalization read model from `AREA_EVENTS.md`.
- Equipment selection behavior from `AREA_ITEMS.md`.
- Permission policy from `AREA_USERS.md`.
- Integrity constraints and audit requirements from `DECISIONS.md` (D-001, D-006, D-007).
- Mobile operations contract from `AREA_MOBILE.md`.

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
- 2026-03-24: **Equipment Picker stress test** — (1) Scan-to-add now checks `computedStatus` before selecting — MAINTENANCE/CHECKED_OUT items rejected with status feedback. (2) Rapid-scan race condition fixed with callback-level duplicate guard. (3) Bulk quantity stepper capped at `currentQuantity` with qty/max display.
- 2026-03-24: **BookingDetailPage roadmap** — V1→V2→V3 progressive enhancement plan written to `tasks/booking-detail-roadmap.md`. Covers event context, scan visibility, inline editing, predictive features.
- 2026-03-24: **Equipment Picker hardening (4-pass)** — (1) Design system: removed 48 lines dead CSS (old picker styles, raw checkbox styles, broken `:has(input:disabled)` selector), removed dead `highestReached` state + `sectionIndex` import. (2) Data flow: `selectedIdSet` (Set) replaces O(n) `.includes()` per row; AbortController on availability fetch prevents stale response overwrite on rapid date changes. (3) Resilience: scan already-selected items shows "already selected" feedback; availability errors show orange "retry" link; scan feedback timer cleaned on unmount. (4) UX: scan "not found" gives location context; empty section with "Only available" active links to "show all"; availability retry inline.
