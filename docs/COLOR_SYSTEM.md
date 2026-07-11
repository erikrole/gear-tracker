# Color System

> **Source of truth** for status colors, semantic meaning, and token names across web (Next.js) and iOS (SwiftUI).
> Update this doc whenever a status is added, a color is changed, or a new surface is built.

---

## Semantic color rules

These rules take priority over any component-level decision:

1. **Green = available / free.** Never use green for an active checkout — the item is NOT free.
2. **Blue = active use.** Checked out, actively being used, open booking.
3. **Purple = reservation / claimed.** Upcoming reservation, item claimed but not yet out.
4. **Red = urgent / problem.** Overdue, errors, destructive actions. Not for normal "checked out" state.
5. **Orange = warning / waiting.** Pending action, maintenance, approaching deadline.
6. **Gray = inactive / terminal.** Draft, completed, cancelled, retired.

---

## Status color table

### Booking status

| Status | Kind context | Color | Web variant | iOS color | Label (web) | Label (iOS) |
|--------|-------------|-------|-------------|-----------|-------------|-------------|
| DRAFT | — | gray | `gray` | `.gray` | Draft | Draft |
| BOOKED | CHECKOUT | purple | `purple` | `.purple` | Reserved | Reserved |
| BOOKED | RESERVATION | purple | `purple` | `.purple` | Reserved | Reserved |
| PENDING_PICKUP | — | orange | `orange` | `.orange` | Awaiting Pickup | Awaiting Pickup |
| OPEN | CHECKOUT only | blue | `blue` | `.blue` | Checked Out | Checked Out |
| COMPLETED | — | gray | `gray` | `.gray` | Completed | Completed |
| CANCELLED | — | gray + strikethrough | `gray` | `.gray` | Cancelled | Cancelled |
| OVERDUE | derived (not a DB status) | red | `red` | `.red` | Overdue | Overdue |

> **Kind rule:** `BOOKED` is reserved/claimed work and uses purple for both checkout and reservation contexts. `OPEN` is checkout-only so it's always blue.

### Item / asset status

| Status | Color | Web variant | iOS color | Label |
|--------|-------|-------------|-----------|-------|
| AVAILABLE | green | `green` | `.green` | Available |
| CHECKED_OUT (computed) | blue | `blue` | `.blue` | Checked Out |
| RESERVED (computed) | purple | `purple` | `.purple` | Reserved |
| MAINTENANCE | orange | `orange` | `.orange` | In Maintenance |
| RETIRED | gray | `gray` | `.secondary` | Retired |

### Booking kind (icon + tint language)

Used in lists and search results where kind is visible but status may not be the primary signal.

| Kind | Icon (iOS) | Icon (web / Lucide) | Tint color | Background tint |
|------|-----------|---------------------|-----------|-----------------|
| CHECKOUT | `arrow.up.circle` | `ArrowUpCircle` | blue | `blue/10` |
| RESERVATION | `calendar` | `Calendar` | purple | `purple/10` |

### Event location badges (scheduling domain)

These badges appear on event rows in the schedule and dashboard. They are **not** booking/gear status — they indicate game location type. This is a separate semantic domain from the booking status rules above.

| Location | Color | Web variant | Rationale |
|----------|-------|-------------|-----------|
| Home | green | `green` | Familiar/default, no travel burden |
| Away | orange | `orange` | Elevated logistics/travel effort required |
| Neutral | gray | `gray` | Informational only, no directional meaning |

> **Note:** Green here does not mean "available" — it means "home game." The separation is clear because these badges only appear on event rows, never on gear or booking rows. Do not use red for Away — red is reserved for overdue/error states.

### Guide callouts (Resources reader)

GitHub-style alert callouts in the Markdown guide reader. This is an **editorial
emphasis** domain (author intent inside prose), not gear/booking status, so it has
its own palette. Each accent drives the border, header text, and a tinted background
(`color-mix` of the accent into `--card`). Defined as `--callout-accent` on
`.guide-alert-<type>` in `globals.css`.

| Callout | Accent (light) | Accent (dark) | Meaning |
|---------|----------------|---------------|---------|
| Note | `#2563eb` (blue) | `#60a5fa` | Neutral context / FYI |
| Tip | `#16a34a` (green) | `#4ade80` | Helpful best practice |
| Important | `#7c3aed` (violet) | `#a78bfa` | Do-not-miss requirement |
| Warning | `#d97706` (amber) | `#fbbf24` | Proceed with caution |
| Caution | `#dc2626` (red) | `#f87171` | Risk of damage / data loss |

> **Note:** Caution red here is scoped to in-prose author warnings inside a titled
> callout card; it never appears on gear/booking rows, so it does not collide with the
> overdue/error red reserved for status. Verified for light/dark contrast in the slice-1
> browser check.

---

## Web tokens

All semantic badge colors use the two-token pattern: background tint + foreground text.

```
Badge variant → CSS variables
─────────────────────────────────────────────────────────
green   → bg: var(--green-bg)    text: var(--green-text)
blue    → bg: var(--blue-bg)     text: var(--blue-text)
purple  → bg: var(--purple-bg)   text: var(--purple-text)
red     → bg: var(--red-bg)      text: var(--red-text)
orange  → bg: var(--orange-bg)   text: var(--orange-text)
gray    → bg: var(--accent-soft) text: muted-foreground
```

### Light mode values

| Token | Background | Text |
|-------|-----------|------|
| green | `#f0fdf4` | `#16a34a` |
| blue | `#eff6ff` | `#2563eb` |
| purple | `#f5f3ff` | `#7c3aed` |
| red | `#fef2f2` | `#dc2626` |
| orange | `#fffbeb` | `#d97706` |

### Dark mode values

| Token | Background | Text |
|-------|-----------|------|
| green | `rgba(34,197,94,0.12)` | `#4ade80` |
| blue | `rgba(59,130,246,0.12)` | `#60a5fa` |
| purple | `rgba(124,58,237,0.12)` | `#a78bfa` |
| red | `rgba(239,68,68,0.12)` | `#f87171` |
| orange | `rgba(245,158,11,0.12)` | `#fbbf24` |

### List dot colors (`getStatusVisual`)

List rows use CSS variable dot colors, not Badge variants:

| State | Dot color CSS var |
|-------|-----------------|
| BOOKED (checkout) | `var(--purple)` |
| BOOKED (reservation) | `var(--purple)` |
| PENDING_PICKUP | `var(--orange)` |
| OPEN | `var(--blue)` |
| DRAFT | `var(--text-muted)` |
| COMPLETED | `var(--text-muted)` |
| CANCELLED | `var(--text-muted)` |
| OVERDUE | `var(--red)` |

---

## iOS tokens

SwiftUI system colors adapt automatically to light/dark mode.

| Color name | Light approx | Dark approx | Used for |
|-----------|-------------|-------------|---------|
| `.green` | `#34C759` | `#30D158` | Available |
| `.blue` | `#007AFF` | `#0A84FF` | OPEN |
| `.purple` | `#AF52DE` | `#BF5AF2` | BOOKED, Reserved |
| `.orange` | `#FF9500` | `#FF9F0A` | PENDING_PICKUP, Maintenance |
| `.red` | `#FF3B30` | `#FF453A` | Overdue |
| `.gray` | `#8E8E93` | `#8E8E93` | Draft, Completed, Cancelled (terminal states) |

Badge style: `text.background(color.opacity(0.15), in: Capsule()).foregroundStyle(color)`

---

## Settings control tint (iOS)

The app-wide accent is `brandPrimary` (Wisconsin red), but red doubles as the
urgent/destructive semantic color. On settings-style surfaces dense with
interactive controls (toggles, bordered buttons, pickers), a red tint makes
every control read destructive. The Profile/Settings navigation stack therefore
overrides the tint to neutral `.primary` (black in light mode, white in dark) —
mirroring the web, whose interactive accent is neutral `--accent` (`#191919` /
`#ececec`) and whose shadcn switches/buttons are near-black when active.

| Usage | Color | Rationale |
|-------|-------|-----------|
| Toggles, bordered buttons, picker, links in Profile/Settings stack | `.primary` (via `.tint`) | Neutral controls; matches web accent |
| Sign Out | red (via `role: .destructive`) | Genuinely destructive |
| Error text, overdue counts/rows | `statusText(.red)` | Semantic urgent/problem |
| Notifications row icon square (SettingsView) | `.red` solid square, white glyph | Apple Settings convention |

> Brand red remains the accent elsewhere in the app (navigation, hero moments,
> kiosk CTAs). The override is scoped to `ProfileView`'s `NavigationStack`.

---

## Kiosk flow colors (iOS)

The kiosk runs always-dark. Shared tokens live in `ios/Wisconsin/Kiosk/KioskDesign.swift`
(surfaces, strokes, radii, text) and `KioskColors.swift` (`Color.kioskRed` = `#C5050C`,
the brand accent -- deliberately deeper than the app's dark-mode `brandPrimary`).
Status meaning still comes from `Color.statusText(_:)`.

| Usage | Color | Rationale |
|-------|-------|-----------|
| Primary CTAs (Complete Checkout / Confirm Pickup / Complete Return), numpad submit, checkout cart count, activation hero | `kioskRed` | Brand action, not semantic red |
| Scan progress ring + checklist bar -- in progress | blue | Active progress |
| Scan progress ring + checklist bar -- complete | green | Done / success |
| Student-hub pickup action | orange | PENDING_PICKUP = awaiting |
| Student-hub return action | blue (red if overdue) | OPEN = active use; overdue = red |
| Overdue label / icon | red | OVERDUE = red, never orange |
| Scan feedback | green / red / orange | success / error / duplicate-or-already |
| Success screen, completed checkmarks | green | Success |

> `kioskRed` (brand) and `statusText(.red)` (semantic overdue/error) coexist by context:
> red buttons are brand identity; small red labels/icons are semantic. Green is never a
> primary action, and orange -- not green -- signals awaiting pickup.

---

## Web sources of truth

These are the only files that should define status→color mappings. New surfaces must import from these — never define ad-hoc badge colors inline.

| File | Covers |
|------|--------|
| `src/components/booking-details/helpers.ts` → `statusBadgeVariant()` | Booking badges (kind-aware) |
| `src/lib/status-colors.ts` → `statusBadgeVariantEquipment()` | Item/asset badges |
| `src/lib/status-colors.ts` → `statusBadgeVariant()` | Search/scan contexts (no kind available) |
| `src/components/booking-list/types.ts` → `getStatusVisual()` | Booking list dot + label (kind-aware) |

---

## iOS sources of truth

| File | Covers |
|------|--------|
| `ios/Wisconsin/Views/BookingsView.swift` → `StatusBadge` | All booking badges |
| `ios/Wisconsin/Views/ItemsView.swift` → `AssetStatusBadge` | All item/asset badges |

---

## Accessibility targets

Badge text is `text-xs font-semibold` (12px / ~9pt). At this size, WCAG 2.1 AA requires **4.5:1** contrast ratio (small text threshold — 14pt bold / 18pt normal not met).

| Variant | Light contrast (approx) | Dark contrast (approx) | AA pass? |
|---------|------------------------|----------------------|---------|
| green | 3.0:1 | ~8:1 | ⚠️ light borderline |
| blue | 5.9:1 | ~8:1 | ✅ |
| purple | 5.4:1 | ~7:1 | ✅ |
| red | 5.7:1 | ~7:1 | ✅ |
| orange | 3.2:1 | ~8:1 | ⚠️ light borderline |

> **⚠️ Green and orange badges in light mode are borderline for small text.** Acceptable tradeoff for now given the color-meaning pairing, but avoid using these for any text longer than a short label.

### Dark mode requirements
- Every `var(--X-bg)` must switch to a lower-opacity tint in dark mode (already done — see dark mode values above)
- Every `var(--X-text)` must switch to a lighter shade in dark mode (already done)
- iOS system colors handle this automatically

---

## Common failure modes

1. **New status added to Prisma but not handled in color switch** → falls through to default, silently gray with no intent
2. **New UI surface defines badge color inline** instead of importing from source-of-truth files
3. **BOOKED status rendered as blue** → reserved/claimed work reads like active custody instead of a reservation
4. **`kind` not passed to overdue/status helpers** → reservations and checkouts can lose their derived Overdue context
5. **`var(--X)` used in dot color without confirming token exists** in `globals.css`
6. **iOS `BookingStatus.label` used directly** → BOOKED says "Booked" instead of "Reserved"
7. **Green used for active/checked-out state** — violates semantic rule #1
