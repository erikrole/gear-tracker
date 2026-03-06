# Feature Brief: Items List + Create + Detail V1

## 1) Feature Header
- Feature name: Items V1 (Tag-First, Policy-Safe)
- Owner: Wisconsin Athletics Creative Product
- Date: 2026-03-02
- Priority: `High`
- Target phase: `Now`

## 2) Problem
- Current pain: Item workflows can become metadata-heavy, inconsistent, and disconnected from operational actions.
- Why now: Dashboard, reservations, and checkout specs are hardened; items now need equivalent list/create/detail rigor.
- Who is blocked: Staff managing inventory quality and students needing reliable read visibility.

## 3) Outcome
- Expected behavior after release: Items list, create, and detail flows are fast, consistent, and aligned to tag-first operational identity.
- Success signal: Operators find and act on items quickly, while status and permission behavior remain correct.

## 4) Scope
### In scope
- Items list page controls, columns, row behavior, and role-based top actions.
- Create item flow with serialized vs bulk mode.
- Item detail page structure with tabs, action header, and side panels.
- Safe metadata/image prefill behavior.
- B&H URL import with server-side metadata extraction and editable prefills.

### Out of scope
- Procurement lifecycle.
- Depreciation accounting.
- Advanced customizable analytics view.
- Bulk mutation actions beyond basic import/export.

## 5) Guardrails (Project Invariants)
- Asset status is derived from active allocations, never authoritative stored status.
- Keep booking integrity protections intact (SERIALIZABLE + overlap prevention).
- Preserve audit logging coverage for new mutation paths.
- Maintain mobile-first usability and clear student flows.
- Do not rewrite booking engine unless explicitly approved.

## 6) Affected Areas
- Domain area: `Assets`
- User roles affected: `ADMIN`, `STAFF`, `STUDENT`
- Location impact: `Mixed`

## 7) Data and API Impact (High-Level)
- Data model impact: no major model rewrite required; enforce item-kind-specific validation and identity constraints.
- Read-path impact: list rows and detail header must display derived status and tag-first identity.
- Write-path impact: create/edit/import/export paths require role and validation guards.
- External integration impact: B&H metadata and image enrichment for supported URLs with partial-result tolerance.

## 8) UX Flow
1. Find item via list filters/search/table.
2. Create new serialized or bulk item through item-kind-guided form.
3. Open detail page for reserve/check-out and workflow context.
4. Edit metadata and policy toggles by role, with audit history.

## 9) Acceptance Criteria (Testable)
1. Item list includes required filters and columns.
2. Serialized rows show `tagName` as primary label.
3. Create form enforces required fields by item kind.
4. Item detail exposes required tabs and side panels.
5. Status displays are derived and cannot be directly edited.
6. Export/import visibility is role-correct.
7. Prefill behavior never overwrites `tagName`.
8. B&H import auto-prefills supported metadata fields from product URL.
9. Users can override B&H-prefilled fields before save.
10. B&H import failure does not block manual creation.
11. Mutations are auditable.
12. Mobile items list behavior follows `AREA_MOBILE.md` (search-first, action-sheet parity).

## 10) Edge Cases
- Missing row thumbnails.
- Duplicate serialized identifiers.
- B&H metadata returns partial fields.
- B&H URL is unsupported or unreachable.
- Student attempts item edit via deep link/API.
- Asset with active allocations receives metadata edit request.

## 11) File Scope for Claude
- Allowed files to modify:
  - `AREA_ITEMS.md`
  - `AREA_MOBILE.md`
  - `AREA_USERS.md`
  - `DECISIONS.md`
- Forbidden files:
  - Any non-doc/config/script/test file not explicitly listed above

## 12) Developer Brief (No Code)
1. Implement item list controls and role-aware top actions.
2. Implement item-kind-aware create flow and validation.
3. Implement item detail information architecture and action mapping.
4. Enforce derived status display and mutation authorization policy.
5. Implement B&H import flow with non-blocking fetch and editable prefills.
6. Add regression tests for identity collisions, permission bypass, and prefill safety.

## 13) Test Plan (High-Level)
- Unit: item-kind validation and role-action matrix.
- Integration: list filtering, create flows, detail actions, and metadata edits.
- Regression: duplicate tag collisions, unauthorized edits, stale status display, and B&H fetch/parser failures.
- Manual validation: table usability, detail navigation, image handling.

## 14) Risks and Mitigations
- Risk: status drift from policy toggles and real allocation state.
  - Mitigation: separate eligibility toggles from derived status display.
- Risk: identity inconsistency from imports and manual edits.
  - Mitigation: enforce serialized identity rules and clear validation errors.

## Claude Handoff Prompt (Copy/Paste)

```text
You are implementing one scoped feature in Gear Tracker.

Rules:
- Do not redesign architecture.
- Honor project invariants exactly.
- Stay within listed allowed files only.
- Keep output concise.

Output format:
1) Plan (<=200 tokens)
2) Open questions (only blockers)
3) Risks
4) Unified diff only

Limits:
- Max files changed: 4
- Max plan tokens: 200
- No unrelated refactors

Project invariants:
- Asset status is derived from active allocations.
- Preserve SERIALIZABLE booking mutation behavior.
- Preserve overlap-prevention constraints.
- Preserve audit logging integrity.

Feature brief:
Use /Users/erole/GitHub/gear-tracker/docs/BRIEF_ITEMS_V1.md as source of truth.

Allowed files:
- /Users/erole/GitHub/gear-tracker/docs/AREA_ITEMS.md
- /Users/erole/GitHub/gear-tracker/docs/AREA_MOBILE.md
- /Users/erole/GitHub/gear-tracker/docs/AREA_USERS.md
- /Users/erole/GitHub/gear-tracker/docs/DECISIONS.md

Forbidden files:
- app code outside allowed list
- prisma schema/migrations
- package.json, tsconfig, next.config, env files
- scripts/tests/CI files
```
