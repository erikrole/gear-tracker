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

### Gate Scanning to Kiosk Only ✅ Already Shipped (AREA_KIOSK AC-11, AC-13)
- [x] **API enforcement** — `/api/checkouts/[id]/scan` and `/checkin-scan` throw 403 "Checkout scanning must be done at a kiosk". Kiosk routes use `withKiosk()` auth.
- [x] **Remove scan UI from non-kiosk contexts** — Desktop check-in/return flows go through kiosk; BookingDetailsSheet "scan-to-return" is the only scan path outside kiosk and is local-only (no mutation API call).

### Desktop → Kiosk Transfer (Pending Pickup) ✅ Already Shipped (AREA_KIOSK AC-12)
- [x] **New booking status: `PENDING_PICKUP`** — Present in `BookingStatus` enum (`prisma/schema.prisma:31`).
- [x] **"Send to Kiosk" default** — Checkouts are created as `PENDING_PICKUP` by default (`bookings-lifecycle.ts:100`); wizard Step 3 confirms "Gear must be picked up at a kiosk".
- [x] **Kiosk pending pickups screen** — `GET /api/kiosk/student/[userId]` returns pending pickups; `PickupFlow` component handles selection.
- [x] **Transition guard** — `POST /api/kiosk/pickup/[id]/confirm` is the only path to `PENDING_PICKUP → OPEN` (asserts `status === "PENDING_PICKUP"` and uses `withKiosk`).

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
