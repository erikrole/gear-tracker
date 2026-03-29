# Create Booking Sheet — Implementation Plan

## Goal
Replace inline `CreateBookingCard` with a `CreateBookingSheet` that opens as a right-side Sheet panel with collapsible accordion sections.

## Slices

### Slice 1: CreateBookingSheet skeleton + state migration
- [x] New `CreateBookingSheet.tsx` with Sheet wrapper
- [x] Internal `useReducer` for all form state (replaces 20+ parent useState calls)
- [x] Three collapsible sections: Event, Details, Equipment
- [x] Sticky SheetFooter with Discard/Submit
- [x] Wire into BookingListPage replacing inline CreateBookingCard
- [x] Move create-related state + logic (validation, submission, draft, event fetch) into sheet
- [x] Build passes

### Slice 2: Polish + cleanup
- [ ] Remove CreateBookingCard component
- [ ] Update barrel export
- [ ] Update docs

## Architecture

**Parent (BookingListPage)** passes:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `config: BookingListConfig`
- `users, locations, availableAssets, bulkSkus` (form options, fetched once)
- `onCreated: (bookingId: string) => void`
- `draftId: string | null`

**CreateBookingSheet** owns:
- All form state via useReducer
- Event fetching, shift context fetching
- Draft save on close
- Validation + submission
- Collapsible section state

## Section Summaries (collapsed view)
- **Event**: "vs Illinois — MBB" or "Ad-hoc (no event)"
- **Details**: "Game Day Equip · John Smith · 3/24 2pm – 3/25 4pm"
- **Equipment**: "3 items selected"
