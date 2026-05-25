# Security Hardening Review — 2026-05-25

Internal tool. Security tight, but not annoying for students/staff.

## Already fixed (verified in current code — DO NOT re-fix)
- CSRF missing-Origin now blocked on mutations (`src/lib/api.ts:14-27`, cron Bearer exempt)
- IDOR on `GET /api/bookings/[id]` guarded by requester/creator check
- SERIALIZABLE present on shift-trades / shift-assignments / shift-generation transactions
- Rate limiter uses Upstash Redis with in-memory fallback (`src/lib/rate-limit.ts`)
- Kiosk activation per-IP + per-code throttling; nudge scoped + rate-limited; kiosk session 7d
- Session tokens HMAC-SHA256 hashed at rest; bcrypt passwords; httpOnly/secure/sameSite=lax cookies
- Raw SQL confined to `db-diagnostics` with static strings (no injection)

## Guardrails (the "not annoying" contract)
- NO CAPTCHA, NO MFA for students/staff
- Do NOT shorten 12h/30d session windows
- Read-side student flows stay un-rate-limited
- Tight zone (where hardening is allowed to add friction): file uploads, password reset,
  kiosk activation, role escalation, anything that fans out (email/SMS/notifications),
  anything anonymous/unauthenticated

## In scope
1. npm audit fix (4 moderate: uuid<-svix<-resend, brace-expansion)
2. IDOR sweep across all `[id]` routes (is the bookings template applied everywhere?)
3. File upload validation (avatar, booking-photos, blob): mime/size/content-sniff
4. SSRF: calendar-sources/test, image search
5. Auth flows: password-reset enumeration/timing, session rotation on login,
   account lockout, reset-link IP/UA logging
6. Rate-limit categorization of unprotected sensitive routes (auth/reset/activation/upload/email)
7. Sentry PII scrubbing + secret/token logging review
8. assertSameOrigin cron Bearer exemption (flag; fix only if reachable by non-cron paths)

## Out of scope (V2 / needs decision)
- Re-fixing closed audit items
- MFA, CAPTCHA, session-window shortening
- Full pentest of every read route

## Verification
- `npm run build` (or `npx next build` if migrate blocked)
- `npm run test` for any auth/permission change
- `git diff --check`

## Findings (fresh review of current code, 3 parallel subagents)

### Fixed this pass
- HIGH — SSRF in `downloadImageToBlob` (`src/lib/blob.ts`): fetched user-supplied
  image URL with no host validation. Reachable by STAFF via asset/bulk-sku image-by-URL
  PUT. Could probe internal network / cloud metadata (169.254.169.254). The calendar
  paths already guarded; this one was missed.
- HIGH — PII leak via asset booking history (`assets/[id]` GET): returned every past
  requester's **email** to any STUDENT iterating asset IDs. Sibling selects in the same
  handler already dropped email; history was missed.
- MEDIUM — Stored-XSS hardening on image uploads: all upload paths trusted client
  `file.type`. Added magic-byte signature check (JPEG/PNG/GIF/WebP) in `validateImage`
  + applied to `resources/upload-image` (which also accepted `image/svg+xml`).
- MEDIUM — Admin temp password entropy 48→96 bits (`users/[id]/reset-password`).
- MEDIUM — Audit log now records password-reset **issuance** (forgot-password), not
  just consumption — reset abuse against a target account is now traceable.

### Fixed in follow-up pass
- Booking `audit-logs` "view" 403-for-everyone bug — `canPerformBookingAction`
  now handles `"view"` as a state-independent read-access check. Test added.
- Session rotation on login — `createSession` revokes the caller's prior session
  row before minting the new one.

### Deferred (V2 / low / needs a decision — NOT shipped)
- LOW — `assertPublicHost` is single-DNS-resolution (DNS-rebinding / multi-A TOCTOU).
  Same residual the calendar paths already accept. Fix = resolve-once-and-pin-IP.
- LOW — Self change-password does not rotate the current session token. Clean rotation
  needs to preserve the remember-me duration, else it silently shortens the session.
- LOW — Password policy is length-only (min 8). Acceptable per no-friction constraint.
- LOW — `assertSameOrigin` exempts any request with `Authorization: Bearer` (for cron).
  Not browser-CSRF-exploitable (Authorization triggers CORS preflight). Flag only.
- MODERATE (deps) — 4 transitive npm advisories (resend→svix→uuid, brace-expansion via
  Sentry bundler). Fix requires a resend major bump; left for the user to schedule.

### Non-security functional bug noticed (out of scope)
- `bookings/[id]/audit-logs` calls `requireBookingAction(id, user, "view")` but `"view"`
  is absent from the action matrix → likely 403s for everyone. Flag for a follow-up.

## Verification
- `npx tsc --noEmit` — clean
- `git diff --check` — clean
- New test `tests/blob-image-validation.test.ts` — 7/7 pass
- Full suite: 825 pass; 6 pre-existing failures (kiosk-session-auth, morning-refresh,
  shift-trades) confirmed failing on clean HEAD — unrelated to this work
- `npx next build` — compiles clean
