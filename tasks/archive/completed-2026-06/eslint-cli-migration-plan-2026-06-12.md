# ESLint CLI Migration Plan

Date: 2026-06-12

## Goal

Replace the deprecated interactive `next lint` command with a modern ESLint CLI gate for this Next.js app.

## Scope

- Add the official Next ESLint flat config.
- Install ESLint and the matching Next 15 ESLint config package.
- Change `npm run lint` to run the ESLint CLI.
- Verify lint runs non-interactively.

## Checklist

- [x] Install `eslint` and `eslint-config-next`.
- [x] Pin `eslint-config-next` to the Next 15 line used by the app.
- [x] Add `eslint.config.mjs`.
- [x] Replace `next lint` with `eslint .`.
- [x] Run lint and record the resulting baseline.

## Review

- 2026-06-12: `npm run lint` now runs non-interactively through ESLint CLI and exits cleanly. The current baseline is 0 errors and 517 warnings, mostly existing `any`, unused symbol, hook dependency, and image optimization warnings.
- 2026-06-12: The initial hard failures were fixed in source: JSX text escaping in kit/event/license sheets, `next/link` usage in the root error page, and `prefer-const` findings in heatmap and calendar sync.
- 2026-06-12: `@typescript-eslint/no-explicit-any` is intentionally warning-level for the first gate so inherited test/service typing debt stays visible without blocking every repo operation on day one.
