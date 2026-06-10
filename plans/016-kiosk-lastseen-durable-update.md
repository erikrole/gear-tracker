# Plan 016: Make the kiosk lastSeenAt update durable on serverless

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- src/lib/auth.ts tests/kiosk-session-auth.test.ts`
> If either file changed since this plan was written, compare the
> "Current state" excerpt against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why this matters

`requireKiosk()` updates the device's `lastSeenAt` with a fire-and-forget promise. On Vercel's Node serverless runtime, execution can be frozen as soon as the response is returned, so this UPDATE is not guaranteed to run. `lastSeenAt` feeds the Settings -> Kiosk Devices health cockpit (the online/recent/offline status dot shipped 2026-05-15) and the heartbeat endpoint relies on `requireKiosk` for the very same update ("requireKiosk() already updates lastSeenAt, so just return ok" -- `src/app/api/kiosk/heartbeat/route.ts`). The net effect: a kiosk can heartbeat every 60 seconds and still show stale/offline in settings, which is exactly the signal admins use to detect a dead iPad. Next.js 15 ships `after()` for precisely this: work that must run after the response without blocking it, and which the platform keeps the function alive to finish.

## Current state

`src/lib/auth.ts:239-242` (inside `requireKiosk`):

```ts
  // Update last seen (fire and forget -- don't block the request)
  Promise.resolve(
    db.kioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } }),
  ).catch(() => {});
```

Context: `requireKiosk` is only invoked from API route handlers via `withKiosk` (`src/lib/api.ts:128-148`), which is a valid `after()` call site. The repo is Next.js `^15.5.16` (see `package.json`), where `next/server`'s `after` is stable.

Existing test: `tests/kiosk-session-auth.test.ts` (91 lines) exercises `requireKiosk`; it will need its mocks extended for `after`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/kiosk-session-auth.test.ts` | all pass |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Type gate | `npx tsc --noEmit` (or `npm run build` when `DIRECT_URL` is set) | exit 0 |

## Scope

**In scope**:

- `src/lib/auth.ts` (the `requireKiosk` lastSeenAt block only)
- `tests/kiosk-session-auth.test.ts` (mock/assertion updates)

**Out of scope**:

- The cookie-refresh logic and session-expiry logic in `requireKiosk` -- recently hardened, do not restructure.
- `src/app/api/kiosk/heartbeat/route.ts` -- unchanged; it stays a thin wrapper.
- Any other fire-and-forget site in the repo (if you spot more, list them in your summary; do not fix them here).

## Git workflow

- Branch: `advisor/016-kiosk-lastseen-durable`
- Conventional commit, e.g. `fix: kiosk online status no longer goes stale while the device is heartbeating`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace fire-and-forget with `after()`

In `src/lib/auth.ts`, import `after` from `next/server` (the file already imports from Next server modules for `cookies`; check the existing import block and extend it consistently). Replace the block at lines 239-242 with:

```ts
  // Update last seen after the response is sent -- after() keeps the
  // serverless function alive until this completes, unlike fire-and-forget.
  after(() =>
    db.kioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: now } }).catch(() => {}),
  );
```

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Fix the tests

Run `npx vitest run tests/kiosk-session-auth.test.ts`. If it fails because `after` is not available in the vitest environment, mock it at module level in that test file so it invokes the callback immediately:

```ts
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => { void fn(); },
}));
```

Add or adjust an assertion that `kioskDevice.update` is called with `data: { lastSeenAt: expect.any(Date) }` on a successful `requireKiosk` pass.

**Verify**: `npx vitest run tests/kiosk-session-auth.test.ts` -> all pass.

### Step 3: Full verification and doc sync

Add a change-log row to `docs/AREA_KIOSK.md` (permitted for this step) noting the cockpit status-dot fix.

**Verify**: `npm run test` exit 0; `npm run lint` exit 0.

## Test plan

Covered in Step 2; the behavioral assertion is that the update is scheduled with the right payload. True post-response semantics cannot be unit-tested; the maintenance note covers production verification.

## Done criteria

- [ ] `grep -n "after(" src/lib/auth.ts` matches inside `requireKiosk`
- [ ] `grep -n "Promise.resolve" src/lib/auth.ts` returns no match in the kiosk section
- [ ] `npx vitest run tests/kiosk-session-auth.test.ts` exits 0
- [ ] `npm run test` exits 0; `npm run lint` exits 0
- [ ] No files outside scope (plus `docs/AREA_KIOSK.md`) modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `after` cannot be imported from `next/server` at this Next version (check `node_modules/next/server.d.ts`); report rather than polyfilling.
- `requireKiosk` is called from any non-request context (search: `grep -rn "requireKiosk(" src/ | grep -v test`); `after()` throws outside a request scope.
- The existing test file's mocking approach conflicts with a top-level `next/server` mock in a way you cannot resolve in two attempts.

## Maintenance notes

- After deploy, verify in production: open Settings -> Kiosk Devices while a kiosk idles; the status dot should stay "online" across several minutes (heartbeat is 60s, capped 1/min/device by rate limit).
- If kiosk traffic grows, consider debouncing the write (skip if `lastSeenAt` is < 30s old) -- not needed at current volume.
- The same fire-and-forget pattern may exist elsewhere in the repo; this plan deliberately fixed only the kiosk site.
