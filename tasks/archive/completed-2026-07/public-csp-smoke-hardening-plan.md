# Public CSP and Deploy Smoke Hardening Plan

## Scope
Close GAP-60 by replacing the public showroom emergency `script-src 'unsafe-inline'` production allowance with a nonce-based CSP for rendered HTML routes, then add a reusable deploy smoke script that can verify public pages and a seeded login path.

## Slice
- [x] Restore middleware-owned CSP for HTML routes with one fresh nonce per request.
- [x] Make the root layout read `x-nonce` and attach it to first-party boot scripts.
- [x] Remove the production inline-script allowance from `next.config.ts`.
- [x] Add source-contract coverage for nonce CSP and the public/deploy smoke script.
- [x] Add `npm run smoke:deploy` for public route checks plus optional seeded-login checks.
- [x] Sync Public Showroom and risk docs, including the static-to-dynamic rendering tradeoff.
- [x] Verify with focused tests, TypeScript, docs check, whitespace check, app build, and local smoke where available.

## Review
- 2026-07-02: GAP-60 closed locally. Middleware now generates a fresh nonce and CSP for rendered HTML routes, the root layout reads `x-nonce` and attaches it to `/theme-init.js` and `/sw-init.js`, and `next.config.ts` no longer emits the CSP fallback with production `unsafe-inline`. Added `npm run smoke:deploy`; local production smoke passed against `http://localhost:3003` using the seeded admin login. Verified: `node --check scripts/deploy-smoke.mjs`, focused public showroom Vitest, TypeScript, codemap/docs check, whitespace check, `npm run build:app`, and `DEPLOY_SMOKE_BASE_URL=http://localhost:3003 npm run smoke:deploy`.

## Notes
- Next.js nonce CSP requires dynamic rendering because static HTML cannot receive a per-request nonce. This is an intentional hardening tradeoff for the public showroom and root shell.
- Local dev may use the seeded admin login defaults. Non-local smoke must receive credentials through environment variables.
