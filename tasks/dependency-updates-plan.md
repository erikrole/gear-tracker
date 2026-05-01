# Dependency Updates — Plan

Branch: `claude/update-dependencies-vFwtV`

Per CLAUDE.md §10 (Thin Slice Protocol): one slice per concern, each independently mergeable.

## Slice 1 — Safe minors/patches (this slice)

In-range bumps that npm will pick up via `npm update`:

- `@sentry/nextjs` 10.50.0 → 10.51.x
- `@tanstack/react-query` + persister + sync-storage 5.100.1 → 5.100.6
- `postcss` 8.5.10 → 8.5.13
- `zod` 3.24.2 → 3.25.76 (still v3, no breaking)

Plus reconcile the `@next/bundle-analyzer@^16` vs `next@^15` mismatch in `package.json` — pin analyzer back to `^15` for now; we'll re-bump when Next 16 lands in Slice 5.

Verify: `npm run build` must pass. `npm test` must pass.

## Slice 2 — `lucide-react` 0.577 → 1.14

First stable major. Likely some renamed/removed icon exports. Strategy:
1. Bump in package.json
2. `npm run build` to surface broken imports
3. Fix renames per upstream changelog
4. Visual smoke check on a couple of icon-heavy pages

## Slice 3 — Prisma 6 → 7

Touches: `prisma`, `@prisma/client`, `@prisma/adapter-neon`. Critical because all DB access flows through this. Strategy:
1. Read v7 release notes for breaking changes (driver-adapter API, query-engine binary changes)
2. Bump all three together
3. `npx prisma generate`, `npm run build`
4. Run vitest suite — DB-touching unit tests are the canary
5. Manual smoke on a Neon-backed dev DB before merge

## Slice 4 — Zod 3 → 4

Major API-surface changes. Strategy:
1. Read Zod 4 migration guide
2. Bump
3. Use `tsc --noEmit` to surface every breakage
4. Apply codemod where mechanical; hand-fix the rest
5. `npm test` — `lib/validators/*` should have decent coverage

## Slice 5 — Next 15 → 16

Biggest one. Async dynamic APIs, caching default flips, route handler changes. Strategy:
1. Read Next 16 upgrade guide; run their codemod
2. Bump `next` + `@next/bundle-analyzer` together
3. Fix async `params`/`searchParams`/`cookies()`/`headers()` call sites
4. Audit `fetch()` + `unstable_cache` call sites for new caching defaults
5. `npm run build`, then dev-server smoke test

## Verification gates

Each slice must pass before commit:
- `npm run build` (CLAUDE.md §8 — never leave broken build)
- `npm test`
- Conventional commit (CLAUDE.md §9): `chore:` for dep bumps, `fix:` if a breaking change required code edits

## Doc sync (CLAUDE.md §12)

After Slice 5 ships, update `docs/DECISIONS.md` if any architectural change resulted (e.g. caching strategy after Next 16).
