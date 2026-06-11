# Checkout/Booking Detail Visual Refresh + Two Bug Fixes

## Context

The checkout quick-view sheet (`BookingDetailsSheet`) and the full checkout/reservation detail page (`BookingDetailPage` + tabs) still use an older visual language (red-bar uppercase section heads, fixed `border-border/40`, no motion), while the booking creation wizard (`src/components/booking-wizard/`) has the newer, polished style. User wants these screens brought in line with the wizard. Both components are shared, so the refresh applies to checkouts AND reservations (confirmed with user). The sheet stays a compact summary (no structural parity changes).

While reviewing screenshots, two real bugs were confirmed in code and are in scope (user confirmed):

1. **Duplicate "created booking" audit entries.** `createBooking()` already writes an audit entry (`action: "created"`) inside its transaction at `src/lib/services/bookings-lifecycle.ts:297-313`. The create routes then log a second entry (`action: "create"`): `src/app/api/checkouts/route.ts:122-129` and `src/app/api/reservations/route.ts:95-102`. `actionLabels` in `src/components/booking-details/helpers.ts:64-65` maps both to "created booking", so every new booking shows the line twice.
2. **Bulk item shows "Qty: 0" + green "Returned" on a pending-pickup checkout.** `BookingItem.checkedOutQuantity` is `Int @default(0)` (never null, `prisma/schema.prisma:416`). In `BulkRow` (`src/app/(app)/bookings/BookingEquipmentTab.tsx:452-456`), `outQty = item.checkedOutQuantity ?? item.plannedQuantity` evaluates to `0`, and `allReturned = isCheckout && inQty >= outQty` → `0 >= 0` → true. The return-progress sum at line 114 has the same dead `??` fallback. The sheet (`BookingItems.tsx`) computes correctly, hence the inconsistency.

## Slices (each independently committable, conventional commits)

### Slice 1 — `fix:` duplicate booking-created audit entries
- Delete the route-level `createAuditEntry` calls after `createBooking()`:
  - `src/app/api/checkouts/route.ts:122-129`
  - `src/app/api/reservations/route.ts:95-102`
- Keep the in-transaction entry in `bookings-lifecycle.ts` (atomic, richer `after` payload). Keep the convert route's `action: "convert"` entry (different semantic, logged against the source reservation).
- Existing duplicate rows in the DB stay; optional one-off cleanup SQL can delete `action = 'create'` audit rows that have a matching `action = 'created'` row for the same entity within a few seconds — propose only, run only if user wants.

### Slice 2 — `fix:` bulk quantity/returned state on not-yet-picked-up checkouts
In `src/app/(app)/bookings/BookingEquipmentTab.tsx`:
- `BulkRow` (line 452-456): `const outQty = item.checkedOutQuantity > 0 ? item.checkedOutQuantity : item.plannedQuantity;` and `const allReturned = isCheckout && item.checkedOutQuantity > 0 && inQty >= outQty;` — a row is only "Returned" if something was actually checked out.
- Return-progress denominator (line ~114): same `> 0 ? :` treatment so a pending-pickup booking doesn't show a 0/0 progress state.
- Note (not in scope, flag as background task): the same dead `?? plannedQuantity` pattern on a non-nullable field exists in `src/lib/services/bookings-checkin.ts` (lines 43, 132, 288, 415, 487) — service-side behavior for bulk lines with `checkedOutQuantity = 0` should be audited separately.

### Slice 3 — `feat:` visual refresh of the detail page (checkouts + reservations)
Files: `src/app/(app)/bookings/BookingDetailPage.tsx`, `BookingInfoTab.tsx`, `BookingEquipmentTab.tsx`, `BookingHistoryTab.tsx`.

Adopt the wizard language (catalogued from `booking-wizard/WizardStep*.tsx`):
- **Cards**: `rounded-xl border-border/50 shadow-xs` instead of flat `border-border/40`; dashed borders for empty states.
- **Section headers**: inline `font-semibold tracking-tight` heading + count `Badge` (wizard pattern), consistent with WizardStep2's heading + status badges row.
- **Spacing scale**: `gap-8` between sections, `gap-3` subsections, `gap-1.5` label/content pairs; align `InfoRow`-style label typography (`text-sm font-medium` content, muted `text-xs` labels) with wizard fields.
- **Buttons**: keep existing hierarchy (Actions dropdown / outline / primary CTA) but normalize sizes/variants to wizard usage (`secondary` chips, outline secondary actions).
- **Motion**: page already wrapped in `FadeUp`; add `StaggerList`/`FadeUp` from `src/components/ui/motion.tsx` only where cheap (equipment list, history expand) — no layout-shifting animation.
- Keep all behavior (inline title edit, extend panel, keyboard shortcut, countdown badges) unchanged — styling only.

### Slice 4 — `feat:` visual refresh of the quick-view sheet + shared booking-details components
Files: `src/components/BookingDetailsSheet.tsx`, `src/components/booking-details/BookingOverview.tsx`, `BookingItems.tsx`, `InlineDateField.tsx`.
- Replace `SectionHead` (sheet lines 82-100: red bar + 11px uppercase + `bg-muted/20` band) with the wizard-style inline header + count badge; drop the full-bleed `border-y` bands in favor of card-grouped sections matching Slice 3.
- `BookingOverview` `InfoRow` and `BookingItems` rows: same border/spacing/typography normalization as Slice 3 so sheet and page read as one system.
- Sheet remains a compact summary: same sections (details, equipment, history), same footer actions ("Edit", "Cancel", "Open full booking").
- Do NOT migrate rows to the `Item` primitives in this pass (exists at `src/components/ui/item.tsx`, currently unused anywhere) — restyle in place; note Item migration as follow-up tech debt.

### Slice 5 — verification + doc sync (folded into each commit per rule 12)
- Update relevant `docs/AREA_*` change logs, `docs/GAPS_AND_RISKS.md` if applicable, `tasks/lessons.md` (the `?? on non-nullable Int` pattern is lesson-worthy).
- Copy this plan to `tasks/booking-detail-refresh-plan.md`; archive when shipped.

## Verification
- `npm run build` after every slice (non-negotiable per CLAUDE.md).
- Existing tests: `npx vitest run tests/booking-create-ux.test.ts` plus the shadcn contract tests (`tests/shadcn-*.test.ts`) which may assert on these surfaces.
- Bug 1: create a checkout via the running app (preview server), confirm exactly one "created booking" history entry on sheet + page.
- Bug 2: open CO-0040 (or any pending-pickup checkout with a bulk line) on the detail page — battery shows "Qty: 1 each", no Returned badge, progress not 0/0.
- Visual: preview screenshots of sheet + detail page (light/dark) compared against the wizard; share before/after with the user.
- Run `/color-audit` style spot-check on the refreshed surfaces if anything looks off.

## Commit/push
Commit per slice with conventional messages (fix root cause in message body), push to `main` at the end per standing user preference.
