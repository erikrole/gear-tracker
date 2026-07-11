# Resources Ownership Pass - 2026-07-10

## Goal
- Make the guide library, references, reader, and authoring flows trustworthy, recoverable, responsive, and visually consistent without changing the guide-first information architecture.

## Peer patterns checked
- Items: named partial failures, preserved healthy data, and retry actions.
- Users: PageHeader action hierarchy and URL-backed filtering.
- Resources reader: preserve the specialized editorial layout and section navigation.

## Plan
- [x] Audit landing, reader, new/edit flows, APIs, schema, docs, tests, and peer patterns.
- [x] Restore a real URL-backed library search while keeping the command palette as quick navigation.
- [x] Add scoped guide/contact failure states and retry paths.
- [x] Harden create/edit navigation, loading failures, and action hierarchy.
- [x] Improve copy feedback without changing authorization or audience semantics.
- [x] Add focused tests, sync docs, and run repository/browser verification.

## Contract boundaries
- Guides remain the primary Resources surface; Contacts, assignments, and server path stay supporting references.
- Publication controls visibility. Target roles/areas remain recommendation metadata, not authorization.
- Staff/Admin create and edit; only Admin deletes. Optimistic concurrency remains required in edit mutations.

## Review
- Shipped real URL-backed filter UI plus separate Quick find, named retryable guide/reference failures, preserved partial guide results, new-guide discard protection, edit load/ownership recovery, sticky authoring actions, and visible Media Drive copy failure recovery.
- Verified 26 focused Resources tests, focused ESLint, TypeScript, all 93 migration prefixes, codemap/docs, whitespace, and `npm run build:app`.
- Authenticated Chrome rendered the updated Resources toolbar at desktop width with no console errors. The local React runtime accepted input text but did not commit either the debounce or Enter action to the URL, and guide/API data stayed in its loading shell. After two interaction attempts, browser proof stopped per the project workflow. The source contract and production build are green, but authenticated filter/result and narrow-width runtime proof are not claimed.
- Deferred reader verification-timestamp semantics and mobile ToC remain separate follow-ups because they require a content-freshness contract and reader-navigation design, not a safe UI-only patch.
