# Plan 057: Centralize server-backed report CSV downloads

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If a STOP condition occurs, stop and report it. Do not improvise. When done, update plan 057 in `plans/README.md` unless a reviewer says they own the index.
>
> **Drift check (run first)**: `git diff --stat 189ea5ab..HEAD -- 'src/app/(app)/reports/report-export.ts' 'src/app/(app)/reports/audit/page.tsx' 'src/app/(app)/reports/bulk-losses/page.tsx' 'src/app/(app)/reports/checkouts/page.tsx' 'src/app/(app)/reports/overdue/page.tsx' 'src/app/(app)/reports/scans/page.tsx' 'src/app/(app)/reports/utilization/page.tsx' tests/report-export-copy.test.ts`
> Also run `git status --short -- <the same paths>`. If any are dirty, STOP. These report pages were part of an active UI slice when this plan was authored.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none, but wait for the active report UI worktree changes to be committed or otherwise reconciled
- **Category**: tech-debt
- **Planned at**: commit `189ea5ab`, 2026-07-16

## Why this matters

Six report pages independently implement the same server-backed CSV download sequence: fetch, session redirect, failure parsing, Blob creation, filename extraction, temporary anchor cleanup, export-count headers, truncation messaging, and network failure messaging. `report-export.ts` already owns the parsing and copy helpers, so leaving orchestration in every page creates lockstep maintenance and inconsistent failure risk. This plan creates one browser download function without changing report URLs, CSV contents, response headers, button labels, or user-facing copy.

## Current state

- `src/app/(app)/reports/report-export.ts` owns CSV escaping, filename parsing, completion-toast construction, and response-failure parsing, but not the download itself.
- Each of the following pages repeats the orchestration with only URL and labels changed:
  - `audit/page.tsx`
  - `bulk-losses/page.tsx`
  - `checkouts/page.tsx`
  - `overdue/page.tsx`
  - `scans/page.tsx`
  - `utilization/page.tsx`
- Representative current block at `checkouts/page.tsx:119`:

```ts
const res = await fetch(`/api/reports/checkouts?${params.toString()}`);
if (handleAuthRedirect(res, "/reports/checkouts")) return;
// parse error, create Blob URL, click temporary anchor, read X-* headers,
// then show success/warning/error toast
```

- `tests/report-export-copy.test.ts` directly tests the pure copy/parsing helpers and separately pins source strings in individual pages.
- Authentication redirects use `handleAuthRedirect` from `src/lib/errors.ts`. Preserve that behavior exactly.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/report-export-copy.test.ts` | all tests pass |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0, no errors |
| Lint | `npx eslint 'src/app/(app)/reports/report-export.ts' 'src/app/(app)/reports/audit/page.tsx' 'src/app/(app)/reports/bulk-losses/page.tsx' 'src/app/(app)/reports/checkouts/page.tsx' 'src/app/(app)/reports/overdue/page.tsx' 'src/app/(app)/reports/scans/page.tsx' 'src/app/(app)/reports/utilization/page.tsx' tests/report-export-copy.test.ts` | exit 0 |
| App build | `npm run build:app` | Next build succeeds without migration deployment |
| Docs | `npm run codemap && npm run verify:docs` | codemaps regenerate and verification exits 0 |

## Scope

**In scope**:

- `src/app/(app)/reports/report-export.ts`
- The six report page files listed above
- `tests/report-export-copy.test.ts`
- Generated codemaps only if `npm run codemap` changes them

**Out of scope**:

- API report routes and `src/lib/services/reports.ts`
- CSV row shape, export limits, filenames supplied by the server, or response headers
- Report charts, layout, colors, filters, queries, or general UI polish
- Client-generated exports that do not use the server-backed report headers

## Git workflow

- Suggested branch: `codex/057-centralize-report-csv-downloads`
- Use a conventional commit if asked to commit: `refactor: centralize report CSV downloads`
- Do not stage, commit, push, or open a PR unless explicitly instructed.

## Steps

### Step 1: Add one typed download function

In `report-export.ts`, add a client-safe exported function such as `downloadServerReportCsv`. It should accept one object containing:

- `url`
- `returnTo`
- `reportLabel`
- `scopeLabel`
- `fallbackFilename`
- `networkFailureMessage`

The function must perform the existing sequence exactly once. Return a discriminated result such as `{ status: "downloaded" | "redirected" | "failed"; toast?: ReportExportToast; error?: string }` instead of importing `sonner` into the utility. This keeps UI notification ownership in the pages and makes the helper testable. It must revoke the object URL and remove the temporary anchor in `finally`-safe cleanup.

**Verify**: `npx vitest run tests/report-export-copy.test.ts` → existing tests still pass before caller migration.

### Step 2: Add behavior-level helper tests

Extend `tests/report-export-copy.test.ts` with mocked `fetch`, `URL.createObjectURL`, `URL.revokeObjectURL`, and anchor-click behavior. Cover:

1. Successful download with encoded server filename.
2. Successful truncated export returning a warning toast.
3. JSON and plain-text failure bodies.
4. Authentication redirect result.
5. Network failure result.
6. Object URL and anchor cleanup.

Avoid asserting local variable names or exact implementation strings.

**Verify**: `npx vitest run tests/report-export-copy.test.ts` → all old and new cases pass.

### Step 3: Migrate all six report pages

Replace each local orchestration block with its parameter construction plus a call to the shared function. Keep each page responsible for report-specific URL construction, the return path, labels, fallback filename, and showing the returned success/warning/error toast. Remove now-unused imports from `sonner` or `src/lib/errors` only when the page no longer uses them elsewhere.

Do not change `ReportExportButton` props or active-filter behavior.

**Verify**: `rg -n 'URL\.createObjectURL|Content-Disposition|X-Exported-Count' 'src/app/(app)/reports' --glob 'page.tsx'` → no matches in the six migrated pages.

### Step 4: Replace brittle per-page source assertions

Remove source-text checks that merely prove each page contains `readReportExportFailureMessage` or a specific fetch literal. Retain assertions for user-facing button scope only if they remain valuable, and rely on the new helper behavior tests plus TypeScript for orchestration.

**Verify**: focused test, lint, typecheck, app build, codemap/docs, and `git diff --check` all pass.

## Test plan

- Extend `tests/report-export-copy.test.ts` using its existing pure-helper structure.
- Test the shared orchestration once; do not duplicate the same mock sequence per page.
- Preserve the existing formula-injection, filename, completion-copy, and failure-body tests.

## Done criteria

- [ ] One helper owns the complete server-backed CSV download sequence.
- [ ] All six report pages call it and retain their existing URLs and copy.
- [ ] No migrated page directly creates or revokes a Blob URL.
- [ ] Focused tests, TypeScript, lint, `build:app`, docs verification, and `git diff --check` pass.
- [ ] No files outside scope are modified.
- [ ] Plan 057 status is updated.

## STOP conditions

- Any in-scope report file has uncommitted changes when execution starts.
- Current response headers or route URLs differ from the plan.
- The refactor requires changing an API route or CSV row shape.
- A verification command fails twice after a reasonable correction.

## Maintenance notes

Future server-backed reports should call this helper rather than copying browser download plumbing. Reviewers should compare the report-specific parameter values before and after migration, especially return paths and scope labels.

