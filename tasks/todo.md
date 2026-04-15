# Task Queue

Last updated: 2026-04-14

**Current release**: Beta — CalVer versioning adopted.
**Release workflow**: `npm run release` creates CalVer tag + GitHub Release.

---

## Recently Shipped

### Design System Cleanup (2026-04-14)
- [x] **Badge variants** — Removed 4 unused variants (ghost, link, mixed, yellow); consolidated from 13 → 9
- [x] **Typography** — 15 settings page headings migrated from hardcoded `text-[22px]` → `text-2xl` token
- [x] **Legacy CSS** — ~240 lines removed: `ops-row*` (dashboard columns), `possession-card*` (no consumers), `data-table*` (TradeBoard + ShiftConfigTable) all migrated to Tailwind
- [x] **Accent naming** — 3 direct `var(--accent)` usages replaced with `var(--primary)` / `hover:border-primary`
- [x] **Theme toggle** — `.theme-toggle-row` CSS block migrated to inline Tailwind (`data-[state=on]:`, `hover:`) in Sidebar.tsx

### Guides Feature (2026-04-14)
- [x] **Slice 1** — Guide model + migration (0032), service layer (`src/lib/guides.ts`), 5 API routes with auth + audit logging
- [x] **Slice 2** — `/guides` list page (category chips, search, card grid), `/guides/[slug]` BlockNote reader, sidebar nav entry
- [x] **Slice 3** — `/guides/new` create page, `/guides/[slug]/edit` edit page (publish toggle, admin delete with AlertDialog)
- [x] **Doc sync** — `AREA_GUIDES.md` created, `guides-plan.md` archived

### Kiosk Mode — Full Flow (2026-04-14)
- [x] **Verified all 12 kiosk API routes** — all use `withKiosk`, correct auth on all mutations
- [x] **Confirmed `source: "KIOSK"`** on checkout/complete and checkin/complete audit entries
- [x] **Confirmed 5-min inactivity timer** in KioskShell
- [x] **Updated AREA_KIOSK.md** — all 11 ACs marked complete, full implementation documented
- [x] **Archived `tasks/kiosk-plan.md`** → `tasks/archive/`

### Scan Flow Hardening (2026-04-09)
- [x] **Stress test** — 4 issues found, 4 fixed: scanValue normalization, bulk bin case-insensitive match, cross-booking numbered bulk unit integrity, completeCheckinScan status guard
- [x] **Harden pass** — 6 fixes across 4 files: Badge components, dark-mode color consistency, finally blocks on both hooks, Page Visibility refresh, camera error UX

### Booking Flow Overhaul (2026-04-09)
- [x] **Multi-step wizard** — `/checkouts/new` and `/reservations/new` replace `CreateBookingSheet`. 3 steps: Context & Details → Equipment → Confirmation.
- [x] **BookingDetailsSheet Equipment tab** — 3rd tab with unreturned badge count, scan-to-return (inline camera, local QR lookup, audio/haptic), full EquipmentPicker in edit mode.
- [x] **Thumbnails everywhere** — `<AssetImage size={36}>` on all equipment rows. Bulk qty stepper capped at max, 44px touch targets.
- [x] **Stress test** — 12 issues found, 8 fixed (broken redirect URL, stale scan state, date validation, audit log deps, draft save await, form-options error state).
- [x] **Cleanup** — `CreateBookingSheet` and `BookingEquipmentEditor` deleted. Dashboard wired to wizard navigation.

---

## Open Items

### Reservations (P2)
- [x] ~~**Resolve equipment conflict badges**~~ (AC-8) — Already implemented in `BookingEquipmentTab.tsx:53-106`. Fetches conflicts for BOOKED/DRAFT bookings. Verified 2026-04-06.

### Users (P2)
- [x] ~~**Add sport/area assignment CRUD**~~ — Shipped 2026-03-28 (GAP-23). Popover multi-select in UserInfoTab.
- [x] ~~**Session-level active enforcement**~~ — Shipped 2026-04-06. `requireAuth()` checks `user.active` + deactivation deletes sessions.

### Known Bugs (documented with proof tests)
- [x] ~~**Fix `claimTrade()` missing isolation**~~ — Fixed 2026-03-30: SERIALIZABLE added to all shift-trades.ts + shift-assignments.ts transactions.
- [x] ~~**Fix bulk scan TOCTOU**~~ — Fixed 2026-03-30: Quantity guard moved inside SERIALIZABLE transaction.
- [x] ~~**Fix `markCheckoutCompleted` double-return**~~ — Fixed 2026-03-30: Now subtracts `checkedInQuantity` from return amount.
- [x] ~~**Fix CSRF bypass with missing Origin**~~ — Fixed 2026-03-30: Origin header required on all mutating requests (cron exempted via Bearer auth).

---

## Scan Flow — Low Priority (from 2026-04-09 stress test)
- [x] ~~**Admin override detail logging**~~ — Shipped 2026-04-14: `createAdminOverride` now queries the active scan session, calls `buildScanCompletionState`, and stores `bypassed.missingSerialized`, `bypassed.missingBulk`, `bypassed.missingUnits`, and `bypassed.phase` in the `details` field of both the `OverrideEvent` and the audit entry.
- [ ] **Server-side rate limiting on scan endpoints** — `/api/checkouts/[id]/scan` and `/checkin-scan` have no per-session rate limit. Client-side 1s debounce is the only guard. Migrate to Upstash KV rate limiter when user base grows (tracked in GAP-32).
- [x] ~~**Device context never sent from client**~~ — Shipped 2026-04-14: `use-scan-submission.ts` now sends `deviceContext: navigator.userAgent` on all scan POST requests (both `submitScan` and the numbered-bulk inline fetch).

---

## Phase B Backlog (needs briefs before implementation)

- [ ] **Shift email notifications** — V1 = in-app only
- [ ] **Student availability tracking** — Declare unavailable dates
- [ ] **Date range grouping** — Connected From/To on booking detail (deferred from Round 3)
- [ ] **Game-Day Readiness Score** — Aggregate metric per event (deferred from scheduling Slice 5)

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
