# GAP-32 — Durable Rate Limiting

**Target:** Replace the in-memory per-instance rate limiter with Upstash Redis so limits survive serverless cold starts and apply across instances. Keep in-memory as a graceful fallback.

## Phase 0 — Audit
- Current limiter: `src/lib/rate-limit.ts` — in-memory `Map`, sync `checkRateLimit`, async `enforceRateLimit` wrapper, `getClientIp`, `SETTINGS_MUTATION_LIMIT` preset.
- Call sites: `enforceRateLimit` (async) in 37 files; `checkRateLimit` (sync) in 15 files. All callers are inside async route handlers.
- No existing Redis/Upstash/KV dependency or env var. `.env.example` present.
- Decisions (confirmed): backend = Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`); fallback = in-memory when env vars absent OR on Redis error (fail to in-memory, never take down auth).

## Approach
- Rewrite `src/lib/rate-limit.ts`:
  - Lazy, memoized Redis client from `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (also accept `KV_REST_API_URL` / `KV_REST_API_TOKEN` for Vercel Marketplace KV naming).
  - Cache one `Ratelimit` instance per `{max}:{windowMs}` config using `Ratelimit.slidingWindow(max, "<windowMs> ms")`, `analytics: false`, shared module-level `ephemeralCache` Map, prefix `"rl"`.
  - `checkRateLimit(key, config)` becomes **async**: use Redis limiter when available; on absence or thrown error, fall back to the existing in-memory sliding-window logic (kept as `checkRateLimitMemory`).
  - Map Upstash `{ success, remaining, reset }` → existing `{ allowed, remaining, resetAt }` shape so call sites need no result-shape changes.
  - `enforceRateLimit` awaits `checkRateLimit`. Fix the em dash in its 429 message.
- Migrate the 15 sync `checkRateLimit` call sites to `await` (all already in async handlers).
- `.env.example`: document the two Upstash vars + that absence falls back to in-memory.
- Provisioning: user provisions Upstash Redis via Vercel Marketplace (I can't); code activates automatically once the env vars are present.

## Acceptance Criteria
- [ ] `src/lib/rate-limit.ts` uses Upstash when env present, in-memory otherwise, in-memory on Redis error.
- [ ] `checkRateLimit` is async; all 15 sync call sites updated to `await`.
- [ ] `enforceRateLimit` unchanged in signature; 429 message has no em dash.
- [ ] Result shape `{ allowed, remaining, resetAt }` preserved; no call-site logic changes beyond `await`.
- [ ] `.env.example` documents Upstash vars.
- [ ] `npx tsc --noEmit` and `npx next build` pass.
- [ ] `docs/GAPS_AND_RISKS.md` GAP-32 updated.

## Verification
- `npx tsc --noEmit`, `npx next build`.
- Unit: a focused test that without env vars the limiter blocks after `max` (in-memory path) and resets after the window.
- Can't live-smoke Redis here (no Upstash provisioned); document that production verification happens after the Marketplace integration is wired.

## Out of scope (V2)
- Per-endpoint analytics dashboards.
- Distributed token-bucket / multi-region replication tuning.
