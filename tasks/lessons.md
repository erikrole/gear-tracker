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
