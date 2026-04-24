# Sprint Plan — April 2026

**Created:** 2026-04-17  
**Status:** Tiers 1–3 Complete · Tier 4 In Queue

---

## Tier 1 — Bugs ✅ All Done

- [x] **Available-only toggle inverted** — Was already correct (`useState(false)` + `=== "true"` check). No change needed.
- [x] **Availability check flashes + doesn't block** — Added 200ms debounce on the "Checking availability…" indicator. Unavailable items already had `disabled={isUnavailable}`.
- [x] **Post-booking tab bug** — Moved URL `highlight` param ownership to parent `BookingsPage`; passes as prop only to the correct tab so all three BookingListPage mounts don't race on the URL.
- [x] **Battery total not updating** — Wired `onUnitsAdded` optimistic callback from `BulkSkuUnitsTab` → `page.tsx`; increments `onHand` + `availableQuantity` immediately.
- [x] **Summary page list doesn't scroll** — Added `overscroll-contain [touch-action:pan-y]` to the `max-h-[280px] overflow-y-auto` div in `WizardStep3`; overrides `overscroll-behavior-y: none` on body.
- [x] **Booking card ··· overlaps duration** — Changed top-row div from `pr-8` → `pr-10` in `BookingCard.tsx`.
- [x] **Guides missing light mode** — Added lazy `isDark` initializer + MutationObserver + `theme` prop to `BlockNoteView` on all three guide pages.

---

## Tier 2 — UI Polish ✅ All Done

- [x] **Full Details link → real button** — Was already a `Button` component; confirmed pre-implemented.
- [x] **Item picker: selected rows green** — Was already implemented (green background + `CheckCircle2Icon`); confirmed.
- [x] **Item picker: unavailable subline** — Moved holder info from right-side block to subline under brand/model.
- [x] **Extend: require confirmation** — Was already using `confirm()` dialog; confirmed pre-implemented.
- [x] **Extend calendar: click-out saves** — Was already working; confirmed pre-implemented.
- [x] **QR codes: admin only** — Was already gated (`if (currentUserRole !== "ADMIN") return null`); confirmed.
- [x] **Remove inline header editing** — Was already `canEdit={false}` on `InlineTitle`; confirmed.

---

## Tier 3 — Medium Features ✅ All Done

- [x] **Confirm before saving fields** — Was already implemented via `SaveableField` with `isDirty`/`onCommit`/`onCancel` ✓/✗ icon buttons; confirmed.
- [x] **Item picker subtabs** — Was already implemented (`EQUIPMENT_SECTIONS` tabs in `EquipmentPicker`); confirmed.
- [x] **Overdue visible to all users** — Removed `!isStudent &&` guard from dashboard stat strip; all users now see overdue/due-today/active counts.
- [x] **Kiosk: show overdue duration** — Was already implemented (`formatOverdueElapsed`); confirmed.
- [x] **Guides: table of contents** — Was already fully implemented (`extractHeadings` + `TableOfContents` + `IntersectionObserver`); confirmed.
- [x] **Bulk add/remove favorites** — Was already implemented (`useBulkActions` + `BulkActionBar` star/unstar); confirmed.
- [x] **Photo Mechanic sidebar placeholder** — Added "Licenses" nav entry to admin sidebar + stub page at `/licenses`.
- [x] **Schedule: reformat event rows** — Desktop right cell now shows `Call 4:30–9:00 PM` or just end time; removed two-line Call/time format.

---

## Tier 4 — Large Features

> Each of these needs a `BRIEF_` doc before implementation (per Rule 7).

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

- Tier 4 features each need a BRIEF_ doc before implementation (per Rule 7)
- Gate scanning and Pending Pickup are architecturally linked — implement together
- Slack 24h reminder builds on `slack-integration-research.md` — no new research needed
- Run `npm run build` before each commit
