# Plan 018: Compose app error boundaries with shadcn primitives

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8022c88d..HEAD -- src/app/error.tsx src/app/global-error.tsx tests`
> If either error-boundary file changed since this plan was written, compare
> the excerpts below against the live code before proceeding. If the inline
> style/raw-button shape is already gone, mark this plan REJECTED as already
> fixed.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `8022c88d`, 2026-06-11

## Why this matters

The repo standard is shadcn/ui plus semantic Tailwind tokens. The two root
error boundaries are the highest-stress UI states, but they currently bypass
that system with inline styles, raw `<button>` elements, and hardcoded colors.
That makes error recovery look and behave differently from the rest of the app
right when users need a polished fallback. This slice keeps behavior unchanged
while bringing the boundary UI back under the shared component system.

## Current state

- `components.json` declares shadcn style `new-york`, RSC enabled, Tailwind v4 CSS at `src/app/globals.css`, `lucide` icons, and `@/components/ui` aliases.
- `src/components/ui/button.tsx` exports `Button`, with `variant`, `size`, `asChild`, and `loading`. Use this instead of raw buttons.
- `src/components/ui/card.tsx` exports the card composition primitives. Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` for the fallback panel.
- `src/app/global-error.tsx:20-35` currently renders the panel with inline styles:

```tsx
<div style={{ padding: 40, textAlign: "center", maxWidth: 480, margin: "80px auto", fontFamily: "system-ui, sans-serif" }}>
  <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: 12 }}>Something went wrong</h1>
  <p style={{ color: "var(--text-secondary, #6b7280)", marginBottom: 24 }}>
    Try refreshing the page, or sign in again if the issue persists.
  </p>
  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
    <button
      onClick={reset}
      style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--primary, #7c3aed)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
    >
      Try again
    </button>
```

- `src/app/error.tsx:18-75` repeats the same pattern with hardcoded `#fafafa`, `#111`, `#666`, `#ddd`, and a raw `<button>`.
- Preserve `Sentry.captureException(error)` in `global-error.tsx`. Preserve the existing `console.error` in `error.tsx` unless the maintainer says to route it to Sentry too.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused contract | `npm run test -- tests/shadcn-component-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| App build | `npm run build:app` | exit 0, Next build succeeds |
| Whitespace | `git diff --check` | exit 0 |

Do not use `npm run build` for this plan. It runs the Prisma migration deploy
wrapper and can touch a live Neon database. `npm run lint` is also not a useful
gate in this repo right now because `next lint` prompts for config.

## Scope

**In scope**:
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `tests/shadcn-component-contracts.test.ts` (create if absent)

**Out of scope**:
- Sentry behavior beyond preserving the existing capture call.
- Route-level `not-found.tsx` pages.
- Any design-system changes under `src/components/ui/`.
- Any user-facing copy rewrite beyond preserving current meaning.

## Git workflow

- Branch: `advisor/018-shadcn-error-boundaries`
- Commit message example: `fix: render error recovery with shared UI primitives`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace inline fallback panels with Card and Button

In both `src/app/error.tsx` and `src/app/global-error.tsx`:

1. Import `Button` from `@/components/ui/button`.
2. Import `Card`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, and `CardTitle` from `@/components/ui/card`.
3. Keep the required `<html lang="en"><body>...</body></html>` wrapper.
4. Replace inline style objects with Tailwind classes using semantic tokens:
   - body: `min-h-screen bg-background text-foreground`
   - shell: centered flex layout with padding
   - card: `w-full max-w-md`
5. Use `<Button type="button" onClick={reset}>Try again</Button>` for retry.
6. Use `<Button asChild variant="outline"><a href="...">...</a></Button>` for navigation.

Keep the existing destinations:
- `global-error.tsx`: Sign in link goes to `/login`.
- `error.tsx`: Go home link goes to `/`.

**Verify**: `rg -n "style=|<button|#[0-9a-fA-F]{3,6}|var\\(--text-secondary|var\\(--primary" src/app/error.tsx src/app/global-error.tsx` returns no matches.

### Step 2: Add a source contract test

Create `tests/shadcn-component-contracts.test.ts` using the existing source-read pattern from `tests/ios-api-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}
```

Add a test named `keeps root error boundaries on shared UI primitives` that:
- Reads `src/app/error.tsx` and `src/app/global-error.tsx`.
- Expects both files to import `@/components/ui/button`.
- Expects both files to import `@/components/ui/card`.
- Expects both files to contain `<Button`.
- Expects neither file to contain `<button`.
- Expects neither file to contain `style={{`.
- Expects `src/app/global-error.tsx` to still contain `Sentry.captureException(error)`.

**Verify**: `npm run test -- tests/shadcn-component-contracts.test.ts` exits 0.

### Step 3: Run the app gates

Run:

```bash
npx tsc --noEmit
npm run build:app
git diff --check
```

All three commands must exit 0.

## Test plan

- New source contract test in `tests/shadcn-component-contracts.test.ts`.
- Existing app typecheck and build prove the error boundaries still compile in Next.
- No browser smoke is required because these files render only on error paths, and the plan changes static composition without state logic.

## Done criteria

- [ ] `rg -n "style=|<button|#[0-9a-fA-F]{3,6}|var\\(--text-secondary|var\\(--primary" src/app/error.tsx src/app/global-error.tsx` returns no matches
- [ ] `npm run test -- tests/shadcn-component-contracts.test.ts` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build:app` exits 0
- [ ] `git diff --check` exits 0
- [ ] No files outside the in-scope list are modified, except `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Next rejects shadcn imports from `src/app/error.tsx` or `src/app/global-error.tsx` for framework-specific error-boundary reasons.
- The error-boundary files no longer match the inline-style/raw-button excerpts.
- The fix appears to require editing global CSS or shadcn primitive files.

## Maintenance notes

If future error pages are added, keep them on the same Card and Button pattern.
The source contract intentionally checks only the root boundaries so it stays
cheap and does not block purposeful local design work elsewhere.
