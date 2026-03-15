# Unify Booking List Pages

## Problem
`checkouts/page.tsx` (1154 lines) and `reservations/page.tsx` (1131 lines) are ~95% identical.
Total: ~2,285 lines of near-duplicate code.

## Strategy
Extract a shared `BookingListPage` component driven by a config object.
Each page becomes a thin ~40-line wrapper that passes config.

## Config-Driven Divergence Points

| Aspect | Checkout Config | Reservation Config |
|--------|----------------|-------------------|
| `kind` | `"CHECKOUT"` | `"RESERVATION"` |
| `apiBase` | `/api/checkouts` | `/api/reservations` |
| `label` / `labelPlural` | `"checkout"` / `"Check-outs"` | `"reservation"` / `"Reservations"` |
| `statusBadge` | no BOOKED | includes BOOKED (blue) |
| `defaultTieToEvent` | `true` | `false` |
| `sportFilter` | `true` | `false` |
| `overdueStatus` | `"OPEN"` | `"BOOKED"` |
| `statusOptions` | implicit | explicit (Draft/Booked/Completed/Cancelled) |
| `getAllowedActions` | `getAllowedActionsClient` | `getAllowedReservationActionsClient` |
| `contextMenuExtras` | checkin + cancel | convert + cancel |

## Implementation Steps

- [x] 1. Create `src/components/BookingListPage.tsx` with config type and shared component (975 lines)
- [x] 2. Move all shared logic (state, reload, create form, equipment picker, table, pagination)
- [x] 3. Add config-driven render slots for: sport filter, status options, context menu extras
- [x] 4. Slim `checkouts/page.tsx` to thin wrapper (68 lines)
- [x] 5. Slim `reservations/page.tsx` to thin wrapper (110 lines)
- [x] 6. Build passes — verified 2026-03-15
- [x] 7. Already shipped

## Expected Outcome
- ~1,200-line shared component + two ~40-line wrappers ≈ 1,280 lines total
- Net reduction: ~1,000 lines
- Single place to fix bugs / add features that span both booking types
