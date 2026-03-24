# BookingDetailsSheet — Versioned Roadmap

**Owner**: AREA_CHECKOUTS
**Created**: 2026-03-24
**Status**: Active — V1 current, V2/V3 planned
**Related**: `docs/AREA_CHECKOUTS.md`, `docs/DECISIONS.md` (D-002, D-007, D-022, D-025)

---

## Current State Assessment

### What It Does Today

BookingDetailsSheet is a unified side-panel (Sheet) for viewing and editing both checkouts and reservations. It is the single-detail-view for all bookings across the app (D-022).

**Tabs**: Info | Equipment | History

**Implemented features**:
- View/edit booking metadata (title, dates, notes)
- View/edit equipment (serialized assets + bulk items via inline picker)
- Extend due date (quick-extend: +1d, +3d, +1w)
- Cancel booking (with confirmation)
- Convert reservation → checkout
- Check in items (individual + "check in all")
- Check-in progress bar (X/Y returned)
- Conflict detection (409 with banner showing overlapping booking)
- Audit history timeline with filter chips (all/booking/equipment)
- Admin-only JSON diff viewer in history
- Return location hint (single or mixed-location)
- Role-gated actions via server-computed `allowedActions`
- `If-Unmodified-Since` concurrency control on PATCH

### What Works Well (Keep in All Versions)
- Server-computed `allowedActions` — clean RBAC, no client-side role logic leaking
- SERIALIZABLE transaction on all mutations — data integrity is rock-solid
- Conflict detection with human-readable banner — users know exactly what conflicts
- Tab structure — clean separation of concerns (info/equipment/history)
- Audit trail — every mutation logged, admin can inspect diffs

### What's Missing or Broken
1. **No scan-to-add in equipment editor** — scanner only lives in EquipmentPicker on create flow
2. **Bulk quantity stepper has no max cap** — user can set qty=999 (backend rejects at submit)
3. **No optimistic rollback** — save failure leaves stale edit buffer; user must manually correct
4. **Custom CSS everywhere** — `.sheet-section`, `.timeline-*`, `.filter-chips` not using shadcn
5. **Raw `<textarea>`** — should be shadcn Textarea
6. **No keyboard shortcuts** — all interaction via mouse/touch
7. **No asset thumbnails** — imageUrl exists in schema but not shown in picker
8. **No stale-data detection** — tab backgrounded for 30 min, user interacts with stale data
9. **Audit log not paginated** — bookings with 1000+ entries will be slow
10. **DataList is custom** — not using shadcn patterns

### Schema Fields Not Yet Surfaced
- `sourceReservationId` — link back to original reservation (for converted checkouts)
- `eventId` / `sportCode` — event context visible elsewhere, not in detail sheet
- `shiftAssignmentId` — shift tie-in not shown
- `createdAt` — not displayed
- `BulkSkuUnit` (numbered units) — schema exists per D-022, no UI

### Who Uses This Page
- **STAFF** (primary): manage all bookings, edit equipment, extend, cancel, check in
- **ADMIN**: same as STAFF + audit diff viewer
- **STUDENT**: view own bookings, check in own items (limited actions)

### Mobile Viability
- Sheet works on mobile (responsive width)
- Quantity stepper buttons are small (h-8 w-8) — borderline for touch
- No swipe gestures, no mobile-optimized check-in flow
- Tab bar may wrap on very narrow screens

---

## V1 — Core Polish (current → independently shippable)

**Principle**: The sheet works today. V1 fixes the rough edges that cause confusion or data errors without adding new features. A staff member should never hit a confusing state.

### Features

- [x] View/edit booking metadata
- [x] View/edit equipment (serialized + bulk)
- [x] Extend, cancel, convert actions
- [x] Check-in (individual + all)
- [x] Conflict detection + banner
- [x] Audit history with filters
- [x] Role-gated actions
- [ ] **V1.1: Bulk quantity stepper cap** — disable + button at `currentQuantity`; show `qty/max`
- [ ] **V1.2: Migrate custom CSS to shadcn** — replace `.timeline-*` with Card/Badge, `.filter-chips` with ToggleGroup, raw `<textarea>` with shadcn Textarea, `.progress-*` with shadcn Progress
- [ ] **V1.3: Event/shift context display** — if `eventId` or `shiftAssignmentId` exists, show read-only context badge in Info tab (sport, event title, shift area)
- [ ] **V1.4: Source reservation link** — if converted checkout, show "Converted from RV-0042" link in Info tab
- [ ] **V1.5: CreatedAt + createdBy display** — show "Created by [name] on [date]" in Info tab footer

### What's NOT in V1
- No scan-to-add in equipment editor (V2)
- No keyboard shortcuts (V2)
- No asset thumbnails (V2)
- No stale-data detection (V2)
- No audit log pagination (V3)
- No real-time sync (V3)

### shadcn Components
- `Progress` — replace custom `.progress-track` / `.progress-fill`
- `Textarea` — replace raw `<textarea>`
- `ToggleGroup` — already used for picker tabs; extend to history filter chips
- `Badge` — already used; extend for event/shift context
- `Tooltip` — for truncated text and icon-only buttons
- `Separator` — between info sections

### API Routes
- All existing routes sufficient
- New: extend GET `/api/bookings/[id]` response to include `event.title`, `shiftAssignment.area` (if linked)

### RBAC
- No changes — existing `allowedActions` model handles everything

### Loading / Error / Empty States
- Already implemented; V1 adds Skeleton placeholders during initial fetch (replace Spinner)

### Mobile
- Increase quantity stepper touch targets to min 44x44px
- Ensure shadcn Progress component renders well at narrow widths

### Build Order
1. V1.2: shadcn migration (CSS → components) — largest visual change, no API work
2. V1.1: Bulk qty cap — small, self-contained
3. V1.3–V1.5: Context display — requires API response enrichment
4. Skeleton loading states

### Estimated Effort: 1 session

---

## V2 — Enhanced (faster workflows, fewer clicks)

**Principle**: Now that V1 is polished, make the sheet smarter. Reduce the number of steps for the most common workflows: check-in, equipment swap, and status review.

### New Features

#### 2.1: Scan-to-add in Equipment Editor
- Add QrScanner toggle button in equipment edit mode
- Reuse `handleScanToAdd` logic from EquipmentPicker (with computedStatus guard from stress test)
- Scan adds item to `editSerializedIds` or increments bulk qty
- Haptic + audio feedback on scan

#### 2.2: Scan-to-return in Check-in Mode
- When viewing a CHECKOUT with `canCheckin`, show "Scan to return" button
- Scanning an item's QR code immediately triggers check-in for that item
- Faster than finding the item in the list and clicking Return
- **This is the #1 field workflow improvement** — students return gear by scanning, not scrolling

#### 2.3: Asset Thumbnails in Equipment Tab
- Show 40x40px thumbnail from `asset.imageUrl` in equipment list rows
- Lazy-load with blur placeholder
- Helps visual identification for "which camera is this?"

#### 2.4: Keyboard Navigation
- `Tab` cycles through action buttons
- `Escape` closes sheet (already works via Sheet component)
- `1`/`2`/`3` switches tabs (Info/Equipment/History)
- `E` enters edit mode (if `canEdit`)
- `Ctrl+Enter` saves current edit

#### 2.5: Stale Data Detection
- Use Page Visibility API: when tab returns to foreground after >60s, show "Data may be stale — Refresh?" banner
- Auto-refresh on visibility change if sheet has been open >5 min
- Ties into GAP-12 system-level fix

#### 2.6: Inline Equipment Conflict Badges
- During equipment edit, show real-time availability status per item (like EquipmentPicker's conflict preview)
- Reuse `fetchConflicts` pattern with debounce + AbortController
- Items with conflicts show orange badge: "Booked Mar 25–28"

#### 2.7: Optimistic Rollback on Save Failure
- On PATCH failure, revert edit state to pre-save snapshot
- Show toast: "Save failed — changes reverted. [Retry]"
- Prevents stale edit buffer confusion

### What V1 Features Get Enhanced
- Equipment tab: add thumbnails (2.3) + conflict badges (2.6) + scan (2.1)
- Check-in flow: add scan-to-return (2.2)
- Edit mode: add keyboard shortcuts (2.4) + rollback (2.7)
- All: stale detection (2.5)

### shadcn Components (new)
- `Avatar` — for asset thumbnails (already available)
- `Skeleton` — for lazy-loaded thumbnails
- `AlertDialog` — for "Data may be stale" confirmation

### API Routes
- New: POST `/api/bookings/[id]/checkin-scan` — accepts scan value, resolves to assetId, performs check-in atomically (avoids client-side asset lookup + separate check-in call)
- Extend: GET `/api/bookings/[id]` — add `lastModified` header for stale detection

### Schema Changes
- None — all V2 features use existing models

### Dependencies
- V1 must be complete (shadcn migration enables clean thumbnail/badge integration)
- QrScanner component already exists and was hardened in stress test
- GAP-12 (Page Visibility) should be solved at system level first, then wired here

### RBAC
- Scan-to-return: same `canCheckin` gate
- Scan-to-add: same `canEdit` gate
- No new permissions needed

### Mobile
- Scan-to-return is THE mobile feature — students in the field scan items back
- Thumbnail size must work on 320px width (40px thumbnail + text)
- Keyboard shortcuts: desktop-only, hidden on touch devices

### Build Order
1. 2.1 + 2.2: Scan integration (biggest UX win, shared QrScanner component)
2. 2.6: Conflict badges (reuse EquipmentPicker pattern)
3. 2.7: Optimistic rollback (small, self-contained)
4. 2.3: Thumbnails (requires lazy-load setup)
5. 2.4: Keyboard shortcuts (desktop polish)
6. 2.5: Stale detection (depends on system-level GAP-12)

### Estimated Effort: 2–3 sessions

---

## V3 — Advanced (predictive, automated, real-time)

**Principle**: The sheet anticipates user needs. It surfaces the right information before the user asks, automates repetitive patterns, and handles multi-user coordination.

### New Features

#### 3.1: Smart Check-in Suggestions
- When opening a CHECKOUT that's near or past due, auto-expand Equipment tab with returnable items pre-highlighted
- Show "Quick return all" as primary action (not buried in footer)
- If booking has mixed return states, suggest "Return remaining 3 items?"

#### 3.2: Booking Templates
- "Save as template" action on any booking → captures equipment list + metadata
- Templates surfaced in create flow: "Use template: Game Day Camera Kit"
- Phase C feature per NORTH_STAR, but schema prep in V3

#### 3.3: Real-time Collaborative Awareness
- When two users have the same booking open, show avatar indicator: "Also viewing: [name]"
- If another user saves while you're editing, show conflict banner before you save
- Uses Server-Sent Events or polling (no WebSocket needed for low-frequency updates)

#### 3.4: Kit-Aware Equipment Display
- If booking contains items that form a kit (D-020), group them visually
- Show "Camera Kit A" as a collapsible group with its child items
- Kit completeness indicator: "3/4 items — missing: Lens Cap"
- Depends on kit management UI shipping first (GAP-13)

#### 3.5: Audit Log Pagination + Search
- Lazy-load audit entries (50 at a time) for bookings with long histories
- Search within history: "find all equipment changes"
- Collapsible day groups: "March 24 (5 entries)" → expand to see details

#### 3.6: Predictive Extend Suggestions
- If a booking is approaching due date and has items still checked out, proactively suggest extend
- Show: "Due in 2 hours — Extend to tomorrow?" as a banner
- Based on historical patterns: "You typically extend game-day checkouts by 1 day"

#### 3.7: Bulk Unit-Level Tracking
- If `BulkSku.trackByNumber` is true, show individual numbered units instead of quantity stepper
- Check in specific units: "Return Unit #7, Unit #12"
- Per-unit status: "Unit #3 — LOST" with audit trail
- Depends on D-022 BulkSkuUnit model being fully wired

#### 3.8: Cross-Booking Context
- Show related bookings: "This requester has 2 other active checkouts"
- Show asset history: hover/tap an item to see its last 3 bookings
- Link to requester's profile with booking summary

### API Routes (new)
- GET `/api/bookings/[id]/audit-logs?page=N&limit=50` — paginated audit
- GET `/api/bookings/[id]/related` — same requester's active bookings
- GET `/api/assets/[id]/recent-bookings?limit=3` — asset history preview
- POST `/api/booking-templates` — save template
- GET `/api/bookings/[id]/viewers` — collaborative awareness (SSE or polling)

### Schema Changes
- New: `BookingTemplate` model (title, equipment snapshot, metadata)
- New: `BulkSkuUnit.status` enum (AVAILABLE, CHECKED_OUT, LOST, DAMAGED) — if not already in D-022
- Possible: `BookingViewer` ephemeral table or Redis-backed presence

### Dependencies
- V2 must be complete
- Kit management UI (GAP-13 / D-020) must ship before 3.4
- D-022 BulkSkuUnit model must be fully wired before 3.7
- System-level SSE or polling infrastructure before 3.3

### RBAC
- Templates: STAFF/ADMIN can create; STUDENT can use but not create
- Collaborative awareness: all roles see viewers
- Audit pagination: existing role gates (admin sees diffs, others see summaries)

### Mobile
- Quick return banner (3.1) must be prominent on mobile — primary CTA position
- Kit groups (3.4) use Collapsible — works well on mobile
- Audit pagination (3.5) essential for mobile perf on long histories
- Cross-booking links (3.8) open in new sheet (stack, don't replace)

### Build Order
1. 3.5: Audit pagination (performance, no new models)
2. 3.1: Smart check-in suggestions (UX, no new models)
3. 3.6: Predictive extend (UX, no new models)
4. 3.8: Cross-booking context (new API, no new models)
5. 3.7: Bulk unit tracking (depends on D-022)
6. 3.4: Kit-aware display (depends on GAP-13)
7. 3.2: Templates (new model + UI)
8. 3.3: Real-time awareness (infrastructure)

### Estimated Effort: 4–6 sessions

---

## Dependencies Summary

| Version | Schema Changes | New API Routes | Prerequisite Components | System Dependencies |
|---------|---------------|----------------|------------------------|-------------------|
| V1 | None | Enrich GET `/api/bookings/[id]` response | None | None |
| V2 | None | POST `/api/bookings/[id]/checkin-scan` | QrScanner (exists) | GAP-12 (Page Visibility) |
| V3 | BookingTemplate model, BulkSkuUnit status | 4 new endpoints | Kit management UI (GAP-13) | SSE infrastructure |

---

## Risks

### Scope Creep: V1 → V2
- **Risk**: Scan-to-add feels "essential" and gets pulled into V1
- **Defense**: V1 is about polish, not new workflows. Scan requires QrScanner integration testing and new mobile interaction patterns. Keep it in V2.

### YAGNI in V2
- **Risk**: Keyboard shortcuts (2.4) may not be used — staff are on mouse, students on mobile
- **Defense**: Implement as last V2 item. Skip if usage data shows <5% desktop users.

### V3 Overreach
- **Risk**: Real-time collaborative awareness (3.3) is impressive but may not justify infrastructure cost for a team of 15 users
- **Defense**: Start with polling (5s interval), not SSE/WebSocket. If polling suffices, skip infrastructure investment.
- **Risk**: Booking templates (3.2) sound useful but may be premature — team may not have enough recurring patterns yet
- **Defense**: Defer until team explicitly requests. Track "same equipment set booked 3+ times" as signal.

### Tight Coupling
- **Risk**: V3 kit display (3.4) depends on kit management UI that doesn't exist yet
- **Defense**: V3 features are independent. Ship 3.5/3.1/3.6/3.8 without waiting for kit UI.

---

## Success Metrics (per NORTH_STAR)

| Version | Metric | Target |
|---------|--------|--------|
| V1 | Build passes, no custom CSS regressions | 100% |
| V1 | Event/shift context visible without navigating away | Yes/No |
| V2 | Scan-to-return: taps to complete check-in | ≤2 (scan + confirm) |
| V2 | Stale data incidents (user saves over newer data) | 0 |
| V3 | Audit log load time for 500+ entry bookings | <1s |
| V3 | Template adoption rate (bookings created from templates) | >20% of recurring events |
