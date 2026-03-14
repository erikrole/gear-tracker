# Phase A Blockers Plan

## Slice 1: Items & Reservations Polish (Code)

### items/page.tsx — Already solid
- [x] useCallback for reload
- [x] Debounced search (300ms)
- [x] Error state with retry (loadError + EmptyState)
- [x] try/catch on fetches
- [x] CSS classes for filters
- [ ] Minor: 4 inline styles in StatusDot popover (lines 82, 88, 90, 95)

### items/[id]/page.tsx — Main polish target (1386 lines, ~40 inline styles)
- [x] useCallback for loadAsset, loadCategories
- [x] try/catch on all actions (duplicate, retire, maintenance, delete)
- [x] Error toast feedback on action failures
- [ ] **~40 inline styles** across: editable fields, QR modal, data list grid, calendar, history, settings, page header
- [ ] Loading state for initial asset fetch (currently no spinner shown before asset loads)
- [ ] fetchError state exists but need to verify it renders properly

### reservations/[id]/page.tsx — Secondary polish target (770 lines, ~25 inline styles)
- [x] useCallback for reload
- [x] try/catch on cancel, extend, convert
- [x] Error toast on failures
- [ ] **~25 inline styles** across: page header, conflict banner, extend form, tab bar, equipment table, history timeline
- [ ] actionLoading feedback exists but some buttons may not reflect it

### items/page.tsx StatusDot — Minor
- [ ] 4 inline styles in StatusDot component (popover positioning)

---

## Slice 2: Student Mobile Brief (Document)

- [ ] Write `docs/BRIEF_STUDENT_MOBILE_V1.md`
- Define 3 student KPIs: taps-to-action, task-completion time, scan success rate
- Scope student-first dashboard actions
- Scope scan parity requirements
- Scope owned-work list UX
- Reference: AREA_MOBILE.md, AREA_DASHBOARD.md, D-015
- Resolves: PD-5, GAP-1

---

## Execution Order
1. Inline style migration: items/[id]/page.tsx (~40 styles)
2. Inline style migration: reservations/[id]/page.tsx (~25 styles)
3. Minor: items/page.tsx StatusDot popover styles
4. Build & verify
5. Commit & push code changes
6. Write BRIEF_STUDENT_MOBILE_V1.md
7. Update GAPS_AND_RISKS.md (close PD-5, GAP-1)
8. Update tasks/todo.md
