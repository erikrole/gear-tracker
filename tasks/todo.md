# Events Page — Upcoming Default & Source Deletion

## Plan

### Problem
Events page loads oldest 50 events (no startDate filter). Calendar appears stale.

### Changes
1. **API default**: When no `startDate` param, default to `startsAt >= now()` so only upcoming events load
2. **Events page**: Pass `startDate` param explicitly as ISO string of current time
3. **Source deletion**: Add `DELETE /api/calendar-sources/[id]` — nullifies linked booking eventIds, then deletes source (cascades events)
4. **Delete UI**: Add delete button per source in the management table
5. **locationIndicator=H**: Confirm the prompt doc already specifies this — no code change needed, just verify

### Open Questions
- None blocking.

### Risks
- Deleting a source cascades to its events, which may leave bookings with null eventId — handled by explicit SET NULL before delete
- Defaulting to "now" means past events aren't visible unless user explicitly requests them — acceptable for the default view

## Tasks
- [ ] Default calendar-events API to upcoming events
- [ ] Update Events page to pass startDate=now
- [ ] Add DELETE endpoint for calendar sources
- [ ] Add delete button to Events page
- [ ] Check locationIndicator=H
- [ ] Add tests
- [ ] Verify build, commit, push
