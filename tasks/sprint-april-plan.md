# Sprint Plan — April 2026

**Created:** 2026-04-17  
**Status:** Planning

---

## Tier 1 — Bugs (Fix First)

- [ ] **Available-only toggle inverted** — Default should show everything; toggling ON should exclude unavailable items. Currently defaults to `only_available=true` in picker API and client hook. Invert the default.
- [ ] **Availability check flashes + doesn't block** — Conflict check in item picker flickers on selection. Also need to prevent selecting items that are checked out or reserved for the booking's date range.
- [ ] **Post-booking tab bug** — After creating a booking, switching tabs opens a random booking sheet. Likely stale sheet state not cleared on wizard completion.
- [ ] **Battery total not updating** — Adding units to a bulk SKU doesn't update the `totalQuantity` on the detail page (e.g. 52/50 shown after adding 10). DB total isn't being recalculated or the response isn't refreshing.
- [ ] **Summary page list doesn't scroll** — Step 3 of booking wizard, the selected items list is unscrollable.
- [ ] **Booking card ··· overlaps duration** — The `...` action menu in the top-right corner of a booking card covers the booking duration text.
- [ ] **Guides missing light mode** — Guide reader and list page have no light mode styles; broken in light theme.

---

## Tier 2 — UI Polish (Quick Wins)

- [ ] **Full Details link → real button** — In the booking sheet after clicking an active booking, "Full Details" is text with a link icon. Make it a proper `Button` component.
- [ ] **Item picker: selected rows green** — Picked items should have a green checkbox icon and a subtly tinted green row background.
- [ ] **Item picker: unavailable subline** — Show "Held by [Name] · Returns [date]" as a subline under unavailable items so users know who has it and when it's back.
- [ ] **Extend: require confirmation** — The extend action should show a confirmation step before applying.
- [ ] **Extend calendar: click-out saves** — Clicking outside the calendar in the extend dialog should save the selected date and dismiss. Currently only clicking inside the dialog box works.
- [ ] **QR codes: admin only** — Hide QR code display, generation button, and copy/open actions from students and staff. Admin-only. Prevents scanning items without the physical item present.
- [ ] **Remove inline header editing** — Item detail page headers should not be editable inline. Only the fields below are editable.

---

## Tier 3 — Medium Features

- [ ] **Confirm before saving fields** — Item detail page: show save/cancel button pair when a field is dirty. No modal — inline confirmation only. Prevent accidental serial number / asset tag changes.
- [ ] **Item picker subtabs** — Add category subtabs to the picker: Cameras · Lenses · Batteries · Audio · Tripods · Lighting · Other. Map to existing equipment sections.
- [ ] **Overdue visible to all users** — All users (students, staff, admins) see ALL overdue bookings, not just their own. Full accountability view.
- [ ] **Kiosk: show overdue duration** — On the kiosk, display how long a booking has been overdue (e.g. "2h 15m overdue"). Style to visually sync with dashboard overdue indicators.
- [ ] **Guides: table of contents** — Heading-based ToC with jump-to-section links in the guide reader.
- [ ] **Bulk add/remove favorites** — Allow selecting multiple items and toggling favorites in bulk (e.g. checkbox select + star/unstar action).
- [ ] **Photo Mechanic sidebar placeholder** — Add a "Licenses" entry to the sidebar (admin/staff only) linking to a stub page. Placeholder for future license tracking.
- [ ] **Schedule: reformat event rows** — Show event start time before the title. Move call time to the right side. Format: `6:00 PM  SB vs Michigan` on the left, `Call 4:30–9:00 PM` on the right. Remove event end time from the left side.

---

## Tier 4 — Large Features

### Multi-Event Booking
- [ ] **Wizard step 1: multi-event selector** — Allow selecting multiple calendar events when creating a booking. The booking's `endsAt` becomes the last selected event's end time.
- [ ] **API: accept multiple event IDs** — Booking creation payload supports `eventIds: string[]`. Store associations. Display selected events on booking detail.

### Gate Scanning to Kiosk Only
- [ ] **API enforcement** — Scan endpoints (`/api/checkouts/[id]/scan`, `/checkin-scan`, `/checkin-bulk`, complete variants) must reject requests that are not from a kiosk session (`withKiosk` auth). Return 403 with a "Use a kiosk to check in or out" message.
- [ ] **Remove scan UI from non-kiosk contexts** — Hide or disable scan/checkin/checkout buttons on mobile and desktop when user is not at a kiosk. Non-kiosk users can view but not physically check in/out.

### Desktop → Kiosk Transfer (Pending Pickup)
- [ ] **New booking status: `PENDING_PICKUP`** — Add to `BookingStatus` enum. Migration required.
- [ ] **"Send to Kiosk" action** — After creating a checkout on desktop/mobile, user can mark it as `PENDING_PICKUP`. This finalizes equipment selection but defers physical check-out to the kiosk.
- [ ] **Kiosk pending pickups screen** — Kiosk shows all `PENDING_PICKUP` bookings for its location. User finds their booking, confirms, and completes checkout via normal kiosk scan flow.
- [ ] **Transition guard** — `PENDING_PICKUP` → `OPEN` only via kiosk. Cannot be moved back to draft.

### Slack — 24h Shift Reminder
- [ ] **New Slack event: `shift_reminder`** — Add to existing Slack service (research already complete in `slack-integration-research.md`). Fires 24h before shift start time.
- [ ] **Cron job: hourly shift scan** — Vercel cron (or existing notification cron) checks for shifts starting in ~24h and fires reminders if not already sent. Use dedupeKey to prevent double-send.
- [ ] **Settings: add shift_reminder toggle** — Add the new event type to `/settings/slack` UI.

### iCal Shift Subscription
- [ ] **Per-user iCal feed** — `GET /api/calendar/shifts/[token].ics` — returns ICS with all shifts for the user associated with the token. Token stored on `User` model (new field, migration needed).
- [ ] **Token generation** — Button in user profile / settings to generate a subscription URL. Clicking copies the URL.
- [ ] **ICS content** — Each shift becomes a VEVENT: summary = area + sport, dtstart/dtend = shift times, description = call time + location.

---

## Notes

- Start with Tier 1 bugs — they're user-facing breakage
- Tier 4 features each need a BRIEF_ doc before implementation (per Rule 7)
- Gate scanning and Pending Pickup are architecturally linked — implement together
- Slack 24h reminder builds on `slack-integration-research.md` — no new research needed
- Run `npm run build` before each commit
