# Brief: Item Bundling (Accessories) V1

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Date: 2026-03-15
- Status: Active
- Decision Ref: D-023 (Item bundling — parent/child accessory model)

---

## Problem Statement

Gear like an FX3 camera body ships with a handle, SmallRig cage, and other accessories that always travel together. Today these are separate inventory items with no relationship — they clutter booking line items, can be accidentally checked out separately, and there's no way to see what's attached to a camera body at a glance.

## Solution

Add a parent-child relationship on assets. A "parent" item (e.g., FX3 body) can have "accessories" (handle, cage, etc.) linked to it. Accessories:
- Inherit the parent's checkout/reservation status automatically
- Do **not** appear as separate booking line items
- Are only visible on the parent item's detail page
- Can be independently flagged for maintenance (e.g., broken handle)
- Can be moved between parents (swap cage from FX3 #1 to FX3 #2)

## Scope (V1)

### 1. Schema: Parent-Child Relation on Asset (Critical)
- Add `parentAssetId` nullable self-referential FK on Asset
- Child assets with a parent are not available for independent checkout
- Parent deletion does not cascade-delete children — unlinks them instead

### 2. Item Detail Page: Accessories Section (Critical)
- New "Accessories" section on parent item detail page
- Shows all child items with status badges
- "Attach accessory" action — search picker for unlinked items
- "Detach" action per accessory — unlinks without deleting
- "Move to..." action — reassign accessory to a different parent

### 3. Items List: Filter for Child/Available Items (High)
- By default, items list hides child items (they're not independently checkable)
- Add filter toggle: "Show accessories" or "Show all items"
- Child items in the list show parent name as secondary info

### 4. Checkout/Booking Integration (High)
- When a parent is added to a booking, accessories are NOT added as line items
- Accessories inherit parent's allocation status silently
- When parent is checked in, accessories are checked in too
- Scan page: scanning a child item's QR shows "This item is an accessory of [Parent Name]"

### 5. Conflict Visibility (Medium)
- If a parent item has an accessory in MAINTENANCE, show a warning badge on the parent
- Item detail page shows accessory status clearly (green/yellow/red per accessory)

## Out of Scope (V1)
- Multi-level nesting (parent → child → grandchild)
- Kit/template system (separate feature, D-020)
- Bulk reassignment of accessories
- Accessory "types" or categorization

## Files Changed
1. `prisma/schema.prisma` — Add `parentAssetId` self-ref on Asset
2. `prisma/migrations/NNNN_item_bundling/migration.sql` — Migration
3. `src/app/api/assets/[id]/route.ts` — Return accessories in detail response
4. `src/app/api/assets/[id]/accessories/route.ts` — NEW: attach/detach/move
5. `src/app/(app)/items/[id]/page.tsx` — Accessories section on detail page
6. `src/app/(app)/items/page.tsx` — Filter to show/hide child items
7. `src/app/api/assets/route.ts` — Exclude children from default list query
8. `src/lib/services/scans.ts` — Handle child item scan (show parent info)

## Acceptance Criteria
- [ ] AC-1: Staff can attach an accessory to a parent item
- [ ] AC-2: Staff can detach an accessory (becomes standalone)
- [ ] AC-3: Staff can move an accessory from one parent to another
- [ ] AC-4: Child items don't appear in booking line items
- [ ] AC-5: Child items inherit parent checkout/reservation status
- [ ] AC-6: Items list hides children by default, filter to show
- [ ] AC-7: Scanning a child QR shows "accessory of [Parent]" message
- [ ] AC-8: Accessory in MAINTENANCE shows warning on parent
- [ ] AC-9: Build passes, no regressions

## Risk Assessment
- **Low risk**: Additive schema change (nullable FK, no existing data affected)
- **Migration**: Existing items have no parent — all start as standalone
- **Booking integration**: Children are excluded from line items by query filter, not by status change
