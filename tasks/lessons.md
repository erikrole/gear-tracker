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
