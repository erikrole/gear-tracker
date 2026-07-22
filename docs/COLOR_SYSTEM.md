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

> **Deadline overlay:** an `OPEN` checkout goes orange on the day it is due, then red once it is past due. This is the only sanctioned departure from the table, and it applies to urgency-ranked surfaces (iOS Home's stat strip and Next Up rows, via `queueGearTone`). Elsewhere `OPEN` stays blue and the due date carries the deadline on its own.

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

> **Note:** Green here does not mean "available" — it means "home game." Do not use red for Away — red is reserved for overdue/error states.

> **Which vocabulary a row speaks:** location colors belong to event rows, booking status colors to gear rows. Where the two are separated by surface, that is self-evident. Where they are interleaved — iOS Home's Next Up list, which is ordered by time and mixes shifts with gear — the row's leading glyph declares the domain: `calendar` means read it as location, `shippingbox.fill` means read it as booking status. Any future surface that interleaves the domains must carry the same glyph distinction; without it, green is ambiguous between "home game" and "available."

### Guide callouts (Resources reader)

GitHub-style alert callouts in the Markdown guide reader. This is an **editorial
emphasis** domain (author intent inside prose), not gear/booking status, so it has
its own palette. Each accent drives the border, header text, and a tinted background
(`color-mix` of the accent into `--card`). Defined as `--callout-accent` on
`.guide-alert-<type>` in `globals.css`.

| Callout | Accent (light) | Accent (dark) | Meaning |
|---------|----------------|---------------|---------|
| Note | `oklch(0.540 0.210 262.881)` | `oklch(0.710 0.140 254.624)` | Neutral context / FYI |
| Tip | `oklch(0.520 0.140 149.214)` | `oklch(0.800 0.175 151.711)` | Helpful best practice |
| Important | `oklch(0.540 0.238 293.009)` | `oklch(0.710 0.155 293.541)` | Do-not-miss requirement |
| Warning | `oklch(0.540 0.124 58.318)` | `oklch(0.835 0.160 84.429)` | Proceed with caution |
| Caution | `oklch(0.540 0.200 27.325)` | `oklch(0.710 0.160 22.216)` | Risk of damage / data loss |

> **Note:** Caution red here is scoped to in-prose author warnings inside a titled
> callout card; it never appears on gear/booking rows, so it does not collide with the
> overdue/error red reserved for status. Callout accents and their 8% tinted card
> backgrounds mix in OKLCH. `tests/guide-callout-color-contrast.test.ts` enforces
> sRGB gamut and 4.5:1 header contrast in both themes.

### Checkout activity heatmap

The Reports checkout heatmap uses a single-hue blue scale because its cells represent
actual custody activity. Green remains reserved for available or free gear. The shared
heatmap component interpolates in OKLCH and accepts custom CSS colors when another
domain needs a different scale.

| Token | Light theme | Dark theme | Role |
|-------|-------------|------------|------|
| `--heatmap-zero` | `oklch(0.940 0.008 260)` | `oklch(0.240 0.008 260)` | No activity, intentionally quiet |
| `--heatmap-1` | `oklch(0.620 0.140 260)` | `oklch(0.620 0.140 260)` | Lowest active intensity |
| `--heatmap-2` | `oklch(0.580 0.157 260)` | `oklch(0.660 0.123 260)` | Low activity |
| `--heatmap-3` | `oklch(0.540 0.150 260)` | `oklch(0.700 0.107 260)` | Medium activity |
| `--heatmap-4` | `oklch(0.500 0.139 260)` | `oklch(0.740 0.091 260)` | High activity |
| `--heatmap-5` | `oklch(0.460 0.128 260)` | `oklch(0.780 0.076 260)` | Highest activity |

Active heatmap steps maintain at least 3:1 contrast against supported report surfaces
in both themes. The zero cell is excluded because its job is to recede and communicate
the absence of activity.

---

## Web tokens

All semantic badge colors use the two-token pattern: background tint + foreground text.

CSS variables in `globals.css` contain complete colors, not raw HSL channel lists.
Use them directly as `var(--token)`. When a shadow, border, or overlay needs alpha,
use `color-mix(in oklch, var(--token) N%, transparent)`. Do not wrap tokens in
`hsl(var(--token))`; that produces invalid CSS for hex and OKLCH token values.

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
| green | `#f0fdf4` | `oklch(0.520 0.140 149.214)` |
| blue | `#eff6ff` | `#2563eb` |
| purple | `#f5f3ff` | `#7c3aed` |
| red | `#fef2f2` | `oklch(0.540 0.211 27.325)` |
| orange | `#fffbeb` | `oklch(0.540 0.124 58.318)` |

### Dark mode values

| Token | Background | Text |
|-------|-----------|------|
| green | `rgba(34,197,94,0.12)` | `#4ade80` |
| blue | `rgba(59,130,246,0.12)` | `#60a5fa` |
| purple | `rgba(124,58,237,0.12)` | `#a78bfa` |
| red | `rgba(239,68,68,0.12)` | `#f87171` |
| orange | `rgba(245,158,11,0.12)` | `#fbbf24` |

### Report chart colors

Reports use shared chart roles instead of route-local color literals. Semantic
charts preserve operational meaning, while unrelated categorical breakdowns use
an eight-color OKLCH palette with equal lightness and matched relative chroma.
Light and dark themes keep the same hues but use different lightness values for
graphical contrast.

| Chart role | Token | Meaning |
|------------|-------|---------|
| Active | `var(--chart-1)` | Checked out, active use, checkout trends |
| Available | `var(--chart-2)` | Available inventory, successful scans |
| Reserved | `var(--chart-3)` | Reserved or claimed inventory |
| Waiting | `var(--chart-4)` | Pending pickup and maintenance |
| Problem | `var(--chart-5)` | Overdue and failed scans |
| Neutral | `var(--text-muted)` | Retired or unknown states |

`--report-chart-1` through `--report-chart-8` provide the categorical sequence.
`--report-overdue-1` through `--report-overdue-10` form a fixed red ramp at hue
`27.325`; only lightness and gamut-safe chroma change. Report source files must
not introduce `hsl()` or `hsla()` literals.

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
| green | 4.9:1 | ~8:1 | ✅ |
| blue | 4.7:1 | ~8:1 | ✅ |
| purple | 5.2:1 | ~7:1 | ✅ |
| red | 5.2:1 | ~7:1 | ✅ |
| orange | 5.1:1 | ~8:1 | ✅ |

Light-mode green, orange, and red foregrounds use gamut-safe OKLCH values so
contrast is repaired through perceptual lightness without changing their semantic
hues. `tests/status-color-contrast.test.ts` enforces the 4.5:1 minimum for every
semantic badge pair in both themes.

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
