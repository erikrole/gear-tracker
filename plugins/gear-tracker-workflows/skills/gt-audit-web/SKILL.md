---
name: gt-audit-web
description: Gear Tracker web readiness audit. Use when the user runs /gt-audit-web, asks to audit a web page, asks if a route is ready to ship, or wants findings before fixes.
---

# /gt-audit-web

Run a read-only audit of one web route. Do not fix during the audit.

## Required Reads

1. Relevant `docs/AREA_*.md`
2. Relevant `docs/BRIEF_*.md`
3. `docs/DECISIONS.md`
4. `docs/GAPS_AND_RISKS.md`
5. `prisma/schema.prisma`
6. Target route and sibling components in full
7. Referenced API routes, services, hooks, and tests
8. Prior `tasks/*<route>*audit*.md`

## Lenses

- Gaps against area acceptance criteria and open risk notes
- Flows for every interactive element
- UI polish, copy, placeholder text, density, shadcn usage
- Hardening for auth, RBAC, validation, transactions, rate limits, N+1, exports
- Breaking cases: slow network, expired session, role downgrade, empty data, long strings, pagination
- Web/iOS parity as informational only

## Output

Write `tasks/audit-<route>-web.md` with P0/P1/P2 findings, acceptance criteria status, files read, and notes.

Chat response should lead with:

```text
Audit: /<route> (web) - MVP verdict: READY | NOT READY
Record: tasks/audit-<route>-web.md
```

Then list findings by severity. Ask for fix, skip, or defer decisions.

## Severity

- P0: auth bypass, data loss, broken golden path, common crash/500, missing area doc.
- P1: student-visible or staff-visible jank, missing loading/error states, confusing copy, destructive action without confirm.
- P2: non-blocking parity or future polish.
