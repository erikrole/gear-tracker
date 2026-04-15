<!-- Generated: 2026-04-14 | Files scanned: 142 | Token estimate: ~700 -->
# Frontend Architecture — gear-tracker

## Page Tree (src/app/)

### Auth Pages
```
/login/               Login form
/register/            Registration (allowlist-gated)
/forgot-password/     Password reset request
/reset-password/      Reset confirmation
```

### Main App (src/app/(app)/)
```
/                     Dashboard (redirect or overview)
/dashboard/           Analytics dashboard
/items/               Asset list
/items/[id]/          Asset detail + activity
/scan/                QR/barcode scan interface
/checkouts/           Checkout list
/checkouts/new/       Create checkout wizard
/checkouts/[id]/      Checkout detail + scan session
/reservations/        Reservation list
/reservations/new/    Create reservation wizard
/reservations/[id]/   Reservation detail
/bookings/            Unified booking list view
/kits/                Kit list
/kits/[id]/           Kit detail + member management
/schedule/            Shift schedule calendar
/bulk-inventory/      Bulk SKU management
/labels/              QR/barcode label printing
/notifications/       Notification center
/events/              Calendar events list
/events/[id]/         Event detail
/import/              Cheqroom/CSV importer
/search/              Global search
/profile/             User profile
/users/               User management
/users/[id]/          User detail
/reports/             Reports hub
/reports/audit/       Audit log report
/reports/checkouts/   Checkout analytics
/reports/overdue/     Overdue items
/reports/bulk-losses/ Bulk inventory losses
/reports/utilization/ Equipment utilization
/reports/scans/       Scan event log
/settings/            Settings overview
/settings/categories/ Category tree management
/settings/escalation/ Escalation policies
/settings/kiosk-devices/ Kiosk device config
/settings/sports/     Sport configuration
/settings/venue-mappings/ Venue → location mapping
/settings/calendar-sources/ ICS feed management
/settings/bookings/   Booking policies
/settings/allowed-emails/ Registration whitelist
/settings/database/   DB diagnostics
```

### Kiosk (src/app/(kiosk)/)
```
/kiosk/               Kiosk self-service terminal
```

## Layouts
```
src/app/layout.tsx              Root layout (auth provider, fonts)
src/app/(app)/layout.tsx        Shell with sidebar nav (AppShell)
src/app/(app)/settings/layout.tsx  Settings sidebar sub-nav
src/app/(app)/reports/layout.tsx   Reports sidebar sub-nav
src/app/(kiosk)/kiosk/layout.tsx   Kiosk fullscreen layout
```

## Key Components (src/components/)

### Shared/Global
```
AppShell.tsx            Sidebar + top nav wrapper
BookingDetailsSheet.tsx Full-detail sliding sheet for bookings
BookingListPage.tsx     Reusable list with filters + table
EquipmentPicker.tsx     Equipment selection modal/drawer
QrScanner.tsx           Barcode/QR capture via camera
ActivityTimeline.tsx    Audit log / activity feed display
ChooseImageModal.tsx    Image upload + Blob selection
FormCombobox.tsx        Searchable select dropdown
PageBreadcrumb.tsx      Breadcrumb trail
```

### Subdirectories
```
/booking-details/       Sub-panels for BookingDetailsSheet
/booking-list/          List rows, filters, status badges
/booking-wizard/        Multi-step booking creation wizard
/create-booking/        Booking form fields
/equipment-picker/      Item search + selection sub-components
/shift-detail/          Shift detail panels
/ui/                    shadcn/ui atomic components
```

## State Management
- Server state: `@tanstack/react-query` v5 (data fetching, caching, mutations)
- URL state: `src/hooks/use-url-state.ts`
- No global client state store — co-located component state

## Key Hooks (src/hooks/)
```
use-dashboard-data.ts     Dashboard metrics fetch
use-dashboard-filters.ts  Dashboard filter state
use-scan-session.ts       Active scan session (6.6KB)
use-scan-submission.ts    Scan submit + feedback (12.3KB)
use-schedule-data.ts      Schedule fetch + mutations (11.1KB)
useBookingActions.ts      Checkout/checkin actions
useBookingDetail.ts       Booking detail query
use-form-submit.ts        Generic form POST helper
use-fetch.ts              Fetch with error handling
use-mutate.ts             Mutation wrapper
use-url-state.ts          URL search param state
use-mobile.ts             Responsive breakpoint detection
```

## UI Stack
- Tailwind CSS v4 (utility-first)
- shadcn/ui (Radix UI primitives, components in src/components/ui/)
- Framer Motion (`motion`) for animations
- Lucide React for icons
- Recharts for charts/graphs
- react-day-picker for date inputs
- cmdk for command palette
- vaul for drawers
- sonner for toast notifications
- BlockNote for rich text editing
