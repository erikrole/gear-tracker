# Prisma Engine-Free Client Migration - 2026-07-04

## Goal

Remove the ~17.5 MB Rust query engine binary from every Vercel Lambda by moving
to Prisma's `prisma-client` generator (query compiler + driver adapter). Smaller
serverless bundle, faster cold starts. No behavior change.

## Why this is a dedicated effort (not a config flip)

- Prisma 6.19: `queryCompiler`/`driverAdapters` are already GA; listing them as
  preview features only emits deprecation warnings and does NOT drop the engine
  binary while the generator stays `prisma-client-js` (verified 2026-07-04:
  `libquery_engine-*.so.node` is still emitted).
- The engine-free path requires the new `prisma-client` generator with an
  explicit `output` path, which changes the import specifier for the client and
  every generated enum/type.
- **201 files** import from `@prisma/client` (133 src, 68 tests) — all must be
  repointed to the generated output path.
- True payoff (cold-start latency) is only observable on a Vercel preview
  deploy; it cannot be proven in this container.

## Slices

- [ ] Slice 1 — generator: switch to `generator client { provider = "prisma-client",
      output = "../src/generated/prisma", runtime = "nodejs", moduleFormat = "cjs" }`
      (confirm moduleFormat against the Next build). Add `src/generated/` to
      `.gitignore`; confirm Vercel `postinstall` (`prisma generate`) regenerates it.
- [ ] Slice 2 — repoint imports: mechanical replace of
      `from "@prisma/client"` → `from "@/generated/prisma"` (or relative) across
      the 201 files. Keep `@prisma/adapter-neon` and `db.ts` as-is.
- [ ] Slice 3 — verify locally: `prisma generate`, `tsc --noEmit`, `npm run lint`,
      `npm test`, `npm run build:app`, `npm run codemap:check`.
- [ ] Slice 4 — verify on Vercel: push a draft PR, confirm the preview deploy
      builds, then compare cold-start/bundle size against a baseline deploy.

## Guardrails

- Do not change `src/lib/db.ts` connection strategy — the pooled `DATABASE_URL`
  + `@prisma/adapter-neon` path is already correct and stays.
- Do not gitignore-then-forget: CI/Vercel must regenerate the client on install.
- Do not merge until the preview deploy build is green — runtime cannot be
  verified in-container.

## Not in scope

- `maxDuration` tuning — no-op on Vercel Hobby (10s cap == default; sub-10s work
  already required). Revisit only on a move to Pro.
- Neon compute settings (scale-to-zero floor / autoscaling) — dashboard-only,
  owner action.
- Next 16 upgrade — tracked separately in `tasks/next16-migration-plan.md`.
