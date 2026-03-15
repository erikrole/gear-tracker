# Brief: Student Mobile Hardening V1

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Date: 2026-03-15
- Status: Active
- Decision Ref: D-015 (Student-first mobile operations contract)
- KPIs: Taps-to-checkout ≤3, Scan success ≥95%, Task completion <30s

---

## Problem Statement

Students are the primary mobile users — checking out gear before practice, returning it after games, and checking availability between classes. The current app treats all roles identically on mobile, exposing admin affordances that confuse students and blocking the core scan-to-checkin workflow entirely.

## KPI Targets

| KPI | Target | Current State |
|-----|--------|---------------|
| Taps-to-checkout | ≤3 from dashboard | 2-3 (meets target) |
| Scan success rate | ≥95% first-scan recognition | No telemetry — cannot measure |
| Task completion time | <30s for any workflow | No telemetry — cannot measure |

## Scope (V1 Hardening)

### 1. Unblock Student Scan-to-Checkin (Critical)
- Add STUDENT to `checkout.scan` permission with ownership gating
- Students can only scan items on their own checkouts
- Verify ownership check in scan page and BookingDetailsSheet

### 2. Role-Adaptive Dashboard (High)
- On mobile, students see "My Gear" only (own checkouts + reservations)
- Hide team activity columns for STUDENT role on ≤768px
- Keep "New checkout" / "New reservation" buttons (students can create their own)

### 3. Student Navigation Gating (Medium)
- Hide admin-only sidebar items (Users, Settings, Kits) for STUDENT role
- Bottom nav remains unchanged (Home, Items, Reservations, Checkouts, Scan)

### 4. Visual Ownership Indicators (Medium)
- Add subtle left-border accent on owned bookings in dashboard lists
- Add "Your checkout" badge on detail sheets for owned bookings

## Out of Scope (V1)
- Scan telemetry instrumentation (Phase B — needs event pipeline)
- Task completion timing (Phase B — needs analytics foundation)
- Bottom nav reordering (cosmetic, evaluate after V1 ships)
- Floating scan button (requires UX research)

## Files Changed
1. `src/lib/permissions.ts` — Add STUDENT to scan permission
2. `src/app/(app)/scan/page.tsx` — Ownership check for student scans
3. `src/app/(app)/page.tsx` — Role-adaptive dashboard layout
4. `src/components/Sidebar.tsx` — Hide admin items for students
5. `src/app/globals.css` — Ownership indicator styles

## Acceptance Criteria
- [ ] AC-1: Student can scan QR to check in their own checkout
- [ ] AC-2: Student cannot scan on someone else's checkout
- [ ] AC-3: Student dashboard on mobile shows only "My Gear"
- [ ] AC-4: Student sidebar hides Users, Settings, Kits
- [ ] AC-5: Owned bookings have visual distinction in dashboard lists
- [ ] AC-6: Build passes, no permission regressions

## Risk Assessment
- **Low risk**: Permission change is additive (expanding, not restricting)
- **Ownership gating**: Must be enforced server-side in scan API, not just UI
- **Dashboard change**: CSS-only on mobile, no data model changes
