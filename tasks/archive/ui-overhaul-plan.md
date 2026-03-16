# UI Overhaul: Modern Minimal + Notion-Inspired

## Design Direction

**From:** Liquid glass / frosted iOS aesthetic with dark sidebar, cool grays, indigo accents
**To:** Modern minimal with Notion-inspired warmth — clean, spacious, friendly, soft shadows

### Design Principles
1. **Warm neutrals** — shift from cool gray (#6b7280) to warm gray tones
2. **Subtle depth** — soft shadows instead of glass blur effects (glass removed entirely)
3. **Generous whitespace** — more breathing room in cards, rows, headers
4. **Dark sidebar (#202020)** — sleek dark nav, modern contrast against warm content area
5. **Consistent border-radius** — 8px standard, 12px for cards/modals
6. **Wisconsin red for brand moments only** — #c5050c on logo, active nav, login. Primary buttons use neutral dark (#37352f). Destructive actions use red.
7. **Typography clarity** — tighter scale, clear hierarchy, 15px body for readability
8. **One interaction pattern** — hover states, focus rings, transitions all unified
9. **Tabs stay pill/box style** — clean, modern pill tabs (not underline)
10. **Red = warning/overdue** — overdue banners, danger badges keep bold red treatment

---

## Slice 1: Design Tokens (CSS Variables)

Overhaul the `:root` and `[data-theme="dark"]` variable blocks in `globals.css`:

### Colors
```
--bg: #f8f8f7          (warm off-white, Notion-like)
--panel: #ffffff        (solid white cards, no transparency)
--panel-hover: #fafaf9  (subtle hover lift)
--text: #37352f         (Notion's body text — warm near-black)
--text-secondary: #787774  (warm secondary)
--text-muted: #b4b4b0   (warm muted)
--accent: #37352f       (warm near-black — primary buttons, links)
--accent-hover: #2a2826  (darker hover)
--accent-soft: #f3f2f0   (soft hover background)
--wi-red: #c5050c       (brand red — logo, active nav, login, overdue)
--wi-red-hover: #a00409  (darker red hover)
--wi-red-soft: #fef2f2   (soft red background for active nav, badges)
--border: #e8e7e4       (warm border, Notion-like)
--border-light: #f1f0ed  (very subtle divider)
```

### Sidebar (Dark #202020)
```
--sidebar-bg: #202020
--sidebar-hover: rgba(255, 255, 255, 0.06)
--sidebar-active: rgba(255, 255, 255, 0.10)
--sidebar-text: rgba(255, 255, 255, 0.65)
--sidebar-text-active: #ffffff
--sidebar-accent: #c5050c    (red dot/indicator for active item)
--sidebar-text-secondary: rgba(255, 255, 255, 0.4)
```

### Shadows (No blur)
```
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04)
--shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.03)
--shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.08)
```

### Border Radius
```
--radius-sm: 4px
--radius: 8px
--radius-lg: 12px
```

### Typography
```
--font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
--text-xs: 12px
--text-sm: 13px
--text-base: 14px  (UI default)
--text-md: 15px    (body/reading text)
--text-lg: 16px
--text-xl: 18px
--text-2xl: 24px
--text-3xl: 30px
```

### Dark Mode
```
--bg: #191919         (Notion dark)
--panel: #202020
--panel-hover: #2a2a2a
--text: #e3e2de
--text-secondary: #9b9a97
--text-muted: #6b6b68
--accent: #e3e2de      (warm light — primary buttons invert in dark)
--accent-hover: #ffffff
--accent-soft: rgba(255, 255, 255, 0.08)
--wi-red: #e05258      (lighter red for dark bg brand moments)
--wi-red-hover: #c5050c
--wi-red-soft: rgba(197, 5, 12, 0.15)
--border: #2f2f2f
--border-light: #262626
--sidebar-bg: #171717  (slightly darker than panel in dark mode)
```

### Remove
- `--glass-blur` variable
- `--shadow-glass` variable
- All `backdrop-filter` usage on cards
- `--panel: rgba(255, 255, 255, 0.82)` transparency

---

## Slice 2: Core Component Styles

### Cards
- Remove backdrop-filter blur
- Solid white background
- 1px border (--border), 12px radius
- Shadow: --shadow-sm (subtle)
- Hover: --shadow (slightly more)
- Card header: 16px padding, bottom border divider
- Card body: 20px padding

### Buttons
- `.btn` — white bg, --border border, --text color, 8px radius
- `.btn-primary` — --accent bg (#37352f warm dark), white text, 8px radius
- `.btn-secondary` — transparent bg, --text color, subtle border
- `.btn-danger` — --wi-red bg, white text (destructive actions)
- `.btn-brand` — --wi-red bg, white text (login, brand CTAs)
- `.btn-sm` — smaller padding
- `.btn-ghost` — no border, transparent, hover bg only
- All: 0.12s transition, no translateY on hover (too flashy)
- Hover: darken bg slightly, no shadow lift

### Badges
- Slightly smaller (11px font, 4px 8px padding)
- More muted backgrounds
- Keep color variants but soften them

### Tables
- Header: 12px uppercase, --text-muted color, no bg
- Rows: subtle bottom border only (no alternating)
- Hover: --panel-hover background
- Clean, minimal lines

### Forms
- Input: 1px --border, 8px radius, 36px height, 14px font
- Focus: 2px --accent ring (no indigo)
- Label: 13px, 500 weight, --text-secondary
- Consistent padding across all form elements

### Modals
- Remove scale animation (use subtle fade + slide up)
- Solid background, no glass
- 12px radius
- Centered overlay with darker backdrop (0.5 opacity)

### Toast
- Remove glass effect
- Solid white, subtle shadow
- Left color bar stays

---

## Slice 3: Sidebar & Navigation

### Sidebar
- Dark background (#202020) — sleek, modern, contrasts warm content area
- Nav items: 36px height, 8px radius, muted white text
- Active: white text + subtle white bg (rgba 0.10) + red left accent (2px --wi-red)
- Hover: rgba(255,255,255,0.06) bg
- Section labels: 11px uppercase, muted (rgba 0.4)
- Profile section: avatar + name, clean divider
- Bottom: theme toggle, settings link

### Topbar
- White background, bottom border only (no shadow)
- Search: rounded input, placeholder text
- Icons: 20px, warm gray, hover: darker

### Bottom Nav (Mobile)
- Light background, top border
- Active: --accent color (red)
- No glass effect

---

## Slice 4: Page Layouts & Spacing

### Page Headers
- More vertical spacing (32px top, 24px bottom)
- Title: 24px, 600 weight
- Description/subtitle: 14px, --text-secondary
- Actions: right-aligned, consistent button sizing

### Dashboard
- Stat strip: softer cards, warm colors
- Card grid: 24px gap (more breathing room)
- Ops rows: 12px vertical padding, cleaner dividers

### Detail Pages
- Breadcrumb: smaller, muted
- Details grid: more padding in data lists
- Tabs: clean pill/box style (keep current approach, just refine sizing and colors)

### List Pages
- Filter row: more spacing between chips
- Table: cleaner, minimal
- Pagination: centered, simple

---

## Slice 5: Polish & Consistency Pass

### Hardcoded Colors
- Replace all raw hex values with CSS variables
- Audit every page for inline styles that should be classes
- Ensure dark mode coverage on all new styles

### Animations
- Standardize to 3 durations: 0.1s (micro), 0.2s (normal), 0.35s (entrance)
- Keep: fade-in, scale-in (softened), skeleton shimmer
- Remove: dash-fade-up stagger (too much movement)
- Reduce motion: honor prefers-reduced-motion

### Focus States
- Consistent 2px ring using --accent (#37352f) on all interactive elements
- Replace indigo focus ring (#6366f1) with --accent
- Sidebar focus rings use white/light variant

### Empty States
- More whitespace above/below
- Slightly larger icon + text

### Print Styles
- Clean print output (hide sidebar, nav, actions)

---

## File Change Map

| File | Scope |
|------|-------|
| `src/app/globals.css` | Slices 1-5: full variable + component overhaul |
| `src/components/AppShell.tsx` | Slice 3: sidebar light theme, possibly inline style cleanup |
| `src/components/Sidebar.tsx` | Slice 3: light sidebar styling |
| `src/components/Modal.tsx` | Slice 2: remove glass, adjust animation |
| `src/components/Toast.tsx` | Slice 2: remove glass |
| `src/app/(app)/page.tsx` | Slice 4: dashboard layout refinements |
| `src/app/(app)/items/page.tsx` | Slice 4: list page consistency |
| `src/app/(app)/items/[id]/page.tsx` | Slice 4: detail page spacing |
| All other page files | Slice 5: consistency audit |

## Verification
- [ ] `npm run build` passes after each slice
- [ ] Light mode: warm, spacious, Notion-like
- [ ] Dark mode: consistent dark warm theme
- [ ] Mobile: responsive, clean bottom nav
- [ ] All pages visually consistent
- [ ] No hardcoded colors remaining outside CSS variables
- [ ] Focus states visible and consistent
