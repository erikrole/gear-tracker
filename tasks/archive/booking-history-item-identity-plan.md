# Booking history item identity plan

## Outcome

Make kiosk-originated booking-history rows name the specific equipment affected,
while preserving a readable fallback for historical audit rows that do not have
item identity data.

## Evidence

- `kiosk_checkout_item_added` currently writes only an asset tag or bulk SKU id
  plus unit number. `ActivityTimeline` therefore renders the generic sentence
  `Added an item at a kiosk`.
- `kiosk_checkin` currently writes returned and total counts only, so its
  generic `Returned gear at a kiosk` sentence cannot identify returned items.
- The shared `ActivityTimeline` is used by booking, item, user, and report
  histories. The display change must work in every consumer.

## Plan

- [x] Add a compact, durable `itemName` audit field to kiosk add/remove writes
  for serialized assets and numbered bulk units.
- [x] Return the exact completed-checkin item identities from the shared kiosk
  check-in service, and persist them in the `kiosk_checkin` audit payload.
- [x] Teach the shared timeline to render natural-language item identity for
  kiosk add, remove, checkout, and return actions, with generic fallbacks for
  historical rows.
- [x] Add focused regression coverage for serialized, numbered-bulk, and
  legacy-payload display paths, plus the kiosk check-in audit contract.
- [x] Update Reservations and Kiosk area documentation, `tasks/todo.md`, and
  the review notes; regenerate codemaps if the shared component map changes.
- [x] Verify focused tests, TypeScript, migration guard, docs, whitespace, and
  app build. Authenticated browser proof is unavailable in the current session.

## Peer patterns checked

- `ItemHistoryTab` and `UserActivityTab` both render the shared
  `ActivityTimeline`, so no route-local presentation fork is appropriate.
- The kiosk edit route already has the item display name in memory for response
  copy; the missing value is only in the audit payload.

## Review

Focused Vitest, TypeScript, migration-prefix guard, codemap/docs verification,
whitespace, and `npm run build:app` passed. The app build retains its unrelated
`BookingEquipmentTab.tsx` exhaustive-deps warning. An authenticated browser
session was not available for runtime proof.
