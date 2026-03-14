# Dark Mode + Interactive States Plan

## Summary
Add dark mode support and hover/focus states for inline-editable fields and other interactive elements.

## Approach
The codebase already uses CSS custom properties (`--bg`, `--panel`, `--text`, etc.) everywhere. Dark mode is a single `@media (prefers-color-scheme: dark)` block that redefines these variables — no component changes needed for color theming.

### Slice 1: Hover/Focus States for Inline-Edit Classes
**Why first**: Quick win, no architectural decisions, immediately visible improvement.

- [ ] `.inline-edit-input:focus` — border-color accent + focus ring
- [ ] `.inline-edit-select:focus` — same treatment
- [ ] `.editable-display.can-edit:hover` — subtle background highlight
- [ ] `.inline-edit-input:hover`, `.inline-edit-select:hover` — border darken on hover

### Slice 2: Dark Mode Variables
Add `@media (prefers-color-scheme: dark)` block in `:root` scope redefining:

- [ ] Core surfaces: `--bg`, `--panel`, `--panel-solid`
- [ ] Text: `--text`, `--text-secondary`, `--text-muted`
- [ ] Accent: `--accent`, `--accent-hover`, `--accent-soft`
- [ ] Borders: `--border`, `--border-light`
- [ ] Status color backgrounds: `--green-bg`, `--orange-bg`, `--red-bg`, `--purple-bg`
- [ ] Shadows: `--shadow-sm`, `--shadow`, `--shadow-glass` (reduce opacity or use darker tones)
- [ ] Focus ring: `--focus-ring` (swap inner ring color)
- [ ] Wisconsin brand: `--wi-red`, `--wi-dark` (verify contrast)
- [ ] `color-scheme: dark` for native form elements
- [ ] Sidebar: already dark, minimal changes (may brighten slightly or leave as-is)

### Slice 3: Component-Specific Dark Overrides
Scan for any hardcoded colors in CSS that bypass variables:

- [ ] Check for literal hex/rgb values in globals.css that need dark variants
- [ ] Calendar legend swatches, status badges, toast backgrounds
- [ ] Modal/sheet overlays and backdrops
- [ ] Form inputs (`.form-input`, `.form-select`) background colors

### Slice 4: Theme Toggle (Optional — Decision Needed)
Two options:
1. **System preference only** — zero JS, pure CSS media query. Simplest.
2. **Manual toggle** — class-based (`.dark` on `<html>`), requires a small React context + localStorage persistence + toggle UI in sidebar/topbar.

**Recommendation**: Start with system preference only. Add toggle later if users want to override.

## Verification
- [ ] `npm run build` passes
- [ ] Visual check: light mode unchanged
- [ ] Visual check: dark mode (set OS/browser to dark)
- [ ] Hover/focus states visible on inline-edit fields
- [ ] No hardcoded colors breaking in dark mode
