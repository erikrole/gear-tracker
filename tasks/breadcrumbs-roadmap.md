# Breadcrumbs — Versioned Roadmap

**Target**: `PageBreadcrumb` component + breadcrumb integration across all pages
**Created**: 2026-03-25
**Status**: Analysis only — no code changes

---

## Current State Assessment

### What exists today

**Global component** (`src/components/PageBreadcrumb.tsx`, 99 lines):
- Client component that auto-generates breadcrumbs from `usePathname()`
- Hardcoded `LABEL_MAP` with 24 segment→label mappings
- Filters out dynamic segments (UUIDs, CUIDs) so detail pages show parent path only
- Rendered once in `AppShell.tsx` inside `.page-content` above `{children}`
- Uses shadcn `Breadcrumb` primitives with `asChild` + Next.js `Link`

**What works well** (keep in all versions):
- Auto-generation from URL path — zero per-page configuration needed
- Proper accessible markup (`nav`, `ol`, `aria-current="page"`)
- Detail page detection logic (all crumbs become links when on a dynamic route)
- shadcn component foundation already in place

### Known Issues

1. **Double breadcrumb on Settings pages** (P1 in `tasks/todo.md`):
   - `settings/layout.tsx` renders its own `.breadcrumb` div (CSS class, not shadcn) at line 40
   - AppShell also renders `<PageBreadcrumb />` — users see two breadcrumb rows
   - The settings breadcrumb uses legacy `›` separator, not shadcn ChevronRight

2. **Duplicate breadcrumb on Events detail page**:
   - `events/[id]/page.tsx` renders its own shadcn `<Breadcrumb>` (lines 301–311) with "Schedule > {event.summary}"
   - AppShell also renders `<PageBreadcrumb />` showing "Home > Events"
   - Two breadcrumb rows visible on event detail

3. **Duplicate breadcrumb on Items detail page**:
   - `items/[id]/page.tsx` imports and renders `<PageBreadcrumb />` directly (lines 414, 517)
   - AppShell also renders it — potential double rendering

4. **No entity names on detail pages**:
   - Visiting `/items/c12345` shows "Home > Items" — no indication of which item
   - Events detail works around this with its own custom breadcrumb showing event name
   - Users lose context about which entity they're viewing

5. **No mobile truncation**:
   - Long paths (e.g., "Home > Settings > Calendar Sources") can overflow on small screens
   - No ellipsis collapse, no horizontal scroll indicator
   - Responsive gaps exist (`gap-1.5 sm:gap-2.5`) but no width management

6. **Hardcoded label map**:
   - New pages require editing `LABEL_MAP` in `PageBreadcrumb.tsx`
   - Fallback (`formatSegment`) is reasonable but inconsistent with explicit labels
   - No mechanism for pages to provide their own breadcrumb label

### Data available but not surfaced

From schema, detail pages could show:
- **Items**: `assetTag` or `tagName` (tag-first identity per North Star principle 5)
- **Events**: `summary` (already done in custom breadcrumb)
- **Users**: `name`
- **Checkouts/Reservations**: `title`
- **Kits**: `name`

### Role analysis

All three roles (ADMIN, STAFF, STUDENT) see the same breadcrumb. This is correct — breadcrumbs are navigational, not role-gated. No RBAC changes needed.

### Mobile viability

- Breadcrumb text is `text-sm` with muted foreground — readable but not optimized for touch
- No tap target enforcement (separators are decorative, but crumb links may be small)
- Settings double breadcrumb wastes vertical space on mobile
- No horizontal scroll or truncation for deep paths

---

## V1 — Core: Consistent, Correct, No Duplicates

**Principle**: Fix all duplication bugs and establish a single, reliable breadcrumb pattern across the entire app. Every page shows exactly one breadcrumb row, generated consistently.

### Features included

1. **Remove all duplicate breadcrumbs**:
   - Remove custom `.breadcrumb` div from `settings/layout.tsx` (lines 40–48)
   - Remove custom `<Breadcrumb>` from `events/[id]/page.tsx` (lines 301–311)
   - Remove duplicate `<PageBreadcrumb />` from `items/[id]/page.tsx` (lines 414, 517)
   - AppShell's single `<PageBreadcrumb />` is the only breadcrumb source

2. **Add missing segments to LABEL_MAP**:
   - `"venue-mappings"`: "Venue Mappings"
   - `"bookings"`: "Bookings" (if route exists)
   - Audit all `src/app/(app)/` routes and ensure every static segment has a label

3. **Hide on home page** (already works — `segments.length === 0` returns null)

4. **Mobile-safe text truncation**:
   - Add `max-w-[200px] truncate` to `BreadcrumbLink` and `BreadcrumbPage` on mobile
   - Ensure tap targets on breadcrumb links are at least 44px height (add vertical padding)

### What's NOT included yet
- Entity names on detail pages (V2)
- Collapsible/ellipsis breadcrumbs for deep paths (V2)
- Page-provided custom labels (V2)
- Keyboard navigation within breadcrumb (V3)

### shadcn components used
- `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator` (all existing)

### API routes needed
- None — V1 is purely client-side URL parsing

### RBAC
- No changes — breadcrumbs are role-agnostic navigation

### Loading, error, empty states
- **Loading**: Breadcrumb renders immediately from URL (no data fetch) — no loading state needed
- **Error**: Cannot error — pure URL parsing
- **Empty**: Returns null on home page (already implemented)

### Mobile behavior
- Truncate long segment labels with ellipsis
- Minimum 44px touch target height on links
- Single row, horizontal scroll if needed (no wrapping)

### Build order
1. Remove duplicate breadcrumbs from settings layout, events detail, items detail
2. Audit and update `LABEL_MAP` for all routes
3. Add mobile truncation CSS
4. Verify no double breadcrumbs remain (check every `(app)` page)
5. `npm run build` to confirm clean compilation

---

## V2 — Enhanced: Context-Aware Labels + Smart Truncation

**Principle**: Breadcrumbs now show where you are specifically, not just which section. Detail pages display entity names. Deep paths collapse gracefully.

### New features

1. **Entity name resolution on detail pages**:
   - New optional context provider: `BreadcrumbContext` (React context)
   - Detail pages set their entity name: `setBreadcrumbLabel("Canon EOS R5 #A-1042")`
   - `PageBreadcrumb` reads context and appends entity name as final `BreadcrumbPage`
   - Falls back to current behavior (no label) if context not set
   - Follows tag-first identity: items show `assetTag`, not product name

2. **Collapsible breadcrumbs for deep paths**:
   - When path has 4+ crumbs, collapse middle segments into `BreadcrumbEllipsis`
   - Clicking ellipsis expands to show all crumbs (use shadcn `Popover` or inline expand)
   - Mobile: collapse at 3+ crumbs (tighter threshold)

3. **Smarter label resolution**:
   - Replace hardcoded `LABEL_MAP` with a config object that also specifies icons (optional)
   - Add `parentOverride` for cases like events detail → "Schedule" instead of "Events"
   - Support aliased routes (e.g., `/schedule` showing as "Schedule" even though the page is under `/events`)

4. **Cross-page awareness**:
   - When navigating from a specific context (e.g., clicking an item from a checkout detail), preserve the source context in breadcrumb trail
   - Use URL search params (`?from=checkouts/abc123`) to show "Home > Checkouts > #CO-42 > Item Detail" instead of "Home > Items > ..."

### V1 features enhanced
- `LABEL_MAP` → config-driven label registry (enhanced)
- Mobile truncation → collapsible ellipsis (enhanced)
- Detail page display → entity name shown (enhanced)

### V1 features left alone
- Home page hide behavior
- Accessible markup (nav, ol, aria)
- AppShell single-source rendering

### shadcn components used
- All V1 components plus:
- `BreadcrumbEllipsis` (already in `breadcrumb.tsx`, unused until now)
- `Popover`, `PopoverTrigger`, `PopoverContent` (for ellipsis dropdown)

### API routes needed
- None — entity names come from the page's own data fetch, passed via context

### Mobile behavior
- Collapse at 3+ crumbs on screens < 640px
- Ellipsis button is 44px tap target
- Popover opens below breadcrumb showing hidden segments
- Entity name truncated to 20 characters on mobile

### Dependencies
- Schema: None
- Components: `BreadcrumbContext` provider (new, ~30 lines)
- Pages: Each detail page opts in by calling `setBreadcrumbLabel()` after data loads
- No API changes

### Build order
1. Create `BreadcrumbContext` provider
2. Update `PageBreadcrumb` to consume context + implement collapse logic
3. Wire entity names into detail pages (items, events, users, checkouts, reservations, kits)
4. Add `?from=` context preservation
5. Test on mobile breakpoints
6. `npm run build`

---

## V3 — Advanced: Predictive Navigation + History-Aware Paths

**Principle**: Breadcrumbs become a navigation power tool. They remember where you've been, suggest where to go next, and adapt to your workflow patterns.

### New features

1. **Navigation history trail**:
   - Track recent page visits in session storage
   - Breadcrumb shows actual navigation path, not just URL hierarchy
   - Example: If user went Dashboard → Checkouts → Item Detail, breadcrumb shows that real path
   - Toggle between "hierarchy view" and "history view" via small icon button

2. **Quick-jump dropdown on each crumb**:
   - Hovering/tapping a breadcrumb segment shows siblings at that level
   - Example: Hovering "Settings" shows dropdown with Categories, Sports, Escalation, Calendar, etc.
   - Uses shadcn `DropdownMenu` attached to each `BreadcrumbItem`
   - Reduces clicks to navigate between sibling pages

3. **Keyboard navigation**:
   - `Alt+←` / `Alt+→` to move between breadcrumb levels
   - `Alt+↑` to go to parent (same as clicking the parent crumb)
   - Announced via screen reader for accessibility

4. **Recently visited entities**:
   - The entity-name crumb shows a small dropdown of recently visited entities of the same type
   - Example: On item detail, clicking the entity name shows last 5 visited items
   - Stored in `localStorage`, scoped per entity type

5. **Breadcrumb-level actions**:
   - Right-click / long-press on a crumb to copy its URL
   - "Open in new tab" option
   - "Copy link" option

### Real-time features
- If an entity name changes while viewing (e.g., checkout title updated), breadcrumb updates via the existing context provider

### Integration with other system domains
- Breadcrumb integrates with command palette: pressing `⌘K` while focused on breadcrumb pre-fills the current section as search scope
- Sidebar active state stays in sync with breadcrumb hierarchy

### shadcn components used
- All V2 components plus:
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
- `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem` (right-click)
- `Tooltip` (for keyboard shortcut hints)

### API routes needed
- `GET /api/navigation/siblings?path=/settings` — returns sibling pages at a given level (could be static config instead of API)
- Alternatively: static route map defined in a shared config file (preferred — no API needed)

### Mobile behavior
- Quick-jump dropdown triggered by tap-and-hold (replaces hover)
- History trail accessible via swipe gesture on breadcrumb bar
- Context menu replaced with sheet on mobile (bottom drawer)

### Dependencies
- Schema: None
- Session/local storage for history and recent entities
- Static route map config file (shared between sidebar and breadcrumbs)
- Keyboard event handlers in AppShell

### Build order
1. Build static route map config
2. Implement sibling dropdown on crumbs
3. Add navigation history tracking + toggle
4. Add recently visited entities dropdown
5. Add keyboard shortcuts
6. Add right-click/long-press context menu
7. Mobile adaptations (sheet, tap-hold)
8. `npm run build`

---

## Dependencies Summary

| Version | Schema changes | New components | API routes | Other pages affected |
|---------|---------------|----------------|------------|---------------------|
| V1 | None | None | None | settings/layout, events/[id], items/[id] (remove duplicates) |
| V2 | None | `BreadcrumbContext` (~30 lines) | None | All detail pages (opt-in entity label) |
| V3 | None | Route map config | Optional `/api/navigation/siblings` | AppShell (keyboard handlers), Sidebar (sync) |

---

## Risks

### Scope creep: V1 → V2
- **Risk**: Temptation to add entity names during V1 duplicate removal
- **Defense**: V1 is strictly about removing wrong breadcrumbs, not adding new ones. Entity names require a context provider pattern that deserves its own slice.

### YAGNI in V2
- **`?from=` context preservation**: May add complexity for a rare use case. Only implement if users actually navigate cross-domain (item from checkout, etc.) frequently.
- **Icon in label registry**: Breadcrumbs don't typically need icons. Defer unless there's a strong UX case.

### V3 over-engineering
- **Navigation history trail**: The "history view" toggle adds cognitive complexity. Most users won't use it. Consider cutting.
- **Quick-jump sibling dropdown**: Sidebar already provides this navigation. Duplicating it in breadcrumbs may be redundant — evaluate if sidebar is insufficient first.
- **Keyboard shortcuts**: Low usage probability given the mobile-first user base. Nice for power users but shouldn't block V3 ship.

### Tight coupling
- V2's `BreadcrumbContext` is a clean abstraction — pages opt in, no coupling risk
- V3's route map config could couple sidebar and breadcrumb if not designed carefully. Keep it read-only and declarative.

---

## Build Order Summary

### V1 (1 session)
1. Remove `.breadcrumb` div from `settings/layout.tsx`
2. Remove custom `<Breadcrumb>` from `events/[id]/page.tsx`
3. Remove duplicate `<PageBreadcrumb />` from `items/[id]/page.tsx`
4. Audit and update `LABEL_MAP` for all routes
5. Add mobile truncation + 44px tap targets
6. Build + verify

### V2 (1–2 sessions)
1. Create `BreadcrumbContext` provider
2. Update `PageBreadcrumb` to consume context + collapse logic
3. Wire entity names into 6 detail pages
4. Test mobile collapse thresholds
5. Build + verify

### V3 (2–3 sessions)
1. Static route map config
2. Sibling dropdown navigation
3. History tracking
4. Recently visited entities
5. Keyboard shortcuts + context menu
6. Mobile adaptations
7. Build + verify
