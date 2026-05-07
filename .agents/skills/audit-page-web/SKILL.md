---
name: audit-page-web
description: Full MVP-readiness audit for a single web page in the gear-tracker app. Use when the user runs `/audit-page-web <page>` or asks to "audit the licenses page", "is the dashboard ready to ship", "MVP audit on web", or similar. Produces a record file in tasks/, presents findings in chat grouped by severity, then waits for fix/skip/defer decisions before touching code. Ship bar = all staff + students, zero hiccups.
---

# audit-page-web

Audits a single Next.js page route in this repo against the MVP ship bar: **all staff and students, zero hiccups**. Diagnose-only until the user approves fixes in chat.

## Invocation

```
/audit-page-web <page>
```

`<page>` matches a route under `src/app/(app)/<page>/` (e.g. `licenses`, `scan`, `dashboard`, `checkouts`, `kits`, `items`, `events`, `reservations`, `users`, `settings`, `reports`, `bulk-inventory`, `kiosk`).

If the user gives a route path (`/licenses`) strip the slash. If ambiguous, ask once.

## Mandatory pre-audit reads (Rule 7)

Before writing any finding, read all of these — no shortcuts:

1. `docs/AREA_<PAGE>.md` (uppercase) — acceptance criteria, change log, known gaps
2. `docs/BRIEF_*.md` — any brief whose name matches the feature area
3. `prisma/schema.prisma` — models, fields, cascade rules touching this page
4. `docs/DECISIONS.md` — prior architectural choices for this area
5. `docs/GAPS_AND_RISKS.md` — pending decisions or known gaps for this area
6. `src/app/(app)/<page>/page.tsx` and every sibling component fully (Rule 15: no partial reads)
7. Every API route under `src/app/api/<page>/**` referenced by the page
8. `src/lib/services/<page>.ts` if it exists
9. `tasks/<page>-*.md` and `tasks/audit-<page>-*.md` history if present

If `docs/AREA_<PAGE>.md` doesn't exist, flag that as a P0 finding (every shipping area must have one) and proceed using the code as the source of truth.

## The six lenses

Audit in this order. Every finding gets a lens tag.

### 1. Gaps
- Walk every acceptance criterion in `AREA_<PAGE>.md`. For each: met / partial / missing / not-yet-applicable. Cite the file/line that proves it.
- Anything in `GAPS_AND_RISKS.md` for this area still open?
- Any `BRIEF_*` requirement not yet shipped?

### 2. Flows
- Enumerate every interactive element on the page (buttons, links, menu items, row actions, form fields, keyboard shortcuts).
- For each: trace the full state change sequence. Where does it land? What changes server-side? What does the user see confirm it?
- For each list/table: verify **0, 1, many, very-many** states render correctly.
- For each async action: verify **loading**, **empty**, **error**, **success** states all exist.
- Dead ends? (action with no confirmation, no toast, no row update)
- Destructive actions without confirm? Misclick risk?
- Keyboard: can a power user staff member operate the page without a mouse for the golden path?

### 3. UI polish
- Spacing and breathing room — does it feel cramped? (User has corrected this repeatedly.)
- Placeholder text still showing where labels would suffice — delete.
- Stub names in screenshots/seeds/empty states ("Hallie Utter", truncated emails) — replace with real-looking copy or proper empty-state component.
- Helper text under inputs that doesn't earn its keep — delete.
- Density: matches the rest of the site or noticeably tighter/looser?
- Hierarchy: primary action obvious? Secondary actions appropriately demoted?
- Copy: would a student understand it without context? Would a teacher?
- shadcn standard (Rule 13): any custom primitive that should be a shadcn component?

### 4. Hardening
- Every API route: auth check present? Role check matches the page's RBAC intent?
- Server-side authorization, not just UI hiding (Rule 7 of MVP rubric).
- Rate limiting on mutations that could be abused (esp. anything a student can hit).
- Rate limiting on export endpoints.
- Race conditions: two users editing the same row, two tabs claiming the same slot, double-submit on slow networks.
- Input validation: zod schemas on every body, query, and param.
- N+1 queries (Rule 8 — Vercel timeout pressure).
- Prisma cascade rules sane for delete operations on this page's models.
- Error responses don't leak internals (stack traces, query strings, user emails of unrelated users).
- CSRF: mutations are POST/PATCH/DELETE not GET, and Next.js form defaults are honored.

### 5. Breaking
Try to break it on paper:
- Slow network: does the UI lock, double-submit, or look broken?
- Expired session mid-action: clean redirect or confused state?
- Role downgraded mid-session: still showing admin actions?
- Concurrent edits: last-write-wins silently, or conflict surfaced?
- Empty datasets / zero permissions / first-time user: does the page look intentional or broken?
- Long strings, emoji, RTL, very long names — overflow, truncation, layout break?
- Pagination edge: page=0, page=99999, negative, non-numeric.
- CSV/export with 0 rows, 1 row, 10k rows — timeout? Memory?
- Kiosk mode interaction (if relevant — see `KioskStore`).

### 6. Parity (informational only — not blocking)
- What does this page do that the iOS app does not? List it.
- What does iOS do that web does not? List it.
- These become P2 findings unless the missing capability blocks a student golden path.

## Severity rules

**P0 — blocks ship**
- Silent data loss
- Auth bypass / RBAC enforced only in UI
- Broken golden path for any role (staff, admin, student)
- Crash, 500, or infinite loading on common input
- Anything that would make a teacher email about it on day one
- Missing `AREA_<PAGE>.md` or its core acceptance criteria unmet

**P1 — student-visible polish; ship bar requires zero**
- Visible jank, layout breaks, missing loading/empty/error states
- Placeholder text or stub names visible in shipping UI
- Copy that confuses a student
- Density/spacing regressions the user has corrected before
- Destructive actions without confirm

**P2 — post-MVP**
- Parity gaps (unless blocking a student core flow)
- Nice-to-have polish
- Future-feature scaffolding
- Power-user keyboard shortcuts (web is power-user hub but not blocking)

## MVP verdict rule

Ready ⇔ ALL of:
- 0 P0 findings
- 0 P1 findings with student-visible impact
- All `AREA_<PAGE>.md` acceptance criteria met (cited)
- Every interactive element has loading + empty + error states
- RBAC enforced server-side, not just hidden in UI
- No console errors on golden path (verify by running dev server if practical)

Otherwise: **NOT READY** with the blocker count.

## Output: the record file

Write to `tasks/audit-<page>-web.md` (overwrite if exists; the prior version is in git):

```markdown
# Audit: /<page> (web) — <YYYY-MM-DD>

**MVP verdict:** READY | NOT READY — N P0, M P1
**Ship bar:** all staff + students, zero hiccups

## P0 — blocks MVP
- [ ] [Lens] One-line finding — `path/to/file.tsx:LINE`
      Why it blocks ship: <one sentence>
      Suggested fix: <one sentence>

## P1 — polish before ship
- [ ] [Lens] ... (same shape)

## P2 — post-MVP
- [ ] [Lens] ...

## Acceptance criteria status (from AREA_<PAGE>.md)
- [x] Criterion 1 — proven by `file:line`
- [ ] Criterion 2 — partial: <gap>
- [ ] Criterion 3 — missing

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- list every file actually opened during audit

## Notes
- anything else worth recording for next time
```

## Chat presentation (what the user sees)

After writing the file, present in chat in this exact shape — do not paste the markdown, restructure for readability:

```
Audit: /<page> (web) — MVP verdict: <READY | NOT READY (N P0, M P1)>
Record: tasks/audit-<page>-web.md

P0 — blocks ship
  1. [Lens] One-line finding
     path/to/file:line
     Why: <reason>
  2. ...

P1 — polish before ship
  3. ...

P2 — post-MVP (informational)
  4. ...

Reply with decisions (e.g. "fix 1-3, skip 4, defer 5-6").
```

If the verdict is READY with no P0 or P1, say so plainly and offer the P2 list as optional.

## Fix loop (only after explicit approval)

When the user replies with fix decisions:

1. Re-read the audit file as the source of truth.
2. Group approved fixes into thin slices per Rule 10 (schema → API → UI → tests → hardening). Maximum one PR per slice; if approved fixes span concerns, ask whether to ship multiple PRs or bundle.
3. For each slice:
   - Implement
   - Run `npm run build` (Rule 8 — never leave a broken build)
   - Update `docs/AREA_<PAGE>.md` change log + tick acceptance criteria in the same commit (Rule 12)
   - Update `docs/GAPS_AND_RISKS.md` if a gap closed
   - Update `tasks/lessons.md` if a correction-worthy pattern emerged
4. Commit per Rule 9 conventional-commits format. Outcome-focused messages.
5. Open ONE PR per slice (gh pr create). PR description = the audit file's relevant findings, with checked items.
6. Mark addressed findings `[x]` in `tasks/audit-<page>-web.md` and commit that update.

If the user says "fix all", treat that as approval for every P0 and P1 only — never auto-include P2 without explicit ack.

## Hard rules

- Never auto-fix during audit. Audit is read-only diagnostics.
- Never invent acceptance criteria not in `AREA_<PAGE>.md`.
- Never cite a file:line you didn't actually read this session.
- If a finding requires uncertainty, mark it `?` and explain — better than false confidence.
- Re-read the user's last message before each substantive turn (Rule 15).
- After 2 consecutive build failures or approach failures: stop, summarize, ask for guidance (Rule 15).
- Honor the user's taste corrections without re-litigating: drop placeholders, more breathing room, no stub names, prefer minimal labels, delete unearned helper text.

## What this skill is NOT

- Not a refactor pass — fix only what's in approved findings
- Not a feature-add pass — gaps in `AREA_<PAGE>.md` are flagged, not extended
- Not a perf optimization sweep unless perf is a P0/P1
- Not iOS — use `audit-page-ios` for that
- Not a full page ownership pass. If the user asks to take a page end to end, touch every surface, run UX/UI/consistency/hardening work, compare peer pages, implement improvements, or flag patterns other pages should adopt, use `page-ownership-pass`.
