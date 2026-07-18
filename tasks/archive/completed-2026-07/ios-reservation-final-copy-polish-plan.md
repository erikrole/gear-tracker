# Native Reservation Final Copy Polish - 2026-07-18

## Goal

- Finish the native reservation flow with readable event metadata and no redundant or synthetic title copy.

## Scope

- [x] Event rows use a separate venue line and an abbreviated weekday in the date/time line.
- [x] Review keeps requester identity intact and removes only the routine secondary line from battery gear rows.
- [x] Event-launched reservations use the event title directly and never synthesize `Gear - [event]`.
- [x] Update focused source contracts and reservation/mobile documentation.

## Verification

- [x] Focused reservation source contracts.
- [x] Native iOS contract suite, drift, and gap audit.
- [x] Simulator build and runtime launch inspection.
- [x] Signed build install on Erik's iPhone when connected.
- [x] Documentation verification and `git diff --check`.

## Review

- Shipped: Separate event date and venue lines, abbreviated weekday copy, compact Review battery rows, and direct event titles from Event Detail.
- Verified: 258 native contracts, iOS drift, iOS gap audit, generic simulator build and launch, signed physical-device build and installation on Erik's iPhone, current codemaps, docs verification, and `git diff --check`.
- Blocked: None.
- Stop recommendation: Stop after documentation verification. The reservation-creation flow now matches the accepted product direction.
