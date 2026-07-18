# iOS Bookings Surface Polish Plan - 2026-07-17

## Goal

- Make Booking Detail and the Bookings tab share one quiet date, urgency, filtering, action, and empty-state language.

## Route

- Owner area: Mobile Operations
- Ledger: `tasks/ios-bookings-surface-polish-plan.md`
- Existing references: `tasks/ios-booking-detail-item-alignment-plan.md`, `tasks/audit-bookings-ios.md`, `tasks/audit-booking-detail-ios.md`

## Source Checks

- Booking Detail and Booking rows currently own separate relative-date formatters.
- Attention is a third list scope with six extra API reads; overdue and due-today state already remain visible in the All list through rail and timing color.
- The visible freshness footer duplicates pull-to-refresh and is not needed for this user-facing list.
- The whole-list empty state can create a reservation, but an empty Reservations section beside active checkouts has no recovery action.

## Stop Conditions

- Stop if removing Attention would hide records from All rather than only remove a derived filter.
- Stop if Mine cannot remain role-aware and accessible as a native toolbar toggle.
- Stop if the reservation CTA would bypass collaborator capability or reservation-creation gates.

## Slices

- [x] Share relative date formatting and natural countdown punctuation across detail and list.
- [x] Use neutral horizontal handoff arrows and quiet the persistent Extend control.
- [x] Replace Mine/All/Attention segments with a role-aware top-right Mine toggle and remove Attention-only reads.
- [x] Remove visible freshness chrome, compact the navigation header, and remove the redundant overdue badge.
- [x] Add an actionable empty Reservations section when other booking rows remain.
- [x] Update focused contracts, Home routing, audits, and Mobile documentation.

## Verification

- [x] Focused Bookings and Booking Detail source contracts.
- [x] Full native source-contract suite.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Xcode simulator build and authenticated runtime proof.
- [x] `npm run verify:docs`
- [x] `git diff --check`

## Review

- Shipped: Shared relative dates and countdown punctuation; neutral detail arrows; bordered Extend; Mine toolbar toggle; no Attention or freshness chrome; compact header; no duplicate overdue pill; actionable empty Reservations section.
- Verified: 29 focused contracts, 239 full native source contracts, drift audit, gap inventory, Xcode simulator build/run, authenticated iPhone 17 Pro runtime, docs verification, and diff check.
- Deferred: Extended status filtering and sorting remain tracked separately as GAP-34.
- Blocked: None for this slice.
- Proof artifacts: Authenticated iPhone 17 Pro runtime showed `Due today at 3:00 PM`, `Due Monday at 8:30 AM`, the compact toolbar, and the reservation recovery row.
- Next slice or stop: Stop. The requested Booking surface polish is complete.
