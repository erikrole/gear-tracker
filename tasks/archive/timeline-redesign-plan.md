# Item/Booking History Timeline Redesign

**Goal**: Bring `ActivityTimeline` up to the GitHub/Linear/Stripe bar: scannable event types, compressed chained diffs, disciplined timestamps, semantic diff colors, raw-entry escape hatch.
**Reference**: user-approved mockup (2026-07-09 session); Cheqroom screenshot as anti-pattern baseline (uniform rows, redundant full timestamps) with one idea worth stealing later (computed lateness context).

## Slices (each independently shippable)

- [x] **S1 — Time discipline**: inside a date group show only `10:59 AM` (tabular-nums); full datetime stays on hover. Coalesced runs show a time range (`4:21–4:24 PM`). Coalesce window now measured against the oldest folded entry so slow runs still fold.
- [x] **S2 — Semantic diff values**: old value = red tint + strikethrough, new value = green tint; URL-ish values render mono, protocol-stripped, truncated; status values keep vocabulary labels.
- [x] **S3 — Chained same-field coalescing**: coalesced runs diffing one visible field render `May 4 → May 8 → May 27` (oldest → newest) with a day delta for date fields, instead of hiding history behind `×N`.
- [x] **S4 — Icon rail**: size-7 event-type icon node (lucide, `ACTION_ICONS` + prefix families) tinted by the `ACTION_COLORS` family, connected by a hairline rail; replaces the avatar as the row anchor. Actor stays as bold text.
- [x] **S5 — Row expand**: chevron on non-linkable rows reveals the raw entry (full timestamp, actor role, entity ids, before/after JSON). Linkable rows navigate to their entity instead. No new data exposure — the API already returns the JSON.

All slices shipped 2026-07-09, verified via unauthenticated scratch route + build.

## Deferred / follow-ups
- Lateness context on check-in rows ("29 minutes late") — needs `endsAt` in the entity join.
- Same booking-title enrichment for `users/[id]/activity`.
- Location in kiosk row sentences if payloads carry it.
