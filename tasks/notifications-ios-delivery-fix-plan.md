# iOS push delivery health plan

## Scope

Make native APNs registration honest and recoverable without changing the
durable in-app notification contract or APNs delivery policy.

## Root cause

- The app only retried remote notification registration for `.authorized`, so
  previously provisionally authorized installs could retain a stale or missing
  server token.
- `AppDelegate` discarded token-registration failures with `try?`, while
  Settings showed only the OS permission state. A user could see “Push allowed”
  even when `/api/devices` had rejected the token or the server had no active
  token to deliver to.
- Production APNs configuration and runtime logs could not be verified from
  this session because the connected Vercel scope returned 403.

## Checklist

- [x] Track server-side device-token registration as a separate native state.
- [x] Retry registration for authorized, provisional, and ephemeral permission.
- [x] Surface a recoverable registration failure in native Notifications settings.
- [x] Add source-contract coverage for registration state and retry behavior.
- [x] Sync mobile, notifications, risk, task, and lesson docs.
- [x] Run focused tests, iOS drift/gap checks, whitespace, app build, and a
  simulator build when available.
- [ ] Complete production Vercel APNs env/log verification and real-device push
  QA.

## Review

Implementation is intentionally limited to registration truth and retry. Focused
tests (18 passing), iOS drift (71 Swift files), iOS audit gaps (47/47), project
wiring, whitespace, `npm run build:app`, and the unsandboxed simulator build all
pass. The follow-up Apple Design pass made the failure row Dynamic Type-safe by
stacking its explanation and native Retry action, with shared haptic feedback
and an accessibility hint. `npm run verify:docs` remains blocked by
pre-existing codemap drift in unrelated dirty-worktree docs. APNs credentials,
production environment configuration, and real-device delivery still require
external Vercel/Apple access and hardware verification.
