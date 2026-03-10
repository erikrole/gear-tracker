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
