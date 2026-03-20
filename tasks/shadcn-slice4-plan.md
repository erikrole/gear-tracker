# Slice 4: Form Components Migration

## Goal
Replace custom `.form-input`, `.form-select`, `.form-group`, `.field-compact`, `.sheet-field` CSS patterns with shadcn/ui form primitives (`Input`, `Label`, `Select`, `Checkbox`, `Textarea`). Preserve all existing behavior — controlled/uncontrolled, validation, layouts.

## Scope
- **113 form elements** across **20 files**
- **48** `.form-input` usages, **8** `.form-select`, **8** `.form-group`
- Multiple patterns: form-group, field-compact, sheet-field, profile-form, inline-edit

## Strategy
Progressive replacement in 4 sub-steps. Each sub-step builds, each is independently testable.

---

## Sub-steps

### Step 1: Add shadcn form primitives
- [ ] Create `src/components/ui/input.tsx` — shadcn Input (maps to `.form-input` styling)
- [ ] Create `src/components/ui/label.tsx` — shadcn Label (wraps `<label>` with consistent styling)
- [ ] Create `src/components/ui/textarea.tsx` — shadcn Textarea
- [ ] Create `src/components/ui/checkbox.tsx` — shadcn Checkbox (Radix)
- [ ] Create `src/components/ui/select.tsx` — shadcn Select (native `<select>` wrapper, NOT Radix Select — too heavy for this use case)
- [ ] Verify build passes

### Step 2: Migrate auth forms (4 files)
- [ ] `src/app/register/page.tsx` — form-group + controlled inputs + field-error
- [ ] `src/app/login/page.tsx` — form-group + controlled inputs
- [ ] `src/app/forgot-password/page.tsx` — form-group + controlled input
- [ ] `src/app/reset-password/page.tsx` — form-group + password fields
- [ ] Verify build passes

### Step 3: Migrate app forms (10+ files)
- [ ] `src/app/(app)/profile/page.tsx` — profile-form pattern
- [ ] `src/app/(app)/users/CreateUserCard.tsx` — field-compact pattern
- [ ] `src/app/(app)/users/[id]/UserInfoTab.tsx` — field-compact pattern
- [ ] `src/app/(app)/users/UserFilters.tsx` — form-input filters
- [ ] `src/app/(app)/settings/calendar-sources/page.tsx` — form-group
- [ ] `src/app/(app)/settings/escalation/page.tsx` — form inputs
- [ ] `src/app/(app)/settings/sports/RosterPanel.tsx` — form inputs
- [ ] `src/app/(app)/settings/sports/ShiftConfigTable.tsx` — inline inputs
- [ ] `src/app/(app)/items/page.tsx` — CreateItemCard form-input
- [ ] `src/app/(app)/items/[id]/ItemInfoTab.tsx` — inline-edit inputs
- [ ] `src/app/(app)/bulk-inventory/page.tsx` — form-input
- [ ] `src/app/(app)/search/page.tsx` — search input
- [ ] `src/app/(app)/events/page.tsx` — form inputs
- [ ] `src/components/ShiftDetailPanel.tsx` — sheet-field pattern
- [ ] `src/components/booking-list/BookingFilters.tsx` — filter inputs
- [ ] `src/components/ChooseImageModal.tsx` — form input (if any)
- [ ] Verify build passes

### Step 4: CSS cleanup + docs
- [ ] Remove `.form-input`, `.form-select`, `.form-group`, `.field-compact`, `.sheet-field` CSS rules from globals.css
- [ ] Remove `.form-hint`, `.form-error`, `.field-error` CSS (replace with Tailwind utilities)
- [ ] Remove `.form-grid` patterns if fully replaced
- [ ] Keep `.password-wrapper`, `.remember-row`, `.inline-edit-*` if still needed
- [ ] Update `tasks/shadcn-integration-plan.md` — mark Slice 4 complete
- [ ] Verify build passes, zero regressions

---

## Design Decisions

1. **Native Select vs Radix Select**: Use a thin wrapper around native `<select>` styled like shadcn Input. Radix Select is heavy and changes UX behavior (custom dropdown). Our forms work fine with native selects.

2. **No react-hook-form**: The codebase uses both controlled state and FormData patterns. Adding RHF would be scope creep. Keep existing form handling.

3. **Field-level errors**: Replace `.field-error` divs with Tailwind `text-destructive text-xs mt-1` directly. No need for a separate component.

4. **Form hints**: Replace `.form-hint` with Tailwind `text-muted-foreground text-xs mt-1`.

5. **Mobile touch targets**: shadcn Input already has `h-9` (36px). Auth forms need `h-11` (44px) for touch — use size variant or className override.
