# AREA: Kits Management

## Document Control
- Area: Kits Management
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-04-09
- Status: Active
- Version: V1
- Brief: `BRIEF_KIT_MANAGEMENT_V1.md`
- Decision Refs: D-020 (kit-to-booking)

## Direction
Enable staff to group related gear items into named kits for faster checkout workflows. Student scans kit QR or staff selects from kit dropdown during booking — all kit members are added to the booking in one action.

## Core Rules
1. Kit is a named group of serialized items (via `KitMembership`) and/or bulk SKUs (via `KitBulkMembership`).
2. Kits are location-scoped (tied to a `Location`).
3. Staff (ADMIN/STAFF) can create, rename, describe, add/remove members, archive kits.
4. Students can see kits via gear selection during booking and checkout flows.
5. Archived kits are hidden by default but can be shown with filter toggle.
6. Kit member count is displayed inline.
7. Kit with zero members shows "Empty" status; non-empty kits show "Ready".

## Routes

### `/kits`
- **Page:** `src/app/(app)/kits/page.tsx`
- **Type:** List view with search, location filter, show archived toggle, pagination
- **Components:**
  - `PageHeader` with "New Kit" button opens `NewKitSheet`
  - Search input (case-insensitive name/description search via `useKitsQuery`)
  - Location filter dropdown (loads from `/api/locations`)
  - Show archived checkbox
  - Desktop table: columns are Name (with description), Location, Items count, Status, Updated date
  - Mobile card layout: compact card per kit with name, status, member count, location
  - Pagination: shows X of Y kits
- **Behaviors:**
  - Click row → navigate to kit detail
  - Empty states: "No kits yet" (no filters) or "No kits match filters" (with filters)
  - Load error state with retry button
  - Sort by Name, Item count, or Updated date
- **Data:** `/api/kits?search=...&locationId=...&includeArchived=...&sortBy=...&sortOrder=...`

### `/kits/[id]`
- **Page:** `src/app/(app)/kits/[id]/page.tsx`
- **Type:** Detail view — kit settings, member list (serialized), bulk member list
- **Sections:**
  1. **Header:** Kit name (editable), location, description (editable), created/updated dates
  2. **Serialized Items:** Table of kit members (asset tag, name, brand/model, type, status, date added). Search bar. Add items via `EquipmentPicker` (shares code with booking flow). Remove button per row.
  3. **Bulk Members:** Table of bulk SKU members (SKU name, category, unit, quantity). Search bar. Add bulk SKUs (quantity picker). Remove button per row.
  4. **Actions:** Archive/unarchive kit. Delete kit (deletes all memberships).
- **Behaviors:**
  - All edits are inline (name/description via `SaveableField` component)
  - Add item opens equipment picker modal (same component as booking creation)
  - Bulk operations: confirm dialog before remove/delete
  - 401 redirect on all mutations
  - Error toast + retry on mutation failure
- **Data:**
  - GET `/api/kits/[id]` → `KitDetail` with members and bulkMembers arrays
  - PATCH `/api/kits/[id]` → name, description, active flag
  - POST `/api/kits/[id]/members` → add serialized item (assetId)
  - DELETE `/api/kits/[id]/members/[membershipId]` → remove item
  - POST `/api/kits/[id]/bulk-members` → add bulk SKU (skuId, quantity)
  - DELETE `/api/kits/[id]/bulk-members/[membershipId]` → remove bulk SKU

### `/kits/new`
- **Sheet:** `src/components/new-kit-sheet.tsx` (opened via button on `/kits`)
- **Type:** Modal dialog
- **Fields:** Name (required), description (optional), location (dropdown)
- **Behaviors:** Submit creates kit; on success, redirects to kit detail page with success toast

## Data Model

**Key tables:**
- `Kit` — name, description, active (boolean), location FK, timestamps
- `KitMembership` — kit FK, asset FK, timestamps (one-to-many to Kit)
- `KitBulkMembership` — kit FK, bulk SKU FK, quantity, timestamps (one-to-many to Kit)

## Hardening Notes

See `AREA_ITEMS.md` 2026-04-06 entry for kit detail page hardening work:
- All 6 mutations wrapped with `requireAuth()` + 401 redirect
- Kits list page already uses `useFetch` hook (AbortController, 401 handling, focus refresh)

## Acceptance Criteria
- [x] AC-1: Staff can create, rename, describe, and archive kits
- [x] AC-2: Kits can contain serialized items and bulk SKUs
- [x] AC-3: Kit membership add/remove with error handling
- [x] AC-4: Kit QR generation for direct checkout flow (D-020)
- [x] AC-5: Kits visible in booking equipment picker
- [x] AC-6: Mobile kit list responsive; detail scrollable

## Change Log
- 2026-03-16: Kit CRUD API and detail page shipped (D-020 implementation). Kit member add/remove with equipment picker reuse. Archive toggle. Hardening: 401 guards on all mutations, AbortController cleanup on list page.
- 2026-04-06: Kits detail page hardening (5-pass audit) — 401 redirect on all 6 mutations (save name, save description, add member, remove member, toggle archive, delete). Kits list page already uses `useFetch` hook.
- 2026-04-09: Doc sync — created AREA_KITS.md as formal feature area documentation.
