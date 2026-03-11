# Item Detail Page Expansion — Implementation Plan

## Summary
Expand the item detail page to match the updated AREA_ITEMS.md spec: interactive status line, working Actions menu, dashboard-style Info tab, Calendar/Settings tabs, QR management, fiscal year dropdown, and policy toggles.

## Slice Order

### Slice 1: Schema + Asset Action APIs
- Add 3 boolean policy fields to Asset: `availableForReservation`, `availableForCheckout`, `availableForCustody` (all default true)
- Migration `0006_asset_policy_toggles`
- `POST /api/assets/[id]/retire` — set status=RETIRED, audit
- `POST /api/assets/[id]/maintenance` — set status=MAINTENANCE, audit
- `POST /api/assets/[id]/duplicate` — clone asset with new QR+serial, audit
- `DELETE /api/assets/[id]` — only if no bookingSerializedItems exist, audit
- `POST /api/assets/[id]/generate-qr` — generate unique QR code, audit
- `PATCH /api/assets/[id]` — extend to support policy toggles + qrCodeValue uniqueness check

### Slice 2: Detail Page — Header + Actions
- Status line under headline with 6 states (Available/Checked Out by/Reserved by/Checking Out/Maintenance/Retired)
- Each booking-linked status clickable to the booking record
- Status derived from API data (computedStatus + activeBooking already returned)
- Need API to also return draft checkout info for "Checking Out" state
- Actions dropdown: Duplicate, Retire, Delete, Needs Maintenance
- Delete hidden/disabled when item has booking history
- All actions call respective APIs and reload

### Slice 3: Info Tab Dashboard
- Split Info tab into 2-column layout (left: operational, right: item info)
- Left column: Active checkout card (due-back countdown, holder, event, link)
- Left column: Upcoming reservations list (title, time, owner, link)
- Left column: Empty states when no activity
- Right column: Enhanced item info card
  - Category as dropdown (from /api/categories)
  - Fiscal year dropdown (July 1 rollover, computed options)
  - Link field (external URL)
  - Empty optional fields show "Add purchase price" style prompts
  - QR section: thumbnail + generate/manual entry

### Slice 4: Calendar + Settings tabs
- Calendar tab: show upcoming bookings in a simple timeline/list view
- Settings tab: 3 policy toggles with help text
  - Available for reservation
  - Available for check out
  - Available for custody
- ADMIN/STAFF only for Settings tab

## Key Design Decisions
- Status line reuses existing `computedStatus` + `activeBooking` from API — extend API to return draft checkout
- QR generation: use crypto.randomUUID() with collision retry — no external library needed for generation
- QR thumbnail: use a lightweight inline SVG QR renderer (or data URL)
- Fiscal year: pure utility function, no library needed
- Actions go through dedicated API endpoints (not PATCH) for clean audit trails
- Calendar tab V1 is a simple list view (not a full calendar widget)
