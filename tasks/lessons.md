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
