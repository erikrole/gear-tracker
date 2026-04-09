# Bulk Items V2 — Location-Aware Inventory & Scanning

**Status:** Planning  
**Owner:** Creative Product  
**Scope:** Numbered & untracked bulk items with location-split inventory, scanning-driven returns, transfer function  
**Context:** D-022 (numbered units via `trackByNumber` flag) exists. `BulkStockBalance` tracks per-location inventory. Students check out from kiosks; staff manage stock.

---

## Mental Model

### Item Types
- **Numbered items** (high-value, tracked): Sony batteries, monitor batteries
  - Single SKU with `trackByNumber: true`
  - `BulkSkuUnit` records (Unit #1–N) with QR codes physically affixed
  - Location-split: "40 @ Camp Randall, 10 @ Kohl Center"
  - Checkout: Students scan unit QR codes to claim specific numbered units
  - Return: Scan each unit to verify custody; unscannable units marked as lost

- **Untracked bulk** (consumables, low-unit-cost): Sand bags, light stands, charge cables
  - Single SKU with `trackByNumber: false`
  - Location-split: "6 @ Camp Randall, 2 @ Kohl Center"
  - Checkout: Students enter quantity (no scanning)
  - Return: Quantity input, no scan verification

### Inventory Location Model
- All bulk SKUs are location-aware via `BulkStockBalance(bulkSkuId, locationId)`
- Display default: **show all locations at once** (matrix view, not location tabs)
- Kiosk context: System triangulates location from kiosk device
- Explicit selection: Available when user needs to override default

---

## UI Surfaces & Flows

### 1. Items List Page

**Display Format**
```
[Icon] Sony Battery
       40 @ Camp Randall / 10 @ Kohl Center
       45 available of 50 total
```
- Single row per bulk SKU (aggregated across locations)
- Subline shows location breakdown (Camp Randall / Kohl Center format)
- Status line: "X available of Y total" (accounting for all checkouts)
- No location filtering on list; detail page shows matrix

**Discovery & Search**
- When student searches "battery," system shows all batteries everywhere (by item, not location-split)
- Rationale: Simple, unified inventory view for students

---

### 2. Bulk Item Detail Page (Matrix View)

**Stock Table — All Locations at Once**
```
                      Camp Randall | Kohl Center | Total
On Hand                      40    |      10     |  50
Checked Out                    5    |       2     |   7
Available                     35    |       8     |  43
```

**Numbered Items Section** (if `trackByNumber: true`)

Colored grid view of units:
```
Camp Randall                          Kohl Center
[1] [2] [3] [4] [5]                  [41] [42] [43] [44] [45]
[6] [7] [8] [9] [10]                 [46] [47] [48] [49] [50]
[11] [12] [13] [14] [15]
[16] [17] [18] [19] [20]
...

Color key:
  🟢 Green = Available
  🔴 Red = Checked out / Unavailable
  🟠 Orange = Reserved (future booking)
  ⚫ Black = Lost
```

- Units grouped by location
- Each cell shows unit number
- Color indicates status at a glance
- Click unit for details: who checked it out, when, due date, etc.

**Transfer Controls** (between locations)
```
Camp Randall        [← → Transfer →] Kohl Center
  40 units                                10 units

Drag-to-transfer: Drag unit #5 from left column to right column
OR Quantity transfer: [Transfer 5 from left to right] [Move]
```
- Simple control to move units between locations
- Shows running totals as you move

**Admin Actions**
- `[Mark as Lost...]` → Numbered items only; click unit or scan QR to mark lost
- Stock movements logged to audit trail

---

### 3. Checkout Flow (Kiosk-Based, Location Implicit)

#### 3a. Untracked Bulk (Sand bags, light stands)
```
1. Kiosk scans equipment barcode (SKU) or staff selects via UI
2. Location auto-inferred from kiosk device (e.g., Kohl Center)
3. Quantity input: "How many sand bags?"
4. Confirm: "Check out 5 sand bags from Kohl Center"
5. Create booking with BookingBulkItem(bulkSkuId, plannedQuantity=5, locationId=Kohl Center)
```

#### 3b. Numbered Items (Sony batteries)
```
1. Kiosk scans equipment barcode (SKU) or staff selects via UI
2. Location inferred from kiosk device (e.g., Camp Randall)
3. System shows available units from Camp Randall:
   "Available: Units 1–5, 10–15, 20, 25–30"
4. Student grabs units from cabinet and scans each QR:
   - Scan Unit #2 → Toast: "✓ Unit #2 selected"
   - Scan Unit #5 → Toast: "✓ Unit #5 selected"
   - Scan Unit #25 → Toast: "✓ Unit #25 selected"
   - Show running total: "3 selected"
5. Confirm: "Check out Unit #2, #5, #25 from Camp Randall"
6. Create booking with:
   - BookingBulkItem(bulkSkuId, plannedQuantity=3, locationId=Camp Randall)
   - BookingBulkUnitAllocation records for Unit #2, #5, #25
```

**Key Design Decisions**
- No location picker needed — kiosk location is authoritative
- Students simply grab and scan from the designated gear cabinet
- System knows location implicitly from kiosk device

---

### 4. Check-in / Return Flow

#### 4a. Untracked Bulk (Quantity Only)
```
1. Open booking detail
2. Equipment tab shows: "5 sand bags — planned"
3. Scan QR on booking (or auto-identify via kiosk)
4. Quantity input: "How many are you returning?" (max 5)
5. Confirm: "Return 4 sand bags to Camp Randall, mark 1 as lost"
   (or: "Return 5 of 5")
6. Update BookingBulkItem: checkedInQuantity = 4
7. Toast: "✓ 4 returned, 1 marked as lost"
```

#### 4b. Numbered Items (Scan Each Unit)
```
1. Open booking detail
2. Equipment tab shows: "Unit #1, #3, #5 @ Camp Randall"
3. Scan QR on first unit
   - Toast: "✓ Unit #1 verified"
   - Show checklist: [✓] #1, [ ] #3, [ ] #5
4. Scan Unit #3
   - Toast: "✓ Unit #3 verified"
   - Checklist: [✓] #1, [✓] #3, [ ] #5
5. If Unit #5 can't be scanned (lost):
   - Timeout or skip → Show modal: "Can't scan Unit #5?"
   - Options: [Mark as Lost] [Try Again]
   - Mark as Lost: Creates AuditLog entry, updates BulkSkuUnit.status = LOST
6. Confirm: "Return Unit #1, #3. Mark Unit #5 as lost."
7. Update BookingBulkUnitAllocation with checkinTimestamp for #1, #3
8. Update BulkSkuUnit for #5: status = LOST, lostAt = now()
9. Toast: "✓ 2 returned, 1 marked as lost"
```

**Questions to resolve:**
- Should the system prevent checking in units that aren't part of the booking (e.g., accidentally scanning a battery from a different booking)?
- Should we show a "Scan Summary" screen at the end before confirming, or inline as they scan?
- How long should the scan timeout be before offering the "Can't scan?" option?

---

### 5. Kiosk Context & Location Triangulation

**Kiosk-Based Checkout** (numbered items)
```
1. Kiosk knows its location (Kohl Center)
2. Student scans equipment picker barcode
3. System shows only units from Kohl Center upfront
4. Student scans unit QR codes from the bin
5. Booking created with locationId = kiosk.locationId
```
Benefit: Explicit, no ambiguity. Student can only check out from where they are.

**Web-Based Checkout** (staff or student on laptop)
```
1. Staff creates booking for student
2. Explicit location dropdown, OR
3. Auto-select from student's "home location" / role context (deferred design)
4. Numbered items: show units from selected location only
```

**Web-Based Return** (student on mobile after event)
```
1. Student opens booking detail
2. No location context (could be anywhere)
3. Scan unit QR codes to verify
4. System checks: "Unit #5 belongs to booking. Location: Camp Randall."
5. Student returns units from wherever they are
```
Question: Should we validate that they're returning to the correct location (e.g., prevent returning at Kohl Center if checked out from Camp Randall)?

---

## Stock Adjustment & Transfer

### Admin Adjustment (Quantity Add/Remove)
```
Modal:
  Location: [Camp Randall ▼]
  Adjustment: [+30] → "Add 30"
  Reason: [select/text] "Received from B&H" / "Lost in damage"
  
Result:
  - BulkStockBalance.onHandQuantity += 30
  - AuditLog entry with before/after
  - If numbered items: auto-create BulkSkuUnit records for new units
```

### Transfer Function (Move Units Between Locations)
```
Modal:
  From: [Camp Randall ▼]
  To: [Kohl Center ▼]
  Units: [10]
  (For numbered: show unit # ranges or toggle "all" / "numbered")
  Reason: "Redistributing inventory for weekend events"
  
Result:
  - BulkStockBalance @ Camp Randall: -10
  - BulkStockBalance @ Kohl Center: +10
  - For numbered items: update BulkSkuUnit.locationId for each unit
  - AuditLog entry
```

---

## Low-Stock Alerts

### Alert Logic (Configurable per SKU)
- Threshold: "Warn when total ≤ X" (e.g., ≤ 10 Sony batteries system-wide)
- Threshold per location: "Warn when location ≤ Y" (e.g., Camp Randall ≤ 5)

### Alert Surface
- **Dashboard** (admin/staff view): "⚠️ Sony batteries low: 5 @ Camp Randall, 3 @ Kohl Center (threshold: 5 each)"
- **Notification** (async): Escalate via cron job if low for >24h
- **Bulk inventory detail**: Color-code rows (red for low, yellow for approaching threshold)

---

## Acceptance Criteria

- [ ] Items list: Single row per SKU, subline shows location breakdown (X @ Camp Randall / Y @ Kohl Center)
- [ ] Detail page: Matrix view (on-hand, checked out, available by location) + colored unit grid
- [ ] Unit grid: Green (available), Red (unavailable), Orange (reserved), Black (lost)
- [ ] Untracked bulk checkout: Kiosk location inferred, quantity input only
- [ ] Numbered item checkout: Kiosk location inferred, available units shown, students scan QR codes
- [ ] Untracked return: Quantity input, optional loss marking
- [ ] Numbered return: Scan each unit to verify, mark unscannable as lost
- [ ] Transfer function: Drag or quantity-based move between location columns
- [ ] Low-stock alerts: System-wide and per-location thresholds respected
- [ ] Kiosk checkout: Location triangulation works, units filtered by kiosk device location
- [ ] Scan flow: Warning if unit not in booking; error handling for cross-booking scans
- [ ] Audit trail: All movements logged (transfers, losses, adjustments)
- [ ] Test coverage: Service layer (location-aware queries, unit allocation, transfers)

---

## Design Decisions (Resolved)

1. **Transfer UI** → Quantity input + "Move" button (simpler than drag)
   ```
   Camp Randall [40] ← [5] → [10] Kohl Center
                    [Move]
   ```

2. **Unit Grid Interaction** → Hover tooltip (if easier to implement)
   - Shows status: "Unit #5 — Available" or "Unit #5 — Checked out by Alex, due 2026-04-10"
   - No click action (keep it simple for V1)

3. **Untracked Bulk Loss** → Auto-count as loss if returning fewer than planned
   - No explicit "mark as lost" button; returning 4 of 5 automatically marks 1 as lost
   - AuditLog entry created for the loss

4. **Web-Based Checkout** (staff creating bookings)
   - Explicit location picker before quantity
   - Staff selects "checking out from: Camp Randall" then quantity
   - Rationale: Staff accountability for location

5. **Audit Trail** → Inline in detail page (no separate tab)
   - Show below matrix/grid as movement history
   - Include transfers, adjustments, losses

---

## Implementation Slices (Tentative)

**Slice 1: Items List & Bulk Detail Page**
- Display single row per bulk SKU with location breakdown (subline)
- Detail page: matrix view (all locations, on-hand/checked-out/available)
- Unit grid view with color coding (green/red/orange/black)
- Click unit for detail popover (status, who has it, due date)

**Slice 2: Kiosk Checkout — Untracked Bulk**
- Kiosk scans SKU barcode → system infers location
- Quantity input UI
- Create BookingBulkItem with locationId from kiosk
- Confirmation toast

**Slice 3: Kiosk Checkout — Numbered Items**
- Kiosk scans SKU barcode → system infers location
- Show available units from that location
- Student scans unit QR codes (one by one)
- Toast per scan, running total
- Create BookingBulkItem + BookingBulkUnitAllocation records

**Slice 4: Kiosk Return — Untracked Bulk**
- Kiosk/web returns booking with bulk items
- Quantity input: "Return X of Y"
- Optional loss marking for unreturned units
- Update BookingBulkItem.checkedInQuantity

**Slice 5: Kiosk Return — Numbered Items**
- Kiosk/web returns booking with numbered units
- Student scans each unit QR to verify
- Toast per scan + checklist
- If unscannable: "Mark as lost?" option
- Update BulkSkuUnit status + BookingBulkUnitAllocation records

**Slice 6: Transfer Function & Admin Controls**
- Drag/quantity-based transfer between location columns
- Mark units as lost (click or scan)
- Stock adjustment (add/remove quantity per location)

**Slice 7: Alerts & Audit Logging**
- Low-stock alerts (system-wide + per-location thresholds)
- Audit trail for all transfers, adjustments, losses
- Movement history in detail page
