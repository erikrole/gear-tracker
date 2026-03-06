# Checkout UX V2 — Thin Slice 1

## Plan

1. **checkout-rules.ts** — Pure function `getAllowedActions(actor, booking)` returns set of permitted actions. Encodes state×role×ownership matrix from BRIEF_CHECKOUT_UX_V2.md and AREA_USERS.md.
2. **Apply gating** — Guard every checkout mutation endpoint (cancel, edit, extend, complete-checkin) with checkout-rules check.
3. **Event-default prefill** — On checkout POST, if `sportCode` provided but no `eventId`, auto-lookup next upcoming event and prefill title/dates/location.
4. **Partial check-in** — New `checkinItems` service: marks individual serialized items returned (allocationStatus→"returned", allocation.active→false). Auto-completes booking when zero active allocations remain.
5. **Tests** — Unit tests for checkout-rules and partial-checkin logic.

## Open Questions
None — all rules are specified in the docs.

## Risks
- Event lookup returns stale/no events → handled by ad hoc fallback (proceed without event link).
- Partial check-in race with concurrent returns → mitigated by SERIALIZABLE transaction.

## Checklist
- [ ] Create `src/lib/services/checkout-rules.ts`
- [ ] Apply gating to cancel, edit, extend, complete-checkin endpoints
- [ ] Event-default prefill in checkout creation
- [ ] Partial check-in service + route
- [ ] Tests
- [ ] Verify compilation
