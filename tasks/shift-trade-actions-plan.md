# Shift Trade Actions from iOS (Event Detail + Schedule)

Goal: post shifts to the Trade Board from where people actually see shifts
(event-detail crew rows, My Shifts), with staff able to post any student
shift, owner notifications, visible on-board indicators, and swipe/long-press
ergonomics.

## Decisions (2026-07-02, with Erik)

- Terminology is **Trade Board** everywhere in new UI ("Post to Trade Board",
  "Remove from Trade Board"). iOS Open Work sheet retitled to "Trade Board";
  web rename deferred (that surface also lists open shifts + pickups).
- Staff/admin may post any **student** assignment; never another staff
  member's. Server-enforced.
- Owner gets a notification when staff posts their shift (need, not polish).
- Trade-state indicator on crew rows = small orange `arrow.left.arrow.right`
  chip (icon, not a cell stroke).
- Premier events: effectively dead in live data (1/239 groups, 0 active
  approval trades). No premier copy in this feature; full concept removal is
  a separate queued cleanup.
- Swipe delete always confirms; no full-swipe destructive execution.

## Slices

- [x] 1 — Server: staff-posts-student-trade
  - `postTrade` accepts actor role; staff/admin may post student-class
    assignments they don't own; audit gains postedFor context
  - Owner notification ("Your Video shift for {event} was posted to the
    Trade Board") through existing notification policy plumbing
  - Vitest coverage (own-shift unchanged, staff-post-student allowed,
    staff-post-staff 403, student-post-others 403, owner notified)
- [ ] 2 — Server: per-assignment trade state in the shift-group payload
  (`activeTrade { id, status }`), so clients can render indicators and
  offer Remove from Trade Board
- [ ] 3 — iOS: crew row context menu gains Post to Trade Board / Remove from
  Trade Board (role-gated), preselected PostTradeSheet variant, trade chip
  indicator on rows, Open Work sheet retitled Trade Board (+ contract tests)
- [ ] 4 — iOS: My Shifts swipe action → Post trade; event-detail crew section
  converts to List for swipe-to-delete (staff) and swipe-to-post (own row),
  with confirms preserved
- [ ] Follow-up (queued separately): remove premier concept end-to-end

## Verification

- Slices 1-2: vitest + `npm run build` before commit
- Slices 3-4: xcodebuild simulator build + full vitest (source contracts)
- 12 known pre-existing test failures excluded (tracked separately)
