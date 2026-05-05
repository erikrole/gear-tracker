# Task Queue

Last updated: 2026-05-05

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

### Camera Attachments (2026-05-05)
- [x] **Attachment model implementation** — Treat camera-tied SD cards/cages/fixed parts as non-bookable item attachments and preserve QR-coded batteries as numbered bulk units. Verified with focused tests, TypeScript, migration-prefix check, and local Next build.

### Derived Bulk Unit QR Scans (2026-05-05)
- [x] **Numbered unit QR scan path** — Let QR values like `94e068d1-7` resolve to the parent numbered bulk SKU and unit #7 without opening the picker. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.

### Bulk Battery Hardening (2026-05-05)
- [x] **Kiosk-scanned numbered batteries** — Treat battery booking as quantity at creation, then bind/return specific numbered units through kiosk unit QR scans. Add low-availability camera-model battery warnings at creation. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.
- [x] **Kiosk battery client and labels** — Include batteries in iOS kiosk pickup/return checklists, block pickup confirm until planned units are scanned, align compatibility rules to the current import snapshot, and improve Brother P-Touch unit labels. Verified with focused tests, TypeScript, migration-prefix check, local Next build, iOS simulator build, and whitespace check.

### Codex Readiness (2026-05-05)
- [x] **Worktree hygiene** — classified untracked Codex/agent files, kept useful project-scoped guidance, and removed tracked local `.DS_Store` noise from future diffs
- [x] **Codex config cleanup** — deduped local hook config and verified no secrets in Codex/agent guidance files
- [x] **Verification gate** — ran migration-prefix check, JSON validation, diff whitespace check, and secret-pattern scan
- [x] **Next optimization plan** — wrote `tasks/react-query-cache-plan.md`; GAP-11 is a cache-key audit follow-up, not a migration

### Review
- Camera Attachments shipped: item detail now uses grouped Attachments, SD card slot labels render for tags such as `MBB 17 IV 1A`, scan lookup shows parent/slot context, and docs lock QR-coded batteries to numbered bulk semantics. `npm run build` stopped at remote Prisma migrate deploy; safer local `npx next build` passed.
- Derived Bulk Unit QR Scans shipped: QR values generated by the numbered bulk QR tab, such as `94e068d1-7`, now submit as one validated numbered unit under the parent SKU without converting batteries into serialized items.
- Bulk Battery Hardening shipped: kiosk pickup/check-in now scans numbered battery unit QRs one by one, lookup resolves unit QRs, checkout creation warns on low compatible battery availability, and camera-battery guidance is no longer a hard gate.
- Kiosk battery client and labels shipped: kiosk detail payloads include battery units in the checklist, pickup confirm blocks unscanned planned battery quantities, the iOS pickup subtitle counts bulk quantities, Brother P-Touch labels emphasize the unit number, and battery reporting is pinned as GAP-37.
- React Query cache migration was already shipped in code and documented in `docs/NORTH_STAR.md`; stale GAP-11 status is reconciled in `docs/GAPS_AND_RISKS.md`.
- Cache Slice 1 shipped: repeated `["me"]` and `["form-options"]` query functions now use shared hooks; `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed.
- Cache Slice 2 shipped: persisted query allowlist is now a tested helper; `tests/query-client.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed.
- Duplicate allocation check converted from scratch task file into `npm run db:check:dupe-allocations`; `node --check scripts/check-dupe-allocations.mjs` and `npm run db:migrate:check` passed.
- Cache Slice 3 shipped: booking list requester/location filter metadata failures now show a retryable alert instead of silently degrading to empty filters.

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

- [x] ~~**Shift email notifications**~~ — Trade lifecycle emails shipped for claimed, completed, approved, and declined trades; broader assignment emails remain out of scope
- [x] ~~**Student availability tracking**~~ — Shipped as recurring weekly unavailability blocks with profile Availability tab and assignment conflict indicators; date-specific exceptions remain optional follow-up
- [x] ~~**Date range grouping**~~ — Already shipped in `BookingInfoTab`: the booking detail "When" field shows connected start/end values with duration. Reconciled 2026-05-05.
- [ ] **Game-Day Readiness Score** — Aggregate metric per event (deferred from scheduling Slice 5)

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)

---

## Wins Sprint (2026-04-30)

- [x] Replace `img` with `next/image` in booking detail condition photos
- [x] Remove silent JSON parse swallowing in booking + scan client flows
- [x] Add missing indexes (`notifications.sent_at`, `override_events.created_at`, `bulk_stock_balances.bulk_sku_id`)
- [x] Run `npm run test` (fails on pre-existing unrelated tests: equipment-guidance, shift-trades, create-booking)
- [x] Run `npm run build` (`npm run build` blocked by Prisma schema engine error against Neon; `npx next build` passes)

### Review
- Shipped low-effort hardening on booking + scan client paths and added missing operational indexes.
- Verification complete for compilation (`npx next build` succeeds). Test suite currently red for unrelated pre-existing failures.
