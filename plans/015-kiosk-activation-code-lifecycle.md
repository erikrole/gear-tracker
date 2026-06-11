# Plan 015: Fix the kiosk activation-code lifecycle dead end and make docs truthful

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- "src/app/api/kiosk-devices/[id]/route.ts" "src/app/api/kiosk-devices/[id]/regenerate-code/route.ts" src/app/api/kiosk/activate/route.ts docs/AREA_KIOSK.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (with a security-documentation component)
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why this matters

Kiosk sessions hard-expire after 7 days (`KIOSK_SESSION_MS` in `src/lib/auth.ts:22`; `requireKiosk` refreshes the cookie but never extends the DB `sessionExpiresAt`). When the session expires, the iPad drops to the activation screen and staff must re-enter the device's 6-digit code. But:

1. Activation codes are stored **hashed** and are only shown once, at device creation/regeneration. They cannot be redisplayed.
2. `POST /api/kiosk-devices/[id]/regenerate-code` rejects with 409 whenever `device.activatedAt` is set ("Deactivate it first").
3. Deactivating a device (`PATCH` with `active: false`) clears `sessionToken`/`sessionExpiresAt` but **never clears `activatedAt`**.

So once a device has activated and its code is lost, there is no path back: regenerate 409s even after deactivation, and the admin's only workaround is deleting and recreating the device row. Every active kiosk walks into this within 7 days of its last activation unless someone has the code written down.

Separately, `docs/AREA_KIOSK.md` describes the code as a "6-digit one-time activation code", but `POST /api/kiosk/activate` never invalidates the code after use -- it stays valid indefinitely and re-activating silently rotates the session token (kicking the legitimate iPad back to the activation screen). The docs must describe reality. Note for context: 7-day expiry was removed on May 20 (commit `94580cc6`, "keep kiosk sessions always-on") and reinstated June 2 as part of a consistency fix; whether sessions should expire at all is a product decision explicitly deferred out of this plan.

## Current state

Files:

- `src/app/api/kiosk-devices/[id]/route.ts` -- PATCH (toggle active / rename) and DELETE. The deactivation branch:

```ts
if (typeof body.active === "boolean") {
  updates.active = body.active;
  // If deactivating, also clear session token so it can't be used
  if (!body.active) {
    updates.sessionToken = null;
    updates.sessionExpiresAt = null;
  }
}
```

- `src/app/api/kiosk-devices/[id]/regenerate-code/route.ts` -- the gate:

```ts
if (device.activatedAt) {
  throw new HttpError(
    409,
    "Cannot regenerate code for an already-activated kiosk. Deactivate it first."
  );
}
```

and the update:

```ts
await db.kioskDevice.update({
  where: { id: params.id },
  data: { activationCode: hashedCode },
});
```

- `src/app/api/kiosk/activate/route.ts` -- validates the code, rejects inactive devices, calls `createKioskSession(device.id)`. It never clears or rotates `activationCode` and never checks `activatedAt`.
- `src/lib/auth.ts:166-191` -- `createKioskSession` stamps `sessionToken`, `sessionExpiresAt` (now + 7 days), `activatedAt`, `lastSeenAt`.
- `docs/AREA_KIOSK.md` -- Trust Model item 2 says "A 6-digit one-time activation code"; Known Gaps says "if cookie is wiped admin must regenerate from Settings -> Kiosk Devices" (currently false on both counts: the code is reusable, and regenerate is blocked for activated devices).
- `prisma/schema.prisma` `KioskDevice` model: `activationCode @unique` (hashed), `activatedAt DateTime?`, `sessionToken String? @unique`, `sessionExpiresAt DateTime?`, `active Boolean @default(true)`.

Repo conventions: kiosk-device routes use `withAuth` + `requirePermission(user.role, "kiosk_device", ...)` + `enforceRateLimit(..., SETTINGS_MUTATION_LIMIT)` + `createAuditEntry`. Match the existing style in these two files exactly.

Existing tests touching this area: `tests/settings-kiosk-devices-location-state.test.ts` (settings page state) and `tests/kiosk-session-auth.test.ts` (requireKiosk behavior). Use `tests/kiosk-bulk-detail-routes.test.ts:1-90` as the structural pattern for route tests (vi.hoisted mocks + direct handler import).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/kiosk-device-code-lifecycle.test.ts` | all pass |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Type gate | `npx tsc --noEmit` (or `npm run build` when `DIRECT_URL` is set) | exit 0 |

## Scope

**In scope** (the only files you should modify):

- `src/app/api/kiosk-devices/[id]/regenerate-code/route.ts`
- `src/app/api/kiosk-devices/[id]/route.ts` (PATCH deactivation branch only)
- `docs/AREA_KIOSK.md` (Trust Model wording, Known Gaps wording, change-log row)
- `tests/kiosk-device-code-lifecycle.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/app/api/kiosk/activate/route.ts` -- do NOT add one-time-code enforcement. Weekly re-activation currently depends on code reuse; invalidating codes on use would brick every kiosk's re-activation path. This is a deliberate product decision deferred to the maintainer (see Maintenance notes).
- `src/lib/auth.ts` -- session duration policy (7-day vs always-on) is a product decision; do not change `KIOSK_SESSION_MS` or `requireKiosk`.
- `src/app/(app)/settings/kiosk-devices/page.tsx` -- the settings UI already exposes regenerate; behavior change is server-side. Only touch it if the regenerate button is hidden for activated devices (check first; if a UI gate exists mirroring the 409, report it in your summary rather than redesigning the page).

## Git workflow

- Branch: `advisor/015-kiosk-code-lifecycle`
- Conventional commit, e.g. `fix: admins can regenerate a kiosk activation code after deactivating the device`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Allow regeneration for deactivated devices

In `src/app/api/kiosk-devices/[id]/regenerate-code/route.ts`, change the gate from `if (device.activatedAt)` to:

```ts
if (device.active && device.activatedAt) {
  throw new HttpError(
    409,
    "Deactivate this kiosk before regenerating its code."
  );
}
```

And make the update reset the device to a clean pre-activation state:

```ts
data: {
  activationCode: hashedCode,
  activatedAt: null,
  sessionToken: null,
  sessionExpiresAt: null,
},
```

(The session fields are normally already null after deactivation; clearing them here makes regenerate safe regardless of path.)

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Clear `activatedAt` on deactivation

In `src/app/api/kiosk-devices/[id]/route.ts`, extend the deactivation branch:

```ts
if (!body.active) {
  updates.sessionToken = null;
  updates.sessionExpiresAt = null;
  updates.activatedAt = null;
}
```

This makes the device card read "pending activation" after deactivation, matching the truth that it must be re-activated with a (new) code. Check the GET route in `src/app/api/kiosk-devices/route.ts` derives `activated: !!d.activatedAt` -- no change needed there.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Tests

Create `tests/kiosk-device-code-lifecycle.test.ts` (pattern: `tests/kiosk-bulk-detail-routes.test.ts`, but mock `withAuth` instead of `withKiosk`, providing an admin user, and mock `@/lib/rbac`, `@/lib/rate-limit`, `@/lib/audit`, `@/lib/auth` (`tokenHash`)). Cases:

1. Regenerate on an `active: true, activatedAt: <date>` device -> 409.
2. Regenerate on an `active: false, activatedAt: <date>` device -> 200, update called with `activationCode`, `activatedAt: null`, `sessionToken: null`, `sessionExpiresAt: null`, response includes a 6-digit `activationCode`.
3. Regenerate on a never-activated device (`activatedAt: null`) -> 200 (existing behavior preserved).
4. PATCH `active: false` -> update payload includes `activatedAt: null` along with the session fields.

**Verify**: `npx vitest run tests/kiosk-device-code-lifecycle.test.ts` -> 4+ tests pass.

### Step 4: Make the docs truthful

In `docs/AREA_KIOSK.md`:

1. Trust Model item 2: replace "one-time activation code" with wording that matches reality, e.g. "a 6-digit activation code (hashed at rest, shown once at creation/regeneration, reusable for re-activation until regenerated; re-activating rotates the session token and signs out any previously activated client)".
2. Known Gaps: replace the stale "if cookie is wiped admin must regenerate" bullet with the actual recovery flow: session expiry or cookie wipe -> re-enter the same code; code lost -> deactivate device, regenerate, re-activate with the new code.
3. Add a change-log row dated with today's date describing the fix (regenerate-after-deactivate now works; deactivation resets activation state).

**Verify**: `grep -n "one-time" docs/AREA_KIOSK.md` returns no matches in the Trust Model section.

### Step 5: Full verification

**Verify**: `npm run test` exit 0; `npm run lint` exit 0.

## Test plan

Covered in Step 3. All mocked; no live DB.

## Done criteria

- [x] `npx vitest run tests/kiosk-device-code-lifecycle.test.ts` exits 0 with >= 4 tests
- [x] `npm run test` exits 0; `npm run lint` exits 0, or the repo lint command is documented as blocked and covered by `npm run build:app`
- [x] `grep -n "device.active && device.activatedAt" "src/app/api/kiosk-devices/[id]/regenerate-code/route.ts"` matches
- [x] `grep -n "activatedAt" "src/app/api/kiosk-devices/[id]/route.ts"` shows it being nulled in the deactivation branch
- [x] `docs/AREA_KIOSK.md` no longer claims codes are one-time
- [x] No files outside the in-scope list modified for this plan (`git status --short "src/app/api/kiosk-devices/[id]/regenerate-code/route.ts" "src/app/api/kiosk-devices/[id]/route.ts" docs/AREA_KIOSK.md tests/kiosk-device-code-lifecycle.test.ts plans/015-kiosk-activation-code-lifecycle.md plans/README.md`)
- [x] `plans/README.md` status row updated

## Review

- Regeneration now blocks only when a kiosk is both active and already activated, allowing admins to regenerate codes for deactivated devices that were previously activated.
- Regeneration resets `activatedAt`, `sessionToken`, and `sessionExpiresAt` with the new hashed activation code so no stale session survives the recovery path.
- Deactivation now clears `activatedAt` along with session state, so device status returns to pending activation.
- Added `tests/kiosk-device-code-lifecycle.test.ts` with four route tests covering active-device block, deactivated-device regeneration, never-activated regeneration, and deactivation payload.
- Updated `docs/AREA_KIOSK.md` to describe the reusable-code trust model and the real recovery flow for expired sessions, wiped cookies, and lost codes.
- Verification: `npx vitest run tests/kiosk-device-code-lifecycle.test.ts`, `npm run test`, `npx tsc --noEmit`, required greps, `grep -n "one-time" docs/AREA_KIOSK.md` returning no matches, `git diff --check`, and `npm run build:app` passed. `npm run lint` remains an unusable standalone gate because `next lint` prompts to create ESLint config even with `CI=1`.

## STOP conditions

Stop and report back (do not improvise) if:

- The regenerate route's gate already checks `device.active` (drift -- someone fixed it).
- The settings page client-side hides or hard-blocks regenerate for activated devices in a way that makes the server fix unreachable; report what you found instead of redesigning the page.
- You are tempted to change activation/one-time-code semantics or session duration -- that is explicitly the maintainer's decision, not this plan's.

## Maintenance notes

- **Open product decision for the maintainer** (record in `docs/DECISIONS.md` when made): pick one of (a) keep 7-day expiry + reusable codes (current state after this plan, now coherent), (b) restore the May 20 "always-on until deactivated" behavior and then enforce true one-time codes, or (c) keep expiry but rotate the code on every successful activation and surface the new code to admins. Each is a small change once chosen; (b)+(one-time codes) is the strongest security posture.
- Activation attempts are audited (`kiosk_activated` with IP) and rate-limited (5/15min per IP, 5/hour per code) -- the hijack-by-known-code risk is mitigated but real while codes remain long-lived; the trust model accepts this for a staffed counter.
- Reviewer should scrutinize: that regenerating for a *deactivated but previously activated* device leaves no valid session behind, and that the settings page renders sanely for a device that is `active: true` with `activatedAt: null` after regenerate.
