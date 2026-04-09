# Booking Flow Overhaul Plan

**Status**: All slices shipped + cleanup complete
**Created**: 2026-04-09

---

## What Changed

### Slice A+B — Type fixes, thumbnails, qty cap, touch targets
- `types.ts`: Added `qrCodeValue`/`primaryScanCode` to `SerializedItem.asset`, `imageUrl` to `AvailableAsset`, `"equipment"` to `TabKey`
- `BookingItems.tsx`: Bulk item rows use `<AssetImage>` instead of `<Package>` placeholder
- `BookingEquipmentEditor.tsx`: Thumbnails on all rows, stepper 32px->44px, `onBlur` qty normalization, new `resolveAssetImage`/`resolveSkuImage` props
- `EquipmentPicker.tsx`: 36px `<AssetImage>` thumbnails on section browse rows (was 18px inline `<img>`)

### Wizard Pages — Multi-step booking creation
- **New routes**: `/checkouts/new` and `/reservations/new`
- **New components**: `BookingWizard`, `WizardStep1`, `WizardStep2`, `WizardStep3`
- **Step 1**: Event picker + booking details (title, requester, location, dates, kit)
- **Step 2**: Full `EquipmentPicker` with QR scan, availability checking
- **Step 3**: Confirmation summary with thumbnails, checkout scan notice
- `BookingListPage`: "New checkout/reservation" navigates to wizard page; `CreateBookingSheet` removed
- Deep-link params (`?title=`, `?eventId=`, `?newFor=`, etc.) forwarded to wizard routes

### Slice C — Equipment tab + scan-to-return
- `BookingDetailsSheet`: 3rd "Equipment" tab with unreturned badge count
- **New**: `useCheckinScan` hook — local QR lookup against `serializedItems[].asset.qrCodeValue`, falls back to API
- **New**: `ScanToReturnView` — inline camera with audio/haptic feedback (reuses `QrScanner`)
- Scan-to-return: scan QR -> local lookup -> POST check-in -> success/error feedback -> celebration on all returned

### Slice D — Full EquipmentPicker in edit mode
- Equipment edit mode now renders full `EquipmentPicker` (same as creation flow) — QR scan-to-add, section tabs, availability conflicts
- Removed `BookingEquipmentEditor` from details sheet rendering (file retained for now, can be deleted)
- Cleaned up ~14 unused state variables, resolve functions, and inline picker state from `BookingDetailsSheet`

---

## Files Created
- `src/app/(app)/checkouts/new/page.tsx`
- `src/app/(app)/reservations/new/page.tsx`
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep1.tsx`
- `src/components/booking-wizard/WizardStep2.tsx`
- `src/components/booking-wizard/WizardStep3.tsx`
- `src/components/booking-details/useCheckinScan.ts`
- `src/components/booking-details/ScanToReturnView.tsx`

## Files Deleted
- `src/components/CreateBookingSheet.tsx` — replaced by wizard pages
- `src/components/booking-details/BookingEquipmentEditor.tsx` — replaced by full EquipmentPicker

## Files Modified
- `src/components/BookingDetailsSheet.tsx` (major: Equipment tab, scan-to-return, EquipmentPicker in edit, dead code cleanup)
- `src/components/BookingListPage.tsx` (navigate to wizard pages, remove CreateBookingSheet)
- `src/app/(app)/page.tsx` (dashboard: navigate to wizard instead of opening sheet, remove form-options fetch)
- `src/components/booking-details/types.ts` (QR fields, imageUrl, TabKey)
- `src/components/booking-details/BookingItems.tsx` (bulk thumbnails)
- `src/components/booking-details/index.ts` (export ScanToReturnView, remove BookingEquipmentEditor)
- `src/components/EquipmentPicker.tsx` (36px thumbnails, AssetImage import)
