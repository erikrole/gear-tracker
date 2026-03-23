# Lessons Learned

## Session 2026-02-28

### Patterns
- Always audit before implementing. The stored-vs-derived status issue would have been missed without reading the schema + dashboard query patterns.
- Read ALL prompt files before planning — they contain specific model/field requirements (Department, Kit, CalendarSource, etc.) that affect schema design.

## Session 2026-03-09

### Patterns
- Tasks files go stale fast. After any multi-PR feature completes, immediately archive completed items and reset the active queue — stale unchecked tasks create planning confusion for the next session.
- Planning docs and code can diverge within a single PR cycle. AREA_*.md files must be updated in the same pass as the feature they describe, not deferred.
- NORTH_STAR.md should be the first file in any Claude session for a product-level project. Without it, sessions risk context drift toward implementation details before product direction is clear.
- When a service is fully implemented (e.g., notifications.ts), write the area spec from the code, not the other way around — the code is the source of truth at that point.
- Duplicate JSDoc comments are a common merge artifact. Scan for them in any file touched by multiple PRs.

## Session 2026-03-10

### Patterns
- Tag name (assetTag) is the primary identifier in UW athletics — it's printed on physical items and how staff refer to equipment. The full product name (e.g., "Sony FE 70-200mm f/2.8 GM OSS II") is reference info, not the headline.
- HTML entities like `&hookrightarrow;` don't render in JSX. Use Unicode escape sequences (`\u21AA`) or the literal character (`↪`) instead.
- Sport abbreviations must match the organization's actual codes (MHKY not MHO, WTRACK not WTF). Verify abbreviations with the user rather than guessing.
- When filtering events by date window, filter the start time within the window (`startsAt >= now AND startsAt <= endDate`), not the end time. Filtering `endsAt <= endDate` excludes multi-day events that start in the window but end after it.
- Equipment picker items need computed status (CHECKED_OUT, RESERVED) not just stored status. The form-options API must call `deriveAssetStatuses` to show real-time availability with color dots.

## Session 2026-03-11

### Patterns
- When the user says "match the label style" they mean the **physical label** stuck on the gear — not a generic UI card. Always ask for or reference the physical artifact before designing digital representations.
- Physical asset labels are black-background with white text/QR, split into stacked lines (e.g. "FB FX3 1" → three centered lines). QR code is inverted white-on-black. Aspect ratio ~0.47.
- QR code interactions should be consolidated into a modal: click to enlarge, generate new, paste/type new. Don't scatter QR actions as small buttons below the inline QR — the modal is the single interaction point.
- `activeBooking` in the asset API can be CHECKOUT or RESERVATION kind. UI that checks `kind === "CHECKOUT"` as the only condition for showing the active booking card will silently hide active reservations. Always handle both booking kinds.

## Session 2026-03-17

### Patterns
- When two features pivot on a shared entity (CalendarEvent links both ShiftGroup and Booking), integration is architecturally cheap — no schema migration needed, just read-path queries joining through the shared key. Research this before proposing new FK relationships.
- Non-blocking notification triggers (`createNotification(...).catch(() => {})`) are the right pattern for "nice to have" side effects in API routes. Failure shouldn't block the primary action.
- Competitive research before building features prevents building what already exists elsewhere. No competitor does both equipment checkout + shift scheduling for athletics — that's a real moat worth documenting.
- Dashboard widgets should include actionable links (e.g., "Reserve gear") not just information display. The goal is zero-tap-to-action from the widget.

## Session 2026-03-18

### Patterns
- Initial audit scans can be inaccurate — the first pass flagged escalation routes as missing auth and shift routes as missing audit, but deeper reads showed both were already covered. Always verify with full file reads before planning fixes.
- When auditing for missing patterns (like audit logging), check every route systematically rather than sampling — the real gaps are often in less-obvious routes (accessories, image upload, profile update) not the main CRUD routes.
- TOCTOU bugs hide in plain sight: any read-then-write across separate DB calls without a transaction is a race condition. The pattern to check: `findUnique` → status check → `update` as two calls. Fix: wrap in `$transaction`.
- Privilege escalation often has two vectors: role change AND user creation. Both must enforce the same guard (e.g., only ADMIN can grant ADMIN).
- Seed/bootstrap endpoints are account takeover vectors in production. Gate them behind auth or disable entirely when `NODE_ENV=production`.
- Bulk quantity updates (stock balances) require Serializable isolation or atomic increment operators. Default transaction isolation does NOT prevent lost-update races.

## Session 2026-03-22

### Patterns
- `SaveableField` + `useSaveField` is the canonical pattern for inline-editable fields. Any field with manual `useState` + `onBlur`/`onChange` save + `fetch(PATCH)` + status timeouts should be refactored to use it.
- Future refactoring targets for SaveableField reuse: `CategoryRow.tsx` (rename + add subcategory inputs), `CategoriesPage.tsx` (add category input) — both in `/settings/categories/`. These have the exact same blur-save + fetch pattern.

### Booking Detail Page Unification
- **Shared `InlineTitle` component** (`src/components/InlineTitle.tsx`): Extracted from items page — reuse for ALL detail pages with editable titles. Has accessibility (aria-label, keyboard activation, role="button").
- **Unified `BookingDetailPage`** (`src/app/(app)/bookings/BookingDetailPage.tsx`): Single component serves both checkout and reservation detail views via `kind` prop. Route files are 5-line thin wrappers.
- **Hooks extracted**: `useBookingDetail` (fetch + reload + optimistic patch) and `useBookingActions` (cancel, extend, convert, duplicate, checkin, bulk return, saveField) eliminate ~400 lines of duplicated action handler code.
- **Tab content spacing must be `mt-14`**, not `mt-6`. Items page established this spacing between sticky tabs and content — any smaller gap breaks visual hierarchy. This is a critical consistency rule.
- **History tab wrapping pattern**: Parent page wraps history in `<Card className="mt-14 border-border/40 shadow-none max-w-3xl"><CardHeader><CardTitle>Activity Log</CardTitle></CardHeader><CardContent className="p-0">`. The history component itself renders NO Card — it's a renderless content block.
- **Never hardcode colors** (e.g., `bg-green-50 text-green-700`) on buttons or interactive elements. Use Badge variants or Button variants which handle dark mode automatically. Hardcoded Tailwind color classes create dark mode maintenance burden.
- **Input hover/focus styling must match items page**: `border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs`. This creates the "ghost input" feel — invisible until hovered, then subtly highlighted.
- **Properties strip should include ref number** as a monospace badge — don't bury metadata in the header. The strip is the scannable summary line.
- **Self-audit after building**: Always compare your new page against the gold standard before declaring done. Spacing, Card wrappers, input styling, dark mode colors — these are the details that make pages feel inconsistent.

### Items List Redesign
- Derived status filtering (CHECKED_OUT, RESERVED) should use Prisma relation subqueries (`allocations: { some: { ... } }`) rather than fetching all rows, enriching in-memory, and filtering. The `@@index([assetId, active])` on `AssetAllocation` supports this pattern efficiently.
- When the API caller already has full asset objects, pass them directly to a `FromLoaded` variant of the enrichment function to skip the redundant ID-based re-fetch.
- Client-side sorting on a paginated list is misleading — users think they're sorting the full dataset but only see the current page reordered. Always use server-side sorting with `manualSorting: true` in TanStack Table.
- Consolidating multiple independent fetch calls into one endpoint saves round-trips and simplifies error handling. Create purpose-built init endpoints for page load rather than reusing generic CRUD endpoints.
- Page components over ~200 lines with >10 useState calls are a maintenance signal. Extract into focused hooks (URL state, data fetching, bulk actions) and leaf components (toolbar, pagination, bulk bar).

### Detail Page Architecture (Item Detail Overhaul)

**Layout patterns:**
- Global `a { color }` in CSS will override button text color when using `asChild` + `<Link>`. Always add a CSS rule: `[data-slot="button"] a { color: inherit; text-decoration: none; }`. Check this on ALL pages with button-wrapped links.
- `TooltipTrigger asChild > Button asChild > Link` creates broken double-`asChild` nesting. Don't wrap buttons in tooltips when the button already uses `asChild`. Pick one: tooltip OR asChild link.
- AppShell already renders a `<PageBreadcrumb />`. Pages should NOT render their own breadcrumbs — it causes double breadcrumb.
- PageBreadcrumb must detect CUIDs (not just UUIDs) as dynamic segments. Regex: `/^c[a-z0-9]{20,}$/` in addition to the hex/UUID pattern.

**Notion-style detail page principles:**
- Title should be inline-editable in the header, not repeated as a field in the card below. Kill redundancy.
- Key properties (status, location, category, department) belong as inline badges between the title and the tabs — visible without scrolling or expanding anything.
- Flat property lists beat collapsible sections. Users almost never collapse them — the friction of expanding sections is worse than a longer list.
- When two tabs share the same data shape with different filters (checkouts vs reservations), merge them into one tab with a filter toggle. Fewer tabs = less cognitive load.
- Sidebar cards compete for attention. Settings toggles should live in their own tab, not the sidebar.
- Accessories/sub-items also belong in their own tab rather than appended below the info card.
- `updatedAt` is free metadata from Prisma — show "Last updated [date]" for context without needing the History tab.

**Field ordering matters:**
- Lead with identity fields (name, product name, brand, model, serial), then organizational fields (department, category, location), then procurement (date, fiscal year, price, link). This matches how users think about items.
- Date placeholders should say "Add date" not show a fake formatted date like "January 01, 2025".
- Fiscal year should auto-compute from purchase date BUT remain independently editable. Users may need to override the computed value. Don't make derived fields read-only — auto-fill as a convenience, not a constraint.

**UX polish that compounds:**
- URL-synced tabs (`?tab=bookings`) via `useSearchParams` + `replaceState` — makes tabs shareable/bookmarkable. Apply to all detail pages.
- Keyboard shortcuts (1-N for tabs) with tiny `<kbd>` hints — power user speed. Apply everywhere tabs exist.
- Sticky tab bars (`sticky top-0 z-10 bg-background/95 backdrop-blur-sm`) — essential for long content pages.
- Duplicate detection on unique fields (serial number, asset tag) — warn on blur via search API before save.
- Physical label layout in UI must exactly match the physical artifact. Always get a reference image.

**Apply these to other detail pages:** User detail (`/users/[id]`), Reservation detail (`/reservations/[id]`), Checkout detail (`/checkouts/[id]`) — all should follow the same inline-title + badge-strip + flat-list + URL-synced-tabs pattern.

---

## Detail Page Playbook (Reference for All Detail Pages)

> This is a complete blueprint for building any `[entity]/[id]` detail page.
> Replicate patterns from `src/app/(app)/items/[id]/` — treat it as the gold standard.

### Page Structure (top to bottom)

```
1. PageBreadcrumb (auto-rendered by AppShell — do NOT add your own)
2. Page header (`.page-header`)
   - Hero image (optional) with edit overlay
   - InlineTitle (primary name, editable)
   - Subtitle (secondary name, editable)
   - Action buttons: Actions dropdown + primary CTAs (Reserve / Check out)
3. Properties strip (badges: status, location, category, etc.)
   - "Updated [date]" right-aligned with `ml-auto`
4. Tabs (sticky, keyboard shortcuts, URL-synced)
5. Tab content area
```

### Shared Components (import these, don't rebuild)

| Component | Location | Purpose |
|---|---|---|
| `InlineTitle` | `src/components/InlineTitle.tsx` | Inline-editable title with blur-save, keyboard, aria-label |
| `SaveableField` | `src/components/SaveableField.tsx` | Flat row layout: label (120px) + content + save indicator |
| `useSaveField` | `src/components/SaveableField.tsx` | Hook: manages saving/saved/error status with auto-reset |
| `CategoryCombobox` | `src/components/FormCombobox.tsx` | Combobox with search, clear, inline create |
| `Badge` | `src/components/ui/badge.tsx` | Variants: green/blue/purple/orange/red/gray/outline |
| `DatePicker` | `src/components/ui/date-picker.tsx` | Calendar popup date selector |
| `NativeSelect` | `src/components/ui/native-select.tsx` | Styled native `<select>` dropdown |
| `Empty` / `EmptyDescription` | `src/components/ui/empty.tsx` | Centered empty state with message |
| `Spinner` | `src/components/ui/spinner.tsx` | Loading indicator |
| `ChooseImageModal` | `src/components/ChooseImageModal.tsx` | Upload/URL image picker modal |
| `BookingDetailsSheet` | `src/components/BookingDetailsSheet.tsx` | Side sheet for booking details |
| `ConfirmDialog` / `useConfirm` | `src/components/ConfirmDialog.tsx` | Confirmation modal with danger variant |
| `Toast` / `useToast` | `src/components/Toast.tsx` | Toast notifications (success/error) |
| `useBookingDetail` | `src/hooks/useBookingDetail.ts` | Fetch + reload + optimistic patch for booking detail |
| `useBookingActions` | `src/hooks/useBookingActions.ts` | All booking action handlers (cancel, extend, convert, etc.) |
| `BookingDetailPage` | `src/app/(app)/bookings/BookingDetailPage.tsx` | Unified booking detail (pass `kind` prop) |

### shadcn Components Used Across Detail Pages

```tsx
// Always use these from src/components/ui/:
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogCloseButton } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { NativeSelect } from "@/components/ui/native-select";
```

### Card Styling Standard

```tsx
// Info/property cards: subtle border, no shadow
<Card className="border-border/40 shadow-none">
  <div className="py-1 divide-y divide-border/30">
    {/* SaveableField rows go here */}
  </div>
</Card>

// Sidebar/operational cards: default card styling
<Card>
  <CardHeader><CardTitle>Title</CardTitle></CardHeader>
  <CardContent className="p-4 pt-0">...</CardContent>
</Card>
```

### Field Patterns

**Text field (inline-editable, blur-save):**
```tsx
<SaveableField label="Field Name" status={saveField.status}>
  <Input
    value={draft}
    onChange={(e) => setDraft(e.target.value)}
    onBlur={commit}
    className="h-8 text-sm border-transparent bg-transparent shadow-none
               hover:bg-muted/60 hover:border-border/50
               focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs"
  />
</SaveableField>
```

**Dropdown field (native select, save-on-change):**
```tsx
<SaveableField label="Field Name" status={saveField.status}>
  <NativeSelect value={value} onChange={handleChange}
    className="h-8 text-sm border-transparent bg-transparent shadow-none ..." />
</SaveableField>
```

**Toggle field (flat row, no bordered card):**
```tsx
<div className="group/row flex items-center gap-3 rounded-md px-3 py-2.5 min-h-[44px] hover:bg-muted/50">
  <div className="min-w-0 flex-1">
    <Label>Toggle name</Label>
    <p className="text-xs text-muted-foreground">Help text</p>
  </div>
  <Switch checked={value} onCheckedChange={toggle} />
</div>
```

### Tab Setup (URL-synced + keyboard shortcuts)

```tsx
type TabKey = "info" | "bookings" | "history" | "settings";
const tabDefs = [
  { key: "info", label: "Info" },
  { key: "bookings", label: "Bookings" },
  // ...
];

// Read initial tab from URL
const initialTab = (searchParams.get("tab") as TabKey) || "info";

// Sync tab changes to URL
function switchTab(tab: TabKey) {
  setActiveTab(tab);
  const url = new URL(window.location.href);
  if (tab === "info") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  window.history.replaceState({}, "", url.toString());
}

// Keyboard shortcuts
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || ...) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= tabDefs.length) switchTab(tabDefs[num - 1].key);
  }
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, []);

// Render
<Tabs value={activeTab} onValueChange={(v) => switchTab(v as TabKey)}>
  <TabsList className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
    {tabDefs.map((tab, i) => (
      <TabsTrigger key={tab.key} value={tab.key}>
        {tab.label}
        <kbd className="ml-1 hidden sm:inline-block text-[10px] text-muted-foreground/50 font-mono">{i + 1}</kbd>
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

### API Patterns

**PATCH for inline saves:**
```tsx
const res = await fetch(`/api/[entity]/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ [fieldName]: value || null }),
});
if (!res.ok) throw new Error("Save failed");
```

**Optimistic local state update:**
```tsx
onFieldSaved({ [patchKey]: value } as Partial<EntityDetail>);
// OR for full refresh:
onRefresh(); // re-fetches the entity
```

**Activity feed API:**
```tsx
fetch(`/api/[entity]/${id}/activity`)  // returns { data: AuditEntry[] }
```

### History Tab: Field Display Rules

- **HIDDEN_FIELDS**: `_actorRole`, `_actorId`, `_actorEmail`, `_actorName`, `updatedAt`, `createdAt`, `id`, `organizationId` — never show these
- **ID_FIELDS**: `categoryId`, `departmentId`, `locationId` — show "set" / "removed" / "changed" instead of raw CUIDs
- **Boolean fields**: Show "enabled" / "disabled" instead of true/false
- **Skip entries** where all changes are hidden fields (don't show empty diff rows)
- **Layout**: timestamp right-aligned, changes as labeled key-value pairs

### Spacing & Row Standards

- `SaveableField` rows: `px-3 py-2.5 min-h-[44px]` — consistent across ALL field types
- Row dividers: `divide-y divide-border/30` on the grid container
- Label width: `w-[120px]` (set in SaveableField)
- Input height: `h-8` (32px)
- Card content padding: `p-4 pt-0` for most cards
- Tab content top margin: `mt-14` (gap between tabs bar and content)

### Breadcrumb Behavior

`PageBreadcrumb` automatically:
- Builds crumbs from the URL path
- Filters out dynamic segments (UUIDs and CUIDs)
- On detail pages (where segments were filtered), keeps all visible crumbs as clickable links
- Uses `LABEL_MAP` for known segment names
- Falls back to title-casing for unknown segments

### Grid Layout

```css
.details-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;  /* main column + sidebar */
  gap: 20px;
}
/* Collapses to single column below 1000px */
```

### Empty States

Always use shadcn Empty component:
```tsx
<Empty className="py-6 border-0">
  <EmptyDescription>No items to display.</EmptyDescription>
</Empty>
```

### Status Badge Mapping

| Status | Variant | Label |
|---|---|---|
| AVAILABLE | green | Available |
| CHECKED_OUT | blue | Checked out by [name] |
| RESERVED | purple | Reserved by [name] |
| MAINTENANCE | orange | Needs Maintenance |
| RETIRED | gray | Retired |

### Checklist for New Detail Pages

- [ ] Uses `SaveableField` + `useSaveField` for all editable fields
- [ ] Uses shared `InlineTitle` from `src/components/InlineTitle.tsx` (never duplicate)
- [ ] Card styling: `border-border/40 shadow-none` + `divide-y divide-border/30`
- [ ] Tabs: URL-synced, keyboard shortcuts, sticky
- [ ] Tab content spacing: `mt-14` (NOT mt-6) — matches items page hierarchy
- [ ] Properties strip with badges + right-aligned "Updated [date]"
- [ ] History tab wrapping: parent renders Card/CardHeader/CardTitle, history component is a renderless content block
- [ ] History tab filters internal fields, resolves IDs to labels
- [ ] Input styling: `border-transparent bg-transparent shadow-none hover:bg-muted/60 hover:border-border/50 focus-visible:bg-background focus-visible:border-ring focus-visible:shadow-xs`
- [ ] No hardcoded colors — use Badge/Button variants for dark mode safety
- [ ] Empty states use shadcn `Empty` component
- [ ] All UI primitives are from `src/components/ui/` (shadcn)
- [ ] No double breadcrumbs (AppShell handles it)
- [ ] `min-h-[44px]` on all interactive rows
- [ ] Loading state uses `Skeleton` components matching the layout
- [ ] Self-audit against items page before declaring done
- [ ] Status labels use `statusLabel(status, kind)` — never show raw enum
- [ ] Action buttons: `[Actions ▼] [Edit] [Extend] [Primary CTA]` — primary rightmost
- [ ] Equipment rows have `group/row` class + hover-reveal "..." menu
- [ ] People fields (requester, creator) show Avatar initials
- [ ] Countdown/due-back uses urgency-colored Badge (not plain text)
- [ ] Info card has heading: "Checkout details" / "Reservation details"
- [ ] Auto-select all returnable items on checkin-eligible pages
- [ ] Reset `checkinIdsInitialised.current` after partial return for re-selection
- [ ] All actions toast on success AND error (not just error)
- [ ] Quick extend offsets from picker value when already set (not always booking.endsAt)
- [ ] Optimistic UI: patch local state before API call, reload confirms truth
- [ ] Collapsible sections use shadcn `Collapsible` (not manual useState + button)
- [ ] Filter chips use shadcn `ToggleGroup` (not Button with manual variant toggling)
- [ ] Warnings/alerts use shadcn `Alert` with icon (not styled div)

## Session 2026-03-22 (Round 2): Detail Page UX Audit Patterns

### Multi-Pass Audit Process
1. **First pass**: Visual audit against reference (Cheqroom) — find 9 low-level polish issues
2. **Second pass**: Flow-trace every user journey end-to-end — find architectural issues (stale state, missing feedback, dead code)
3. **Third pass**: Component audit against shadcn library — find hand-rolled patterns that have shadcn equivalents
4. **Fourth pass**: User feedback on screenshot — reveals UX hierarchy issues (status labels, action prominence, information density)

### Key Patterns Discovered
- **Optimistic UI for bulk actions**: Patch local state immediately, then reload for truth. Prevents the "blank flash" between clearing selection and data reload.
- **Auto-select with re-init**: Use a ref flag to track initialization, but reset it after partial operations so auto-select re-fires on the next data load.
- **Status is a UX decision, not a DB decision**: Raw enum values are technical. User-facing labels should be meaningful ("Checked out" > "OPEN"). Keep enum stable, map in display layer only.
- **Action button hierarchy**: Primary CTA rightmost. Secondary actions grouped in dropdown leftmost. Middle = promoted but non-primary. Mobile collapses everything into dropdown.
- **Row-level actions via hover menu**: `group/row` on container + `opacity-0 group-hover/row:opacity-100` on trigger. Clean and discoverable without cluttering the default view.
- **Success toasts are as important as error toasts**: Users need confirmation that their action worked. Silent success erodes confidence.
- **Quick-extend should offset from picker value**: When the date picker already has a value, "+1 week" should add to that, not reset to original booking end date.

## Session 2026-03-22 (Round 3): iPhone Mobile Polish

### Patterns
- **iOS auto-zoom on inputs < 16px**: iOS Safari zooms the viewport when focusing inputs with `font-size < 16px`. Fix: `text-base md:text-sm` on Input, Textarea, and SelectTrigger — 16px on mobile, 13px on desktop. This is a global fix affecting every form in the app.
- **Hover-reveal patterns fail on touch**: `opacity-0 group-hover:opacity-100` is invisible on mobile (no hover). Fix: prefix with `sm:` so items are always visible on small screens — `sm:opacity-0 sm:group-hover/row:opacity-100`.
- **`flex items-center justify-between` breaks on mobile when content is wide**: Title + action buttons side-by-side causes title to wrap to 3+ lines while buttons are squeezed right. Fix: `flex-col sm:flex-row sm:items-center sm:justify-between` — stack vertically on mobile, inline on desktop.
- **Always test detail page headers at 390px width**: If title + buttons share a flex row, iPhone will force ugly wrapping. Default to `flex-col` on mobile for any header with more than 2 buttons.
- **Global `-webkit-tap-highlight-color: transparent`**: Apply to all interactive elements (`a, button, [role="button"], label, select, summary, [tabindex]`), not just individual components. Prevents the gray flash on tap that makes iOS web apps feel non-native.
- **`overscroll-behavior-y: none` on body**: Prevents rubber-band overscroll on iOS which makes the app feel like a webpage instead of a native app.

## Session 2026-03-22 (Round 4): Dashboard UX Hardening

### Patterns
- **Destructive actions need confirmation + feedback**: Draft discard was a silent DELETE with no confirmation dialog and no toast. Any single-click destructive action on the dashboard should use `useConfirm` + `useToast` pattern from `BookingDetailsSheet`.
- **Differentiate error types in fetch handlers**: A 401 (session expired) should redirect to `/login`, not show "Something went wrong." Check `res.status` before throwing generic errors. Network errors (`TypeError`) vs server errors need different user-facing messages.
- **Show refresh state on re-fetch, not skeleton replacement**: After a sheet mutation triggers `loadData()`, show a thin progress bar — don't replace content with skeletons (jarring) or show nothing (stale data anxiety). Use a `refreshing` boolean state.
- **Inline due dates on action rows**: Checkout rows showed status colors (red/amber borders) but not the actual date. The data was already fetched — just not rendered. Always surface time-critical data inline when it's already in the payload.
- **Keep API-provided computed fields consistent**: Overdue banner computed initials client-side while all other sections used `requesterInitials` from the API. Always derive computed display values in one place (API) and pass them through.
- **Section ordering should match temporal urgency**: Shifts (upcoming obligations) were below Drafts (abandoned work). Order sections by "what needs action soonest" not by "what was built first."
- **Welcome banner compound conditions**: If the dashboard has N data sections, the welcome banner condition must check all N — not just the first 3 that existed at V1 launch.
- **shadcn Badge replaces most custom badge CSS**: Any inline colored label (status badges, sport tags, ref numbers, count pills, due-date labels) should use `Badge variant="green|red|orange|gray|sport" size="sm"` — not custom CSS classes. This eliminates one-off `.badge-green`, `.section-count`, `.ref-badge` classes and keeps dark mode safe.
- **shadcn Avatar/AvatarGroup replaces custom avatar stacks**: `AvatarGroup` with `Avatar size="sm"` + `ring-2 ring-background` handles the overlapping stack layout. Empty slots use `AvatarFallback` with `border-dashed`. Overflow uses `AvatarFallback` with count text. No custom CSS needed.
- **Target shadcn data-slot attributes for contextual overrides**: When a shadcn component needs different styling inside a specific parent (e.g. avatar inside red overdue banner), use `[data-slot="avatar-fallback"]` selector instead of adding custom className props.

## Session 2026-03-22 (Round 6): Users Page Hardening

### Design System Patterns
- **`text-secondary` is wrong for text color**: In shadcn with CSS variables, `text-secondary` maps to `--secondary` which is a background color token (`var(--accent-soft)`). The correct class for secondary/muted text is `text-muted-foreground`. This is a codebase-wide anti-pattern — check every page during hardening.
- **Tailwind spacing values ≠ pixel values**: `p-16` = 64px (4rem), not 16px. `gap-12` = 48px, not 12px. `mb-8` = 32px, not 8px. When porting from CSS `padding: 16px` to Tailwind, use `p-4` (16px) not `p-16` (64px). This was a real bug in CreateUserCard.
- **Dead CSS accumulates after component rewrites**: When a page is rewritten from custom CSS to Tailwind/shadcn, the old CSS classes become dead code but stay in globals.css. Always grep `src/` for every class in the page's CSS section after a rewrite. Remove what's unused.

### Reliability Patterns
- **Form-options/me fetch failures shouldn't block the page**: Auxiliary data fetches (locations dropdown, current user role) failing should not set `loadError = true` which replaces the entire content with an error state. Only the primary data fetch failure should show the error state. Auxiliary failures should be silent.
- **Every mutation needs 401 handling**: Session can expire between page load and user action. Check `res.status === 401` on PATCH, POST, DELETE — not just the initial GET. Redirect to `/login` on 401.
- **Distinguish initial load from refresh**: `loading && data.length === 0` = initial load (show skeletons). `loading && data.length > 0` = refresh (show spinner, keep existing data visible). Never replace visible data with skeletons on refresh.

### UX Patterns
- **Skeleton fidelity matters**: Identical-width skeleton rows look like a test pattern. Match real row layout: avatar circles, varied text widths per row (`55 + (row % 3) * 15`%), badge-shaped pills (`rounded-full`). Each column should have a distinct skeleton shape.
- **Retry buttons on every error state**: A dead-end error screen with no recovery action is poor UX. Always add a Retry button alongside the error message. EmptyState supports `actionLabel` + `onAction` props for this.

## Session 2026-03-22 (Round 5): Items List Page Hardening

### Reliability Patterns
- **AbortController is mandatory for any filter-driven fetch**: Rapid filter changes (typing in search, toggling multiple facets) fire multiple concurrent requests. Without `AbortRef.current?.abort()` before each new fetch, stale responses can overwrite fresh data — the second request may resolve before the first.
- **Distinguish initial load from refresh**: First load should show full skeleton. Subsequent refreshes should show a subtle shimmer/progress bar and keep existing data visible. Use a `hasLoadedOnce` ref to track this — NOT a state variable (avoids extra renders).
- **Refresh failure must NOT replace visible data**: Anti-pattern: `if (!res.ok) setLoadError(true)` on every fetch. This replaces the entire table with an error screen even when valid data is in state. Fix: only set `loadError` on initial load failure. On refresh failure, toast the error and keep existing items visible.
- **Every mutation needs toast feedback**: Silent `catch { /* ignore */ }` blocks are never acceptable. Users get zero indication their action failed. Always toast success AND failure for every async user action.
- **actionBusy guard prevents duplicate requests**: Row-level actions (duplicate, maintenance, retire) need a shared `actionBusy` state that prevents concurrent mutations. Unlike bulk actions which have their own `busy` state, single-row actions share the page's `actionBusy` flag.

### UX Polish Patterns
- **Skeleton fidelity matters**: Uniform-width skeletons look like a test pattern. Match the actual table layout — image placeholder + two-line text for the Name column, pill-shaped for Status badges, varied widths per row using `(rowIndex % N) * step` formulas.
- **Confirmation dialogs should name what they destroy**: "This will mark this item as retired" is vague. "This will permanently mark 'FB-CAM-001' as retired" is specific. Include the item identifier and state the consequences (hidden from inventory, cannot be checked out).
- **Bulk action toasts should include count + action type**: "Updated" is vague. "Retired 3 items" is clear. Use an `ACTION_LABELS` map to provide human-readable action names.

### Design System Patterns
- **Raw `<span>` badges should use shadcn Badge**: Any inline colored label with padding/rounded/font-size styling is a Badge in disguise. Use `Badge variant="secondary" size="sm"` with `className="rounded-sm px-1 font-normal"` to match the faceted-filter pattern established in the codebase.
- **Loading spinners should use the Spinner component**: The project has `src/components/ui/spinner.tsx` — use it instead of text-only "Processing..." indicators.

## Session 2026-03-22 (Round 5): Dashboard Reliability + UX Polish

### Reliability Patterns
- **`useCallback` deps on hook returns = ticking time bomb**: If `loadData` depends on `[toast]` from `useToast()`, and that hook ever returns an unstable reference, the `useEffect` runs every render: abort → refetch → re-render → abort... infinite loop. Fix: use a ref (`toastRef.current = toast`) and call `toastRef.current()` inside the callback with `[]` deps.
- **Refresh errors must not wipe visible data**: If `loadData(true)` fails, setting `fetchError` replaces the entire dashboard with an error screen — even though valid data is still in state. Fix: on refresh failures, toast the error and keep existing data visible. Only show the error screen on initial load (`!isRefresh`).
- **Null-safe API response guards**: The backend runs 16 parallel queries via `Promise.all`. If one fails, the entire response is 500. But if the backend ever changes to return partial data, the frontend would crash on `.map()` of undefined arrays. Fix: `d.myCheckouts = d.myCheckouts ?? { total: 0, items: [] }` for every array/object before `setData`.
- **AbortController on all fetches**: Every `loadData` call should abort the previous in-flight request. Also abort on component unmount via the `useEffect` cleanup. This prevents stale responses from overwriting fresh data during rapid interactions.
- **Guard all mutation buttons, not just the active one**: `disabled={deletingDraftId === d.id}` only disables the button being deleted. A user can click delete on draft B while draft A is in-flight. Fix: `disabled={deletingDraftId !== null}` blocks all delete buttons.
- **Handle 401 on every mutation, not just the main fetch**: If the session expires between page load and a draft delete, the DELETE returns 401. Without explicit handling, it shows a generic "Failed" toast instead of redirecting to login.

### UX Polish Patterns
- **Optimistic deletes with rollback**: Remove the item from state immediately after confirmation, before the network round-trip. Capture `prevDrafts` before the mutation. On failure, restore via `setData(prev => ({ ...prev, drafts: prevDrafts }))`. This eliminates the jarring full-page reload on success.
- **Manual refresh button with freshness tooltip**: A spinning `RefreshCwIcon` next to the page title with `formatRelativeTime(lastRefreshed, now)` in the tooltip. Users can see data age and refresh manually. The `animate-spin` class on the icon provides feedback during refresh.
- **Skeleton width variation**: Identical `w-3/4` skeletons look like a test pattern. Vary widths per row (`70 + (j % 3) * 10` percent for titles, `40 + (j % 2) * 15` percent for meta) to look like real content being loaded.
- **Differentiate error icons by type**: Network errors (offline) get a bell icon with "You're offline" copy. Server errors get a box icon with "usually temporary" language. Small changes that signal the system knows what went wrong.

## Session 2026-03-23

### Auth Page Hardening Patterns

**Design System:**
- Auth pages (login, register, forgot-password, reset-password) share CSS classes. When migrating one to shadcn, migrate ALL to prevent half-dead CSS. Grep for shared classes across the directory before deleting any.
- Password toggle button should use `Button variant="ghost" size="icon"` not a raw `<button>` — consistent hover states, focus ring, and disabled styling for free.

**Data Flow:**
- `res.json()` on error responses can throw if the body isn't JSON (e.g., proxy 502 returns HTML). Always wrap in try-catch: `try { const json = await res.json(); message = json.error || fallback; } catch { /* non-JSON */ }`.
- `TypeError` from `fetch()` specifically indicates network failure (offline, DNS, CORS). Use this to distinguish network errors from server errors with different icons and copy.
- Form `handleSubmit` needs an early `if (loading) return` guard even when the button is `disabled={loading}` — keyboard Enter can bypass the disabled button state during rapid re-renders.
- Clear the form-level error Alert when the user starts typing, not just on re-submit. Stale errors confuse users who've already corrected their input.

**Resilience:**
- Disable ALL form inputs during submission, not just the submit button. If inputs remain editable, the user can change values while the request is in-flight, causing a mismatch between what they see and what the error references.
- Always add `aria-invalid` and `aria-describedby` to inputs with validation errors. Screen readers can't associate a red `<p>` with its input without these attributes.

**UX Polish:**
- `Loader2 className="animate-spin"` inside the submit button alongside loading text (e.g., "Signing in...") gives a clear visual signal that something is happening. Static text alone feels frozen.
- `WifiOff` icon for network errors vs `AlertCircle` for auth/server errors — small icon difference communicates system understanding.
- Auto-focus the first invalid field after validation failure using refs. Users shouldn't have to click back into the field with the error.

## Session 2026-03-23 (Scan Page Hardening)

### Reliability Patterns
- **Refresh vs initial load errors**: A refresh failure should toast, not replace visible data with an error screen. Use `setScanStatus((prev) => { if (!prev) setLoadError(true); else toast(...); return prev; })` to distinguish initial load from refresh.
- **try/catch/finally for multi-step async flows**: When a handler has multiple sequential `await` calls (e.g., try serialized → try bulk → fetch units), wrap in try/catch/finally to guarantee `processingRef` cleanup. Without finally, a network drop between steps leaves the page permanently stuck.
- **Every inline `fetch()` needs its own error path**: The numbered bulk scan flow had 3 sequential fetches but only the first was guarded. Each fetch in a chain can fail independently.

### UX Patterns
- **Auto-clear scan feedback**: Stale success/error messages from a previous scan confuse users, especially on slow networks. Auto-clear success after 5s and errors after 8s using a ref-backed timer.
- **Optimistic checklist update**: When a scan succeeds, update the item's `scanned: true` immediately via `setScanStatus` updater function. Then fire a background `loadScanStatus()` (no `await`) to get authoritative state. This eliminates the "scanned but still shows unchecked" moment.
- **Spinner on async buttons**: `Loader2Icon className="animate-spin"` is more informative than static `"..."` text. Used consistently on manual scan, complete checkout, and unit picker submit buttons.

### Design System Patterns
- **Badge variants map to status enums**: When a component has a `statusColor()` function returning hex values, check if shadcn Badge already has matching variants (green, blue, purple, orange, gray). Direct replacement eliminates inline styles and custom CSS.
- **Progress component replaces custom progress bars**: Custom `.progress-bar` + `.progress-fill` CSS is a direct shadcn Progress replacement. Use `[&>[data-slot=progress-indicator]]:bg-color` for custom indicator colors.

## Session 2026-03-23 (Profile Page Hardening)

### Architecture Patterns
- **"Same page, different context" > separate pages**: When a profile page duplicates a user detail page with minor additions (avatar upload, password change), merge them. Use `isSelf` detection to conditionally show self-edit features. This eliminates code duplication, keeps the navigation model simple, and ensures profile features stay in sync with the user detail page.
- **Redirect pages for backward compatibility**: When merging pages, keep the old route as a lightweight redirect (`/profile` → `/users/{id}`) so bookmarks and links still work. The redirect fetches the user ID then calls `router.replace()`.

### Data Flow Patterns
- **Separate `canEdit` from `isSelf`**: A boolean `canEdit = isSelf || isAdmin` is too coarse when different fields have different edit permissions. Students can edit their own name/location but not email/phone/role. Pass both `canEdit` (role-based) and `isSelf` to the component, and apply field-level permissions: `canEdit={canEdit || isSelf}` for name/location, `canEdit={canEdit}` for admin-only fields.
- **Route self-edits through the right API**: When the same form serves both admin-edits and self-edits, the `patchUser` function must detect which API to use. Self-edits for name/location go through `/api/profile` (works for all roles), while other fields require `/api/users/:id` (ADMIN/STAFF only). Anti-pattern: using a single `canEdit` boolean that makes all fields editable for self-viewers, then sending all edits through the admin API which returns 403 for students.

### Resilience Patterns
- **Clear stale data on retry**: When a retry button re-triggers data loading, always clear the previous data (`setUser(null)`) alongside clearing the error state. Without this, old data is briefly visible while the new request is in flight, which can show the wrong user's information.

### UX Patterns
- **Optimistic removal with rollback**: For destructive actions where the expected outcome is clear (removing an avatar sets it to null), update the UI immediately and restore on failure. Save the previous value, set the new state optimistically, then rollback in both the error response and catch paths.
- **Contextual breadcrumbs**: When the same page serves two purposes (user detail vs profile), the breadcrumb should reflect the user's intent: show "Profile" when `isSelf`, show the user's name when viewing someone else.

## Session 2026-03-23 (Reports Page Hardening)

### Design System Patterns
- **Global PageBreadcrumb covers sub-routes**: `AppShell.tsx` renders `<PageBreadcrumb />` which auto-generates breadcrumbs from the URL path (e.g., Home > Reports > Utilization). Page-level breadcrumb components are always redundant — remove them.
- **shadcn Table vs custom .data-table CSS**: The `Table` / `TableRow` / `TableCell` components from shadcn provide consistent hover, borders, and spacing. Custom `.data-table` CSS was 50+ lines that duplicated what shadcn Table does in 0 lines.

### Data Flow Patterns
- **URL-persisted filters via `window.history.replaceState`**: For read-only pages with filter controls (period, phase), sync filter state to the URL so report links are shareable. Use `useSearchParams()` to hydrate initial state, `replaceState` to sync changes. Don't use `router.push()` — it triggers unnecessary navigation transitions.
- **Data freshness indicator reuse**: The Dashboard's `lastRefreshed` + `RefreshCw` + `Tooltip` + `formatRelativeTime` pattern is portable to any data-fetching page. Add `lastRefreshed` state, set on successful fetch, display in a Tooltip on a ghost-variant RefreshCw button. Update "ago" display with a 60s interval.

### Reliability Patterns
- **Retry button must call loadData, not just clear error state**: Anti-pattern: `onClick={() => { setError(false); setLoading(true); }}` — this clears the error and shows loading but never re-fetches. Always call the actual data loading function.
- **Refresh-without-replacement for filter changes**: When `data !== null` and the user changes a filter, don't replace visible data with skeletons. Show a subtle spinner (e.g., RefreshCw animate-spin) and keep current data visible until the new response arrives. Only show full skeletons on initial load (`data === null`).

## Session 2026-03-23 (Schedule Page Merge + Hardening)

### Architecture Patterns
- **Merge pages that answer the same question**: If two pages pivot on the same model and answer "what's happening and who's working?", merge them. Staff shouldn't bounce between pages for related context. The unified `/schedule` page replaced `/events` + old `/schedule`.
- **Parallel API fetches over combined endpoints**: Fetching `/api/calendar-events` and `/api/shift-groups` in parallel from the client is simpler than creating a combined endpoint. One API can 403 gracefully (students without shift:view) without blocking the other.
- **Keep Trade Board accessible during page context**: Moving Trade Board from a tab (replaces page) to a Sheet overlay (side panel) lets users see the schedule while browsing trades. Side panels preserve context; tabs destroy it.

### UX Patterns
- **"My Shifts" as default-ON for students**: Student users want their shifts first. Default the filter ON for STUDENT role (from `/api/me`), but only when localStorage has no prior preference (`=== null` check). This respects user choice after first interaction.
- **Filtered count indicator**: Show "N of M" (e.g., "3 of 12") when filters reduce the result set. Helps users understand they're seeing a subset without needing to clear filters to verify.
- **Trade count badge on button**: A small orange badge with open trade count on the "Trade Board" button provides at-a-glance visibility of pending actions. Refresh the count when the sheet closes (trades may have been claimed/cancelled).
- **Inline coverage expansion**: Click a coverage badge to expand per-area breakdown inline (Video 2/2, Photo 1/2, etc.) with assign buttons. Avoids opening ShiftDetailPanel just to see which areas need staff.

### Reliability Patterns
- **hasLoadedRef for refresh-preserves-data**: Use a ref (not state) to track whether initial data load completed. On subsequent loads (filter/view changes), skip `setLoading(true)` so existing data stays visible. Avoids skeleton flash on every filter change.
- **Trade count refresh on sheet close**: The `onOpenChange` handler on the Sheet fires when closing — use it to re-fetch trade count since the user may have claimed or cancelled trades while the sheet was open.

### Stress Test Patterns
- **Per-item acting guards are insufficient**: `disabled={acting === t.id}` only blocks the button being acted on. Users can spam-click buttons on DIFFERENT items, firing concurrent mutations. Fix: `disabled={acting !== null}` blocks ALL mutation buttons while any mutation is in-flight.
- **401 handling is per-component, not per-page**: The schedule page has 401 handling on its own fetches, but ShiftDetailPanel and TradeBoard are rendered inside it as child components with their own fetch calls. Each component needs its own 401 handling — a page-level guard doesn't protect child component mutations.
- **Conditional render = auto-remount = fresh data**: `{open && <Component />}` unmounts on close and remounts on open, triggering useEffect data loads. No manual "reload on open" needed — the component lifecycle handles it.
