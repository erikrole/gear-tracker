# Release Verification

Last updated: 2026-07-03

This is the repo-level closeout guide for backend, web, and native slices. Use it with the active task plan for the feature area.

## Default Local Closeout

For ordinary app/backend work, run these before calling the slice done:

```bash
npx vitest run <focused test files>
npx tsc --noEmit --pretty false
npm run codemap
npm run verify:docs
git diff --check
npm run build:app
```

`npm run build:app` is the safe local app compile gate. It runs `next build` only.

`npm run build` is a deploy-shaped gate. It runs `node scripts/prisma-migrate-deploy.mjs && next build`, which can apply pending migrations to the configured Neon database. Run it only when the task is explicitly validating deployment or migration readiness and remote database mutation has been approved.

## Database Gates

Run these when schema, migrations, Prisma client shape, SQL assumptions, or migration tooling changed:

```bash
npm run db:migrate:check
npx prisma validate
npx prisma generate
```

Use the live Neon checks only for migration or production-drift work:

```bash
npm run db:migrate:health
npm run db:migrate:deploy
```

`db:migrate:health` is read-only. `db:migrate:deploy` can mutate the remote database.

## Browser And Deploy Proof

Tests and builds are not enough when the slice changes runtime behavior in a browser. Add browser proof when work touches:

- route rendering, redirects, cookies, middleware, CSP, headers, or auth/session behavior
- cache or freshness behavior that could show stale rows after navigation, refresh, tab switch, or focus return
- visible UI layout, responsive behavior, forms, dialogs, keyboard paths, or interaction polish
- public pages, SEO/social metadata, or unauthenticated flows

Use local authenticated browser smoke for app workflows. Use deploy smoke for production/public behavior:

```bash
npm run smoke:deploy
DEPLOY_SMOKE_BASE_URL=https://<deployment> npm run smoke:deploy
```

Set `DEPLOY_SMOKE_EMAIL` and `DEPLOY_SMOKE_PASSWORD` when authenticated deploy checks are required.

## iOS Gates

When Swift files, iOS-used API response shapes, native models, app navigation, or kiosk code changed, run:

```bash
npm run drift:ios
npm run audit:ios:gaps
```

Then compile the touched target. Prefer XcodeBuildMCP when available. Otherwise use:

```bash
npm run ios:xcode:verify
IOS_SKIP_DEVICE_BUILD=1 npm run ios:xcode:verify
```

For visual, navigation, HIG, camera, APNs, haptics, Bluetooth HID scanner, VoiceOver, Dynamic Type, or hardware-dependent changes, simulator/source proof is not enough. Capture simulator proof for visual work and use `docs/IOS_DEVICE_WALKTHROUGH.md` before TestFlight or real-device claims.

## When To Escalate The Gate

Use the narrowest gate that proves the change:

- API/service change: focused route/service tests, TypeScript, docs, whitespace, `build:app`
- Schema/migration change: add migration checks, Prisma validate/generate, and read-only health when production drift matters
- Web UI change: add browser proof for the changed route or flow
- Public/deploy behavior: add deploy smoke against the target environment
- Native iOS change: add iOS drift, audit gap check, and simulator compile
- Release candidate: combine focused tests, full app build, migration health, deploy smoke, iOS gates if touched, and the relevant manual QA checklist

Record the exact commands and any known unrelated warnings in `tasks/todo.md` and the relevant `docs/AREA_*.md` change log.
