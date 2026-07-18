# iOS Booking Actions, Edit, and Reservation Setup Plan - 2026-07-17

## Goal

- Make the Bookings tab faster to operate from the list, reduce the mobile editor to the two safe fields users actually need, and bring New Reservation into the same calm native hierarchy as the refreshed list and detail surfaces.

## Route

- Owner area: Mobile Operations
- Secondary areas: Reservation availability and booking ownership
- Ledger: `tasks/archive/completed-2026-07/ios-bookings-actions-edit-reservation-redesign-plan.md`
- Existing references: `tasks/ios-booking-detail-item-alignment-plan.md`, `tasks/archive/completed-2026-07/ios-bookings-surface-polish-plan.md`

## Source Checks

- The server already owns edit, extend, cancel, and transfer-owner policy, including optimistic locking and collaborator restrictions.
- Booking updates already recheck serialized and bulk availability when the return window changes; the native editor needs a visible preflight without weakening the server mutation as the final authority.
- The current native editor exposes notes, pickup time, and location even though the requested phone workflow only needs booking name and return time.
- New Reservation already has a working three-step details, equipment, and confirm flow; this slice changes hierarchy and action placement without changing reservation creation semantics.

## Stop Conditions

- Stop if a list action would need to duplicate a server-only authorization decision that cannot be represented safely from the signed-in role, capability, booking kind, and status.
- Stop if transfer ownership cannot preserve the booking's `updatedAt` optimistic-lock contract.
- Stop if the availability endpoint cannot represent both serialized and bulk equipment for the edited booking window.
- Stop before changing kiosk custody, pickup, return, or equipment mutation behavior.

## Slices

- [x] Add native row context menus for state-appropriate edit, transfer, extend, and reservation cancel actions.
- [x] Hide Bookings search for short unfiltered lists while preserving it during active search and for paginated/long lists.
- [x] Add a shared transfer-owner sheet and API client using the existing form-options people list and optimistic lock.
- [x] Redesign Edit Booking around booking name and return time, with debounced availability feedback and an inline transfer action.
- [x] Refresh New Reservation step hierarchy and primary action placement without changing the existing details, equipment, review, or submit contracts.
- [x] Add focused native source-contract coverage and sync Mobile documentation, audits, and task indexes.

## Verification

- [x] Focused booking action, edit availability, transfer, and reservation setup source contracts.
- [x] Full native iOS source-contract suite.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Xcode simulator build.
- [x] Authenticated runtime proof for short-list search, edit, transfer, and reservation setup. Context-menu composition is covered by focused source contracts; no mutation was submitted during runtime proof.
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`

## Review

- Shipped: lifecycle-aware row menus, short-list search suppression, focused availability-aware editing, inline transfer, and compact three-step reservation setup.
- Verified: 232 native contracts, drift and gap audits, generic simulator build, and authenticated iPhone 17 Pro runtime inspection.
- Deferred: extended status filtering and sorting remain GAP-34.
- Blocked: none.
- Proof artifacts: authenticated iPhone 17 Pro runtime at 456 x 972 showed no search for two loaded checkouts, the focused editor and transfer sheet, and the compact event picker with Who and Where visible on the first reservation screen.
- Next slice or stop: stop. The requested mobile booking workflow refresh is complete.
