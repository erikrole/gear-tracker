# Audit: web ↔ iOS visual parity — 2026-05-08

**Method.** Code-level token comparison: web (Next.js + shadcn/ui + Tailwind) sources read directly against iOS (SwiftUI) sources for the four high-traffic surfaces — Dashboard, Items, Bookings, Schedule. Auth-gated runtime visual diffing was the original plan but pivoted to code because (a) the dev server is auth-gated and probing seed credentials would be sketchy, (b) drift is much more findable in source than in screenshots (status-token mappings, copy strings, density classes) — screenshots only catch what the data state shows, and (c) the comparison is repeatable in CI as a future automation step.

**Reference.** Per `feedback_ios_little_brother.md`: iOS is the little brother of web — same colors / typography / terminology / hierarchy. Sibling not clone. Power-user surfaces (filter bars, week strip, density toggle, bulk actions) are intentionally web-only by `feedback_ios_vs_web_role.md`. So the parity bar is the *cross-cutting design system*: status tokens, status copy, primary action verbs, badge tones — not feature-by-feature equivalence.

---

## Drifts found

### 1. Trade Board count badge tone — **closed today**

- **Web:** `<Badge variant="orange" size="sm">{count}</Badge>` (`src/app/(app)/schedule/page.tsx:91`).
- **iOS (before):** `Color.accentColor` (Badger red) capsule.
- **Why it matters:** The schedule toolbar is a side-by-side surface in the user's mind — staff use both web and iOS in the same shift. The badge tone is the at-a-glance signal "you have N trade requests waiting"; making it accent-red on iOS conflates it with the brand-emphasis red used elsewhere (favorited star analog, kiosk-completion).
- **Fix shipped:** `Color.statusText(.orange)` background. Cross-app token discipline now matches; `Color.statusText(.orange)` already enforced by R1 elsewhere.
      `ios/Wisconsin/Views/ScheduleView.swift:281`.

### 2. Asset status colors — **already aligned, false alarm**

- **Web** (`src/app/(app)/items/columns.tsx:158-228`): AVAILABLE=green, CHECKED_OUT=blue (red if overdue), RESERVED=purple, MAINTENANCE=orange, RETIRED=gray, bulk "0 Available"=red.
- **iOS** (`AssetListBadge.tone` in `Views/ItemsView.swift`): same mapping — fixed today during the items-list pass when migrating off raw color literals. Overdue-checkout flips to red identically.
- **Verdict:** No drift. The earlier exploration agent misread the web source on this; concrete reading of `statusBadge(asset)` confirms the mapping matches.

### 3. Booking status colors — **already aligned**

- **Web** (`StatusBadge` and friends): pendingPickup=orange, open=blue, booked=blue (checkout) / purple (reservation), completed/cancelled=gray.
- **iOS** (`StatusBadge.tone` in `Views/BookingsView.swift:338-348`): same mapping — closed in today's bookings list pass.
- **Verdict:** No drift.

---

## Deferred drifts (iOS more idiomatic / web more concise — leave alone)

### 4. Stat-strip label casing

- **Web** (`src/components/dashboard/StatCard`): "Overdue", "Due today", "Active checkouts", "Reserved" — sentence case.
- **iOS** (`HomeView.swift:314-320`): "Overdue", "Due Today", "Checked Out", "Reserved" — title case + uses "Checked Out" in place of "Active checkouts".
- **Verdict:** **Keep iOS as-is.** Title-case is the iOS-wide convention (locked in 2026-05-08 with the `String.shiftAreaLabel` extension and 7+ surfaces title-cased). "Checked Out" is also more concrete than the abstract "Active checkouts" — the user thinks in terms of items currently checked out, not the noun "checkouts." If we change anything, web should pull toward iOS, not the other way around.

### 5. Bookings empty-state copy

- **Web** (`src/components/BookingListPage.tsx`): "No bookings yet" / "No bookings match your filters" — generic.
- **iOS** (`BookingsView.swift:120-132`): "No Active Reservations" / "No Active Checkouts" / "No Reservations" / "No Checkouts" / "No Results" — branched on tab + mineOnly + searchText.
- **Verdict:** **Keep iOS as-is, optionally pull web toward iOS.** iOS's branching surfaces what the user is actually filtering — "No Active Reservations" tells you the active filter state; "No bookings yet" doesn't. Web has the same three filter dimensions and could borrow.

### 6. Density toggle (items list)

- **Web** (`src/app/(app)/items/columns.tsx`): density toggle (compact 32px icons + `text-sm` / comfortable 40px + `text-[15px]`).
- **iOS:** single density.
- **Verdict:** **Power-user surface, web-only by `feedback_ios_vs_web_role.md`.** iOS users are doing day-to-day floor ops; density tweaks are a desk-power-user affordance. Skip.

### 7. Pagination pattern

- **Web:** "Showing X–Y of Z" + Previous/Next buttons.
- **iOS:** infinite scroll with sentinel row.
- **Verdict:** **Both are correct for their context.** Touch-scroll is the iOS-native pattern (every list in Apple's stock apps uses infinite scroll); explicit pagination is correct for web's mouse + viewport-anchored model. Skip.

### 8. Schedule view modes

- **Web:** List + Week + Calendar.
- **iOS:** List + Calendar.
- **Verdict:** **Week strip is intentionally web-only**, already documented in `audit-schedule-ios.md` line 91 + `AREA_MOBILE.md`. Skip.

### 9. Welcome banner (first-run dashboard)

- **Web:** Optional welcome banner with monospace label + heading-font title + accent stripe (when staff hasn't shipped a checkout yet).
- **iOS:** Not surfaced.
- **Verdict:** **First-run nudge is web-only, low cost to skip on iOS.** A staff member's first-run is much more likely to be on the web admin surface than mobile (per the user-role memory). Defer; revisit if real users complain.

### 10. Toolbar primary-action verbs

- **Web:** "New checkout", "New reservation" (bookings), "New event" / "Assign shifts" (schedule) — explicit verbs.
- **iOS:** `+` icon (no text label) on bookings + schedule toolbars. VoiceOver labels exist ("New Reservation", "New event", etc.).
- **Verdict:** **Standard iOS pattern.** Toolbar text labels are the wrong density for iOS — no native iOS app does "+ New Booking"; everyone uses an icon. VO accessibility is the formal contract and that's covered.

---

## What this confirms about today's pattern lock-in

The drift detector + `Color.statusText(_:)` / `Color.statusBackground(_:)` token system is doing its job: every status-color-shape drift between web and iOS is now caught in source review, not at parity-audit time. The only real drift this audit found was a single non-status badge tone (Trade Board count) that didn't go through the token machinery because it's a count, not a status — a useful gap to know about.

Token migration coverage as of today:
- Status pills + badges (Items, Bookings, Trade): ✓
- Status text (overdue labels, due-date labels): ✓
- Status backgrounds (banner cards, capsules): ✓
- Calendar dot colors (home/away): ✓
- Bar accents (event row, summary row): ✓
- **Count badges (notif unread, trade-open):** ⚠ — not all in tokens. Today's fix migrates the trade-open badge; notification-unread badge still uses `Color.accentColor` (intentional brand emphasis on the universal bell).

## Lenses checked
- [x] Status colors (parity confirmed)
- [x] Status copy (acceptable divergence)
- [x] Section header / label casing (iOS more idiomatic)
- [x] Empty-state copy (iOS more useful)
- [x] Density / power-user features (intentional split)
- [x] Iconography (Lucide ↔ SF Symbols mapping consistent: `clock`, `exclamationmark.circle.fill`, `calendar`, `arrow.triangle.2.circlepath`, etc.)
- [x] Toolbar action verbs (iOS-native icon-only is correct)

## Files
- Read web: `src/app/(app)/{dashboard,items,bookings,schedule}/page.tsx`, `src/app/(app)/items/columns.tsx`, `src/components/BookingListPage.tsx`, `src/components/dashboard/*`.
- Read iOS: `ios/Wisconsin/Views/{HomeView,ItemsView,BookingsView,ScheduleView}.swift`.
- Modified: `ios/Wisconsin/Views/ScheduleView.swift` (trade-count badge tone).
