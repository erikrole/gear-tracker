# Item Picker — Component Roadmap (V1 → V2 → V3)

## Document Control
- Component family: EquipmentPicker + FormCombobox variants
- Created: 2026-03-24
- Status: Analysis only — no code changes

---

## Current State

### Component Family

The "Item Picker" is actually a family of four components sharing selection semantics but no shared base:

| Component | File | Type | Consumers |
|-----------|------|------|-----------|
| `EquipmentPicker` | `src/components/EquipmentPicker.tsx` | Composite (708 LOC) | CreateBookingCard |
| `FormCombobox` | `src/components/FormCombobox.tsx` | Primitive (single-select) | SerializedItemForm, BulkItemForm, ItemInfoTab |
| `CategoryCombobox` | `src/components/FormCombobox.tsx` | Primitive (grouped single-select) | SerializedItemForm, BulkItemForm, ItemInfoTab |
| `BulkSkuCombobox` | `src/components/FormCombobox.tsx` | Primitive (single-select) | BulkItemForm |

### EquipmentPicker — Primary Analysis

**What it does:** Full-page multi-item selection interface for booking creation. Supports serialized assets (checkbox multi-select) and bulk SKUs (quantity stepper). Organized into 5 equipment sections with per-section search, availability preview, scan-to-add, and a sticky selection footer.

**Props (12 total):**
- `assets: PickerAsset[]` — serialized items to choose from
- `bulkSkus: PickerBulkSku[]` — bulk items to choose from
- `selectedAssetIds: string[]` + `setSelectedAssetIds` — controlled serialized selection
- `selectedBulkItems: BulkSelection[]` + `setSelectedBulkItems` — controlled bulk selection
- `visible: boolean` — open/closed state (externally controlled)
- `onDone: () => void` — close callback
- `onReopen: () => void` — reopen callback
- `startsAt?: string`, `endsAt?: string` — booking window for availability
- `locationId?: string` — location context for availability

**Strengths:**
- Feature-complete for V1 use case (shipped 2026-03-15)
- Scan-to-add, availability preview, section tabs, guidance hints all working
- Per-section search with persistent state
- Sticky footer with selected item tags

**Weaknesses:**
1. **Monolithic** — 708 lines in a single component with no sub-components
2. **Custom CSS classes** — Uses `equip-picker-*`, `picker-*`, `section-*` class names instead of shadcn/Tailwind patterns
3. **No cva/cn patterns** — Styling doesn't follow shadcn variant conventions
4. **Raw HTML elements** — Uses `<input type="checkbox">`, `<button>`, `<label>` instead of shadcn `Checkbox`, `Button`, `Badge`
5. **O(n) lookups** — `assets.find()` inside render loops for footer tags and count calculations
6. **Tightly coupled to booking domain** — Section keys, guidance, availability all hardcoded
7. **No keyboard navigation** — Tab sections aren't keyboard-navigable beyond native button focus
8. **Visibility controlled externally** — `visible` prop + `onDone`/`onReopen` is an awkward open/close API

### FormCombobox Family — Secondary Analysis

**Strengths:**
- Clean shadcn composition (Popover + Command)
- Well-typed props, simple API
- `allowClear`, `allowCreate`, `disabled` variants work well

**Weaknesses:**
1. Three components in one file with no shared abstraction
2. `CategoryCombobox` duplicates Popover+Command boilerplate from `FormCombobox`
3. `BulkSkuCombobox` has no `allowClear`, `disabled`, or `placeholder` props — inconsistent with siblings
4. No loading state for async option fetching
5. No multi-select variant (forces EquipmentPicker to be a separate pattern)

### Usage Context

**EquipmentPicker consumers:**
- `CreateBookingCard` — the sole consumer. Manages all selection state externally and passes it down. The picker is embedded inline (not a dialog/sheet).

**FormCombobox consumers:**
- `SerializedItemForm` — Department (FormCombobox), Location (FormCombobox), Category (CategoryCombobox)
- `BulkItemForm` — Category (CategoryCombobox), Existing SKU (BulkSkuCombobox)
- `ItemInfoTab` — Department, Location, Category (all in edit mode)

**Inconsistencies across consumers:**
- EquipmentPicker uses raw checkboxes while FormCombobox uses shadcn Command
- No shared "item selection" pattern — booking picker and form comboboxes are entirely separate component trees
- `BulkSkuCombobox` lacks props that its siblings have (`allowClear`, `disabled`)

---

## VERSION ROADMAP

### V1 — Core: Standardize and Decompose

**Principle:** Break the monolith into composable sub-components. Align with shadcn patterns. Zero behavior change.

**EquipmentPicker decomposition:**

```tsx
// New file structure:
// src/components/equipment-picker/EquipmentPicker.tsx      — orchestrator
// src/components/equipment-picker/PickerSectionTabs.tsx     — tab bar
// src/components/equipment-picker/PickerToolbar.tsx          — search + filter
// src/components/equipment-picker/PickerAssetRow.tsx         — single asset row
// src/components/equipment-picker/PickerBulkRow.tsx          — single bulk row
// src/components/equipment-picker/PickerFooter.tsx           — sticky selection footer
// src/components/equipment-picker/PickerScanOverlay.tsx      — QR scanner modal
// src/components/equipment-picker/types.ts                   — shared types

// V1 public API — backward compatible
interface EquipmentPickerProps {
  /** Serialized assets available for selection */
  assets: PickerAsset[];
  /** Bulk SKUs available for selection */
  bulkSkus: PickerBulkSku[];
  /** Controlled selection state — serialized asset IDs */
  selectedAssetIds: string[];
  onSelectedAssetIdsChange: (ids: string[]) => void;
  /** Controlled selection state — bulk items with quantities */
  selectedBulkItems: BulkSelection[];
  onSelectedBulkItemsChange: (items: BulkSelection[]) => void;
  /** Whether the picker panel is expanded */
  open: boolean;
  /** Called when user finishes selecting */
  onOpenChange: (open: boolean) => void;
  /** Booking window for availability preview (ISO strings) */
  startsAt?: string;
  endsAt?: string;
  /** Location context for availability check */
  locationId?: string;
}
```

**Key V1 changes:**
1. **Decompose into sub-components** — Extract PickerAssetRow, PickerBulkRow, PickerFooter, PickerSectionTabs, PickerToolbar, PickerScanOverlay into separate files
2. **Rename props to conventions** — `setSelectedAssetIds` → `onSelectedAssetIdsChange`, `visible`/`onDone`/`onReopen` → `open`/`onOpenChange` (shadcn pattern)
3. **Replace raw HTML with shadcn** — `<input type="checkbox">` → `Checkbox`, raw `<button>` → `Button`, status dots → `Badge` variant
4. **Apply cn() for all className merging** — Replace string concatenation with `cn()` calls
5. **Index assets by ID** — Replace `assets.find()` loops with a `useMemo` Map for O(1) lookups
6. **Normalize FormCombobox family** — Add missing `allowClear`, `disabled`, `placeholder` to `BulkSkuCombobox`
7. **Export barrel file** — `src/components/equipment-picker/index.ts` re-exports public API

**FormCombobox V1 cleanup:**
```tsx
// Normalize BulkSkuCombobox to match siblings
interface BulkSkuComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  skus: BulkSkuOption[];
  placeholder?: string;        // NEW — was hardcoded
  allowClear?: boolean;         // NEW — missing
  disabled?: boolean;           // NEW — missing
}
```

**Migration:** CreateBookingCard updates prop names. Temporary re-export from old path for any other importers.

---

### V2 — Enhanced: Multi-Select Combobox, Responsive, Accessible

**Principle:** Unify the selection pattern. Add a multi-select combobox primitive that both the EquipmentPicker and forms can share. Improve accessibility and responsive behavior.

**New primitive — MultiSelectCombobox:**
```tsx
// src/components/ui/multi-select-combobox.tsx
// Built on shadcn Popover + Command, extends the existing combobox pattern

interface MultiSelectComboboxProps<T> {
  /** All available options */
  options: T[];
  /** Currently selected option IDs */
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  /** Extract unique ID from option */
  getOptionId: (option: T) => string;
  /** Extract searchable label from option */
  getOptionLabel: (option: T) => string;
  /** Custom render for each option row */
  renderOption?: (option: T, isSelected: boolean) => React.ReactNode;
  /** Group options by key */
  groupBy?: (option: T) => string;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Max visible items before scroll */
  maxVisible?: number;
  /** Whether the trigger shows as inline (picker) or dropdown (combobox) */
  variant?: "inline" | "dropdown";
}
```

**EquipmentPicker V2 enhancements:**
```tsx
interface EquipmentPickerProps {
  // ... V1 props (all preserved) ...

  /** Section configuration override (default: standard 5-section equipment layout) */
  sections?: PickerSection[];
  /** Whether to show the scan-to-add button */
  enableScan?: boolean;                    // NEW — default true
  /** Whether to show availability preview */
  enableAvailabilityCheck?: boolean;       // NEW — default true
  /** Custom empty state per section */
  renderEmpty?: (section: EquipmentSectionKey) => React.ReactNode;
  /** Called when an item is scanned */
  onScan?: (value: string) => void;        // NEW — hook for scan events
}

// Compound sub-component access for advanced layouts
EquipmentPicker.Tabs        // Section tab bar (standalone)
EquipmentPicker.Search      // Search toolbar (standalone)
EquipmentPicker.List        // Asset/bulk list (standalone)
EquipmentPicker.Footer      // Selection footer (standalone)
EquipmentPicker.Scanner     // QR overlay (standalone)
```

**V2 feature additions:**
1. **MultiSelectCombobox primitive** — Reusable across forms and picker; replaces ad-hoc checkbox lists
2. **Compound component API** — `EquipmentPicker.Tabs`, `.Search`, `.List`, `.Footer`, `.Scanner` for custom layouts
3. **Keyboard navigation** — Arrow keys traverse sections, Enter toggles selection, Escape closes scanner
4. **ARIA attributes** — `role="listbox"`, `aria-selected`, `aria-label` on all interactive elements
5. **Responsive layout** — Section tabs scroll horizontally on mobile; footer collapses to count-only on small screens
6. **Loading skeleton** — Show skeleton rows while assets load (currently no loading state)
7. **Animation** — Framer Motion for footer tag enter/exit, section tab transitions
8. **onScan callback** — Expose scan events to parent for analytics/logging

**Migration:** V1 consumers continue working unchanged. New features are opt-in via new props. Compound sub-components are additive.

---

### V3 — Advanced: Context-Aware, Virtualized, Domain-Agnostic

**Principle:** The picker adapts to its context and handles scale. Decouple from equipment domain so it can serve any multi-item selection use case.

```tsx
// V3: Generic ItemPicker with domain-specific presets

interface ItemPickerProps<TItem, TBulk = never> {
  /** Items available for selection */
  items: TItem[];
  /** Bulk items (optional — only for quantity-based selection) */
  bulkItems?: TBulk[];
  /** Selection state */
  selected: Selection<TItem, TBulk>;
  onSelectedChange: (selected: Selection<TItem, TBulk>) => void;
  /** Section/grouping configuration */
  sections: SectionConfig<TItem, TBulk>[];
  /** Item identity */
  getItemId: (item: TItem) => string;
  getBulkId?: (item: TBulk) => string;
  /** Custom row rendering */
  renderItem?: (item: TItem, state: ItemState) => React.ReactNode;
  renderBulk?: (item: TBulk, state: BulkState) => React.ReactNode;
  /** Availability/conflict checking */
  checkAvailability?: (context: AvailabilityContext) => Promise<ConflictMap>;
  /** Scan integration */
  onScan?: (value: string) => ScanResult;
  /** Layout variant */
  variant?: "panel" | "dialog" | "sheet" | "inline";
  /** Enable virtualization for large lists (100+ items) */
  virtualize?: boolean;
}

// Domain-specific preset
const EquipmentPicker = createItemPicker<PickerAsset, PickerBulkSku>({
  sections: EQUIPMENT_SECTIONS,
  getItemId: (a) => a.id,
  getBulkId: (s) => s.id,
  classify: classifyAssetType,
  renderItem: EquipmentAssetRow,
  renderBulk: EquipmentBulkRow,
  checkAvailability: fetchEquipmentConflicts,
  onScan: resolveEquipmentScan,
});

// Future presets (when other pick-from-list use cases emerge)
// const UserPicker = createItemPicker<User>({ ... });
// const LocationPicker = createItemPicker<Location>({ ... });
```

**V3 capabilities:**
1. **Generic `ItemPicker<T>`** — Domain-agnostic base with `createItemPicker` factory for presets
2. **Virtualization** — `@tanstack/react-virtual` for 100+ item sections (only when `virtualize` prop set)
3. **Layout variants** — `"panel"` (current inline), `"dialog"` (modal), `"sheet"` (side sheet), `"inline"` (always visible)
4. **Slot pattern** — `renderItem`, `renderBulk`, `renderEmpty` slots replace hardcoded row markup
5. **Context-aware rendering** — Picker detects if it's inside a Dialog, Sheet, or Card and adjusts max-height, scroll behavior, and z-index automatically
6. **Full a11y audit** — Screen reader announcements for selection changes, conflict warnings, scan results
7. **Optimistic conflict checking** — Cache availability results and diff on date change (avoid full re-fetch)
8. **Undo** — Ctrl+Z to undo last selection/deselection action

---

## Integration Plan

### V1 Migration
| Consumer | Update Required | Effort |
|----------|----------------|--------|
| CreateBookingCard | Rename props (`visible`→`open`, `setSelected*`→`onSelected*Change`, remove `onReopen`) | Small |
| BookingListPage | Update type import path | Trivial |
| ConfirmBookingDialog | Update type import path | Trivial |
| SerializedItemForm | None (FormCombobox API unchanged) | None |
| BulkItemForm | None (BulkSkuCombobox gains optional props) | None |
| ItemInfoTab | None | None |

**Rollout order:** CreateBookingCard first (sole EquipmentPicker consumer) → type import updates → FormCombobox normalization.

**Breaking changes:** Prop renames on EquipmentPicker. Mitigate with temporary adapter wrapper if needed, but with only 1 consumer this is safe to do directly.

### V2 Migration
| Consumer | Update Required | Effort |
|----------|----------------|--------|
| CreateBookingCard | Optionally adopt compound sub-components for custom layout | Optional |
| Any new picker consumer | Use MultiSelectCombobox directly | N/A |

**Breaking changes:** None. All V2 additions are new props with defaults matching V1 behavior.

### V3 Migration
| Consumer | Update Required | Effort |
|----------|----------------|--------|
| CreateBookingCard | Switch to `EquipmentPicker` preset (same API, new import path) | Small |
| New use cases | Use `createItemPicker` factory | N/A |

**Breaking changes:** Import path changes. `EquipmentPicker` becomes a preset of generic `ItemPicker`. Props remain compatible through the factory.

---

## Risks

### API Churn
- **V1 → V2:** Zero churn. V2 only adds props with backward-compatible defaults.
- **V2 → V3:** Moderate. Generic `ItemPicker<T>` changes the mental model. Mitigate with `EquipmentPicker` preset that preserves exact V2 API.

### Tight Coupling
- Current EquipmentPicker is deeply coupled to booking domain (equipment sections, availability API, QR scan format). V1 and V2 accept this. V3 decouples via generics and callbacks.
- **Decision point:** Only pursue V3 if a second picker use case actually emerges. Don't generalize speculatively.

### Overengineering
- V3's generic `ItemPicker<T>` + `createItemPicker` factory is warranted **only** if multiple picker contexts emerge (e.g., user picker, location picker). If EquipmentPicker remains the sole picker, stop at V2.
- Virtualization is only needed if sections exceed ~100 items. Current inventory is well below this.

### Prop Explosion
- V2 adds 5 new optional props — acceptable.
- V3 moves complexity into the factory config, keeping per-instance props minimal.
- The compound component pattern (V2) prevents prop explosion by allowing composition instead of configuration.

---

## Rollout Plan

1. **Ship V1** as a non-breaking refactor PR
   - Decompose EquipmentPicker into sub-components (same directory)
   - Replace raw HTML with shadcn components
   - Rename props to conventions
   - Normalize BulkSkuCombobox
   - Verify: build passes, CreateBookingCard works identically
   - **Gate:** existing checkout/reservation creation regression-free

2. **Migrate to V1** — single PR updating CreateBookingCard prop names

3. **Ship V2** when any of these triggers occur:
   - A second page needs multi-item selection
   - Accessibility audit flags keyboard/screen-reader gaps
   - Mobile UX testing reveals responsive issues in the picker
   - **Gate:** V1 has been stable in production for ≥2 weeks

4. **Ship V3** only when:
   - A genuinely different item-picking use case emerges (not equipment)
   - Section sizes exceed 100 items and virtualization is needed
   - **Gate:** V2 compound API has been used by ≥2 consumers

---

## References
- Feature brief: `docs/BRIEF_PICKER_IMPROVEMENTS_V1.md` (shipped)
- Equipment sections: `src/lib/equipment-sections.ts`
- Equipment guidance: `src/lib/equipment-guidance.ts`
- Decisions: D-004 (tag-first), D-016 (sections code-defined), D-022 (numbered bulk), D-023 (bundling)
- Area docs: `docs/AREA_CHECKOUTS.md`, `docs/AREA_ITEMS.md`
