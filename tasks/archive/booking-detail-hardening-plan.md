# Booking Detail Page — Hardening Pass

Pre-redesign audit. Fix real bugs, wiring issues, and UX problems before the visual overhaul.

---

## 1. API: Extend endpoint returns stale/incomplete data
**File:** `src/app/api/bookings/[id]/extend/route.ts`
**Issues:**
- Returns raw `extendBooking()` result — missing `allowedActions`, `auditLogs`, enriched fields
- Missing `beforeJson` in audit entry (can't show "from X to Y" in history)
- UI gets stale state after extending

**Fix:** Capture before-state, re-fetch enriched detail after extend (match PATCH pattern on `route.ts:72-75`)

## 2. API: Cancel endpoint returns `{ success: true }` instead of enriched data
**File:** `src/app/api/bookings/[id]/cancel/route.ts`
**Issue:** Returns `ok(result)` where result is `{ success: true }`. UI status stays stale until manual reload.

**Fix:** Re-fetch enriched detail after cancel (same pattern as PATCH endpoint)

## 3. Type: AuditEntry.actor must be nullable
**File:** `src/components/booking-details/types.ts:29`
**Issue:** `actor` typed as required `{ id: string; name: string }` but Prisma schema has `actor User?` (nullable FK). Deleted users → null actor → runtime crash in history tab.

**Fix:** Change to `actor: { id: string; name: string } | null`

## 4. API: GET route has unreachable code
**File:** `src/app/api/bookings/[id]/route.ts:17-19`
**Issue:** Conditional `detail.kind === "CHECKOUT" || detail.kind === "RESERVATION"` is always true — kind is an enum with only those two values.

**Fix:** Simplify to `const allowedActions = getAllowedBookingActions(user, detail);`

## 5. UX: Inconsistent error handling across actions
**File:** `src/hooks/useBookingActions.ts`
**Issue:** cancel/convert/duplicate use `toast()` for errors, but extend/checkinItems/checkinBulk/completeCheckin use `setActionError()` (inline banner). Two different error patterns confuse users.

**Fix:** Standardize all actions to use `toast()` for errors. Remove `actionError` state entirely — toasts are non-blocking and consistent.

## 6. UX: Bulk return qty cleared even on error
**File:** `src/app/(app)/bookings/BookingDetailPage.tsx:132-137`
**Issue:** `handleBulkReturn` calls `actions.checkinBulk()` but doesn't check the return value. Then unconditionally clears qty. If the action failed, the user's input is lost.

**Fix:** Only clear qty on success (check return value of `checkinBulk`)

## 7. UX: Extend panel doesn't pre-populate with current end date
**File:** `src/app/(app)/bookings/BookingDetailPage.tsx:94-96`
**Issue:** Extend panel opens with empty date picker. User must re-enter from scratch. Quick-extend buttons help but the DateTimePicker itself starts blank.

**Fix:** Initialize `extendDate` to `booking.endsAt` when panel opens.

## 8. UX: History tab entry.actor null safety
**File:** `src/app/(app)/bookings/BookingHistoryTab.tsx:111`
**Issue:** `entry.actor?.name` uses optional chaining (good) but the fallback "System" may not be the right label — could also be a deleted user.

**Fix:** After fixing type (#3), show "Deleted user" when actor is null and action is user-initiated; keep "System" for system-generated entries.

---

## Out of scope (deferred to redesign)
- Two-column layout, tab removal
- Live countdown clock
- Item thumbnails
- Mobile responsiveness overhaul
- Event/shift/source context (separate feature)
- Promoted action buttons (Edit/Extend/Check-in as standalone)
