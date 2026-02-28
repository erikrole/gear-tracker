# Phase 1 — Audit & Refactor Plan

## Audit Summary (2026-02-28)

### 1. Current Repo Structure

```
gear-tracker/
├── prisma/              # Schema (15 models, 9 enums) + 2 migrations + seed
├── scripts/             # DB setup, Cheqroom CSV importer
├── src/
│   ├── app/
│   │   ├── (app)/       # Protected pages: dashboard, items, checkouts,
│   │   │                #   reservations, bulk-inventory, users, profile
│   │   ├── login/       # Public auth pages
│   │   ├── register/
│   │   └── api/         # 20+ route files covering assets, bookings,
│   │                    #   checkouts, reservations, bulk-skus, calendar,
│   │                    #   dashboard, auth, users, availability, etc.
│   ├── components/      # 4 components: AppShell, Sidebar, Modal, DonutChart
│   └── lib/
│       ├── auth.ts      # HMAC session tokens, bcrypt, 12h sessions
│       ├── db.ts        # Prisma singleton
│       ├── rbac.ts      # ADMIN > STAFF > STUDENT
│       ├── validation.ts # Zod schemas
│       ├── time.ts      # Date utilities
│       ├── http.ts      # HttpError + response helpers
│       └── services/    # availability.ts, bookings.ts, scans.ts
├── prompts/             # Phase implementation specs
├── tasks/               # This file
└── tests/               # 1 test file (time.test.ts)
```

**Stack:** Next.js 15 (App Router) + React 19 + TypeScript 5.9 + Prisma 6.19 + Neon PostgreSQL + Zod + Vitest. Deployed via Cloudflare Workers (OpenNext).

**Key strengths:** Backend is well-structured with proper service layer, Serializable transactions, audit logging, and PostgreSQL exclusion constraints for conflict prevention.

---

### 2. Prisma Schema Overview

**15 models, 9 enums:**

| Model | Purpose |
|-------|---------|
| User | Auth + role (ADMIN/STAFF/STUDENT) |
| Session | HTTP session tokens with expiry |
| Location | Multi-site (Camp Randall, Kohl Center) |
| Asset | Serialized equipment (cameras, lenses) |
| Booking | Unified reservation+checkout record |
| BookingSerializedItem | Links booking ↔ asset |
| BookingBulkItem | Links booking ↔ bulk SKU with quantities |
| AssetAllocation | Time-window tracking with exclusion constraint |
| BulkSku | Bulk inventory (cables, tape) with bin QR |
| BulkStockBalance | Current on-hand qty per location |
| BulkStockMovement | Immutable stock movement ledger |
| ScanEvent | QR scan history (success/fail + device context) |
| ScanSession | Checkout/checkin scanning session state |
| OverrideEvent | Admin overrides for incomplete scans |
| AuditLog | Generic before/after JSON audit trail |

**Enums:** Role, AssetStatus(AVAILABLE/MAINTENANCE/RETIRED), BookingKind(RESERVATION/CHECKOUT), BookingStatus(DRAFT/BOOKED/OPEN/COMPLETED/CANCELLED), AllocationKind, BulkMovementKind, ScanType, ScanPhase, ScanSessionStatus.

**Schema gaps for Phase 1:**
- No `Department` model (needed for Cheqroom import)
- No `Kit`/`Case` model (needed for Cheqroom import)
- No `CalendarSource` / `Event` / `LocationMapping` models (needed for ICS sync)
- No `Notification` model (needed for overdue alerts)
- Asset lacks: `name`, `uwAssetTag`, `consumable`, `primaryScanCode`, `imageUrl`, `warrantyDate`, `residualValue` fields
- No concept of "derived status" — status is a stored enum, not computed from bookings

---

### 3. How Item Status Is Currently Computed

**Status is STORED, not derived.** `Asset.status` is a simple enum field (`AVAILABLE | MAINTENANCE | RETIRED`) set manually during creation/update.

The system does **not** derive "Checked Out" or "Reserved" status from active bookings. Instead:
- Dashboard counts "checked out" items by querying `BookingSerializedItem` where the parent booking is `kind=CHECKOUT, status=OPEN`
- Availability checks query `AssetAllocation` for time-range overlaps
- But the `Asset.status` field itself never changes based on booking state

**Problem:** This means `Asset.status = AVAILABLE` even while the asset is actively checked out. The "truth" about an asset's current state is scattered across multiple queries. This violates the "single source of truth" requirement.

---

### 4. Reservation + Checkout Logic Structure

**Flow:**
1. **Create Reservation** → `Booking(kind=RESERVATION, status=BOOKED)` + `AssetAllocation(kind=RESERVATION)` + `BookingBulkItem`
2. **Update Reservation** → Re-validates availability (with self-exclusion), replaces items
3. **Cancel Reservation** → Sets `CANCELLED`, deactivates allocations
4. **Create Checkout** (from reservation or fresh) → `Booking(kind=CHECKOUT, status=OPEN)` + `AssetAllocation(kind=CHECKOUT)` + deducts bulk stock
5. **Scan Phase (checkout)** → Opens `ScanSession`, records `ScanEvent` per item, enforces hard-stop (all items must be scanned)
6. **Admin Override** → Allows bypassing incomplete scans
7. **Scan Phase (checkin)** → Same scan flow for returns
8. **Complete Checkin** → Sets booking `COMPLETED`, deactivates allocations, returns bulk stock

**Services:** `bookings.ts` (create/update/cancel/complete), `availability.ts` (conflict/shortage checks), `scans.ts` (session/scan/override management).

**All mutations use Serializable transactions.** PostgreSQL exclusion constraint prevents double-booking at DB level as a safety net.

---

### 5. Risks / Architectural Weaknesses

| # | Risk | Severity | Detail |
|---|------|----------|--------|
| 1 | **Status not derived** | HIGH | Asset.status is stored, doesn't reflect checkout/reservation state. Must become computed. |
| 2 | **No mobile navigation** | HIGH | Sidebar disappears on mobile with no hamburger menu. App is unusable on phones. |
| 3 | **No Tailwind** | MEDIUM | 900+ line globals.css file. Phase 1 UI spec requires Tailwind tokens. Hard to iterate on UI. |
| 4 | **Schema gaps** | MEDIUM | Missing Department, Kit/Case, Calendar, Notification models. |
| 5 | **No reusable form components** | MEDIUM | Forms are copy-pasted across 5+ pages with inline styles. |
| 6 | **No data caching** | LOW | Every page fetches on mount with no SWR/react-query. Acceptable for MVP. |
| 7 | **Test coverage minimal** | LOW | Only 1 test file (time.test.ts). Services need unit tests. |
| 8 | **No search implementation** | LOW | Topbar search input is visual-only, no functionality. |
| 9 | **Location filter not wired** | LOW | Sidebar location dropdown exists but doesn't filter page data. |

---

## Refactor Plan

### Step (a): Schema + Derived Status Service

**Schema changes:**
1. Add to `Asset`: `name`, `uwAssetTag`, `consumable`, `primaryScanCode`, `imageUrl`, `warrantyDate`, `residualValue`
2. Add `Department` model (id, name, active)
3. Add `Kit` model (id, name, description, locationId) + `KitMembership` (kitId, assetId)
4. Add `CalendarSource`, `CalendarEvent`, `LocationMapping` models (for ICS sync)
5. Add `Notification` model (userId, type, payload, channel, sentAt, dedupeKey)

**Derived status service:**
- Create `src/lib/services/status.ts` with `deriveAssetStatus(assetId)` and `deriveAssetStatuses(assetIds)`
- Logic: If `Asset.status` is MAINTENANCE/RETIRED → return that. Otherwise check active allocations: if CHECKOUT allocation active → "CHECKED_OUT". If RESERVATION allocation active → "RESERVED". Else → "AVAILABLE".
- Add a `computedStatus` virtual concept (not stored) that all API responses use
- Update dashboard, items list, and item detail to use derived status

**Keep existing:** Booking model, AssetAllocation, all services, all API routes. Extend, don't replace.

### Step (b): Cheqroom Import Wizard
- Add frontend wizard: Upload → Preview → Mapping → Validation → Import → Summary
- Backend: Enhance existing `/api/assets/import` route
- Handle duplicates, auto-create locations/departments, Kit creation

### Step (c): Scan-First Mobile Flows
- Install Tailwind CSS
- Build mobile-first bottom-nav layout
- QR scanning with zxing-js or html5-qrcode
- Quick Checkout: continuous scan → cart → confirm
- Quick Check-in: scan → find open checkout → confirm
- Printable label grid

### Step (d): ICS Calendar Sync
- New models (CalendarSource, CalendarEvent, LocationMapping)
- Background sync job (API route + cron trigger)
- Admin UI for source management + manual sync
- Event detail page with "Reserve gear" / "Checkout to event" CTAs

### Step (e): Overdue Notifications
- New Notification model + notification center page
- Job that scans open checkouts for overdue triggers (4h before, at due, +2h, +24h)
- Email via SMTP (dev: console log)
- Dashboard overdue count widget

### Step (f): Lean Reports
- Equipment utilization report
- Overdue history
- Checkout frequency by user/department

### Step (g): UI Polish Pass
- Liquid Glass inspired design tokens
- Typography: Aeternus Tall headers, Gotham body
- Glass card components, refined color palette
- Consistent empty states, loading skeletons
- Responsive table alternatives for mobile

---

## Implementation Order

- [x] Audit complete
- [ ] **(a)** Schema migration + derived status service + update API responses
- [ ] **(b)** Cheqroom import wizard (upload → preview → import → summary)
- [ ] **(c)** Tailwind + mobile layout + QR scanning + quick checkout/checkin
- [ ] **(d)** ICS calendar sync + event pages
- [ ] **(e)** Notification model + overdue job + notification center
- [ ] **(f)** Lean reports
- [ ] **(g)** UI polish pass (Liquid Glass + typography)
