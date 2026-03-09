# Checkout UX V2 — Complete ✅

## Status: Fully Shipped (2026-03-09)

All 4 thin slices and subsequent hardening passes are complete and merged to main.

---

## What Was Shipped

### Slice 1 — Action Gating, Event Defaults, Partial Check-In (PR #20)
- `src/lib/services/checkout-rules.ts`: `canPerformAction()`, `getAllowedActions()`, `requireCheckoutAction()`
- State × Role × Ownership matrix enforced on all mutation endpoints
- `src/lib/services/event-defaults.ts`: `resolveEventDefaults()` — 30-day event lookup by sportCode with ad hoc fallback
- Partial check-in route: marks individual items returned, auto-completes booking when all allocations returned

### Slice 2 — allowedActions Wired Into UI (PR #21)
- `getAllowedActions()` results surfaced to checkout list and detail surfaces
- Action visibility gated by role, ownership, and booking state
- Mobile action sheet respects same gating

### Slice 3 — Equipment Picker on Checkout Create (PR #22)
- Equipment picker integrated into checkout creation flow
- Serialized assets and bulk SKUs selectable during create
- Availability pre-check at picker load time

### Slice 4 — Kit-First Sectioned Equipment Picker (PR #23)
- `src/lib/equipment-sections.ts`: section definitions, keyword classifier, group helpers
- Section order: Bodies → Lenses → Batteries → Accessories → Others
- Locked forward-progression model (can return to prior sections, cannot skip ahead)

### Hardening 1 — Forward Progression + Battery Hint (PR #24)
- Locked tab progression enforced in picker UI
- `src/lib/equipment-guidance.ts`: `EQUIPMENT_GUIDANCE_RULES`, `getActiveGuidance()`
- First guidance rule: `body-needs-batteries` (warning when battery section active and body selected)

### Hardening 2 — Availability Visibility + Conflict Feedback (PR #25)
- Conflict badges in picker for unavailable items
- Badge shows blocking booking title and conflicting time window
- Availability check batched to respect Worker subrequest limits

---

## Open Items (Post-V2)

These were not in scope for V2 but are tracked for follow-up:

1. **More equipment guidance rules** — lens+body, audio hint, drone battery — tracked in tasks/todo.md
2. **DRAFT state formalization** — `checkout-rules.ts` handles DRAFT; full lifecycle spec pending (D-017)
3. **Scan-to-add in picker** — future Phase B improvement for physical handoff workflows

---

## Key Files Modified

| File | Purpose |
|---|---|
| `src/lib/services/checkout-rules.ts` | Action gating engine |
| `src/lib/services/event-defaults.ts` | Event default lookup for checkout creation |
| `src/lib/equipment-sections.ts` | Section definitions and asset classification |
| `src/lib/equipment-guidance.ts` | Context-aware guidance rules |
| `src/app/api/checkouts/[id]/cancel/route.ts` | Gated with requireCheckoutAction |
| `src/app/api/checkouts/[id]/checkin-items/route.ts` | Partial check-in handler |
| `src/app/api/checkouts/[id]/complete-checkin/route.ts` | Full check-in completion |
| `src/app/api/checkouts/[id]/extend/route.ts` | Gated with requireCheckoutAction |
| `src/app/(app)/checkouts/page.tsx` | Checkout list with allowedActions surface |

---

## Retrospective Notes

- Thin slice approach worked well — each slice was independently testable and mergeable
- Calendar sync issues were discovered during this phase and resolved in parallel (PRs 26–30)
- Equipment guidance rule system is well-positioned for expansion — zero schema changes needed to add rules
- DRAFT state emerged organically from checkout creation interruption handling; formalize with D-017 brief
