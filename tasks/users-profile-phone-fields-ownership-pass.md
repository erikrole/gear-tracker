# User Profile Phone Fields Ownership Pass - 2026-07-15

## Goal
- Show and edit Personal phone and Work phone as distinct fields on web user profiles.
- Keep the legacy `phone` compatibility value synchronized to Personal phone without guessing the type of unclassified legacy numbers.

## Scope
- Route: `/users/[id]`, plus the existing `/settings/profile` editor.
- APIs: `/api/users/[id]`, `/api/profile`, and `/api/me/profile`.
- Schema: existing `personal_phone`, `work_phone`, and `work_phone_not_applicable` columns from migration 0092. No new migration.

## Peer Patterns Checked
- `/users/[id]` existing `TextInputField` and `SaveableField` inline profile editing.
- `/settings/profile` explicit form save and profile-query cache synchronization.
- `/items/[id]` and `/kits/[id]` saveable detail-field composition for compact editable cards.

## Slices
- [x] Return both phone fields from user-detail and self-profile APIs.
- [x] Allow approved self/staff profile edits while synchronizing Personal phone to legacy `phone`.
- [x] Render both fields on the canonical user profile and Settings profile page.
- [x] Refresh profile-completion state after either field changes.
- [x] Add focused API/source regression coverage and sync Users documentation.

## Verification
- [x] Focused tests: 29 passed across profile fields, completion, Users API, wrappers, and PII scope.
- [x] TypeScript and focused ESLint.
- [x] Prisma migration check: 95 migrations with no collisions or malformed folders.
- [x] Codemap/docs and `git diff --check`.
- [x] Clean production Next build with lint verified independently; all 198 static pages generated.
- [ ] Authenticated desktop browser proof, or a concrete blocker.

## Review
- Shipped: Separate Personal phone and Work phone fields on `/users/[id]` and `/settings/profile`; all three profile update routes support both values; Personal phone stays synchronized to legacy `phone`; clearing Work phone records the explicit no-work-phone state; completion queries refresh after edits.
- Privacy: New audit diffs retain only masked phone suffixes, not complete phone numbers.
- Compatibility: Existing callers that still write `phone` update Personal phone too. Unclassified legacy phone values are not guessed into either new field.
- Blocked proof: No isolated Playwright base URL or credentials are configured, so authenticated browser interaction was not claimed.
