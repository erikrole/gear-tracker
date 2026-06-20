# Kiosk Cleanup Bundle - 2026-06-12

Moved from `tasks/todo.md` during orchestrator cleanup. The enum/schema proof is complete. The only remaining live pickup scan smoke was split into `tasks/kiosk-pickup-live-smoke-followup.md` because it needs a safe pending-pickup or due-reservation fixture and should not mutate live data casually.

---

## Active: Kiosk pickup scan 500 + kiosk UI pass (2026-06-12)

Root cause: `scan_events.phase` is `text` in the live DB while schema declares
enum `ScanPhase` (table predates the migration baseline). Prisma generates
`phase = $1::"ScanPhase"`; Postgres rejects `text = "ScanPhase"` (42883).
Inserts bind as text and succeed, so drift surfaced only when the duplicate-scan
guard (`scanEvent.findFirst({ phase })`) shipped on the kiosk pickup path.
Secondary: DB-applied migration `0077_add_bulk_sku_image_rehost_attempts`
missing locally (lives on advisor/codex branches; schema field already on main).

- [x] Restore `0077_add_bulk_sku_image_rehost_attempts/` (exact name matches `_prisma_migrations` row)
- [x] Allow 0077 prefix collision in `scripts/check-migration-prefixes.mjs` (both already applied in prod)
- [x] Migration `0078_fix_scan_events_phase_enum`: `ALTER ... TYPE "ScanPhase" USING phase::"ScanPhase"`
- [x] `db:migrate:check` passes (80 migrations, no collisions); prod apply rides the Vercel build on push
- [x] Post-deploy enum proof completed; live pickup scan smoke carried to `tasks/kiosk-pickup-live-smoke-followup.md`
  - [x] Live migration health is clean: 83/83 local migrations applied, no pending local migrations, no unresolved failed rows, no DB-only applied migrations.
  - [x] Live column proof: `information_schema.columns` reports `scan_events.phase` as `data_type = USER-DEFINED`, `udt_name = ScanPhase`.
  - [x] Live typed-comparison proof: `SELECT COUNT(*) FROM scan_events WHERE phase = 'CHECKOUT'::"ScanPhase"` succeeds and returned 4 rows, proving the former `text = "ScanPhase"` 42883 path is gone.
  - [x] Focused pickup route regression: `npm test -- tests/kiosk-bulk-detail-routes.test.ts` passed 11 tests, including serialized pickup scan success and duplicate-scan behavior.
  - [x] Live pickup scan smoke remains pending in `tasks/kiosk-pickup-live-smoke-followup.md` because the current live database has no `PENDING_PICKUP` checkout with serialized items and no due `BOOKED` reservation with serialized items to scan safely.
- [x] Kiosk UI improvement pass (iOS `Kiosk/` views: idle, pickup, return + API error copy)
- [x] `npm run build` (passes), `xcodebuild` (BUILD SUCCEEDED), doc sync, commit + push

### Review
- Root cause was schema drift, not the scan code: `scan_events` predates the migration
  baseline, so `phase` stayed `text` while the schema declares enum `ScanPhase`. The
  2026-06-02 duplicate-scan guard added the first typed comparison on that column and
  every serialized pickup scan started 500ing. Inserts kept working (text binding),
  which is why the drift was invisible until then.
- Local `prisma migrate dev/deploy` can't reach Neon on 5432 from this network;
  `prisma-migrate-deploy.mjs` now also falls back to Neon HTTP on P1001, and the
  actual prod apply rides the normal Vercel build (`prisma migrate deploy`).
- 2026-06-18: Post-deploy schema proof passed with approved Neon HTTP access.
  `npm run db:migrate:health` reports all 83 local migrations applied; live
  `scan_events.phase` is the `ScanPhase` enum; and the typed comparison
  `phase = 'CHECKOUT'::"ScanPhase"` succeeds. Focused kiosk pickup route tests
  also pass locally. Live pickup scan smoke is still not safe to run because no
  current pending-pickup checkout or due serialized reservation fixture exists.
- iOS kiosk UI pass: friendlier 5xx copy, bigger rings + white guidance text,
  checklist progress summaries, smarter disabled CTAs, idle-screen empty state and
  stronger hierarchy. Compile-verified; visual sign-off on the iPad is the user's.
- Pre-existing test failures (2) on main flagged as a separate background task.

## Active: Kiosk dashboard final polish (2026-06-12)

Scope: close the remaining iPad kiosk dashboard polish before moving into the
user-specific kiosk pages. Data alignment is fixed; this pass is layout density,
readability, and debug-noise cleanup.

- [x] Compact event sections: remove noisy count badges and quiet empty rows.
- [x] Make event detail read-only sheet stop truncating real event/call ranges.
- [x] Make assigned-worker rows denser and clearer.
- [x] De-emphasize the DEBUG sleep toggle when inactive and hide debug capability logs outside DEBUG.
- [x] Sync kiosk docs and record verification.

### Review
- 2026-06-12: Final dashboard polish keeps the data model unchanged and tightens
  the iPad surface: Today/Tomorrow no longer show tiny count noise, empty event
  rows are plain muted text, stat selection has a clearer bottom marker, the
  event detail sheet uses full-width Event/Call rows to avoid truncating 3-5 and
  2-6 ranges, worker rows are compact enough for real crew lists, and the DEBUG
  sleep affordance/logging is quieter.

## Active: Kiosk iPad activation + idle polish (2026-06-12)

- [x] Add hardware keyboard entry for the kiosk activation code.
- [x] Replace fragile activation paste affordance with a dependable paste action.
- [x] Improve activation layout, contrast, and Dynamic Type resilience on iPad.
- [x] Tighten idle screen clock, event, checkout, and roster typography/contrast.
- [x] Switch the idle clock to Gotham Black.
- [x] Add burn-in mitigation sleep mode for night hours and truly idle kiosk windows.
- [x] Add pixel-shift movement to the sleep-mode overlay.
- [x] Add DEBUG top-right moon toggle to force sleep/night mode on and off.
- [x] Fix idle regression feedback: bigger single-line clock, higher-contrast date, no iPad deactivate button, kiosk name plus location header, clickable stat detail panels, upcoming event labeling, checkout-title rows, and denser roster cards.
- [x] Sync kiosk docs and attempt the Swift build path.

### Review
- 2026-06-12: Activation now supports hardware keyboard entry, delete, Return,
  Command-V via the focused hidden input, and a visible Paste Code action with
  clearer invalid/short-code feedback. Idle now uses Gotham Black for the clock,
  stronger contrast, adaptive roster sizing, and a server-driven burn-in
  mitigation sleep overlay. Sleep mode triggers during 10 PM-6 AM or truly idle
  windows, uses a very dim pixel-shifted clock cluster, and tap-to-wake gives
  staff 10 minutes before sleep can resume.
- 2026-06-12 follow-up: Idle regression pass restores the large glanceable
  single-line clock, removes the iPad deactivate affordance, changes the header
  to kiosk name plus location, makes stat cards select Items Out, Active
  Checkouts, and Overdue lists, adds asset image/name rows for active items,
  treats near/tomorrow events as Upcoming instead of Today, and adds a DEBUG
  moon toggle to force sleep/night mode for testing.
- Verification: `git diff --check` passed; `npx eslint src/app/api/kiosk/dashboard/route.ts`
  passed. `npx tsc --noEmit` remains blocked by pre-existing
  `tests/bulk-unit-adjustment-routes.test.ts:171`. iOS `xcodebuild` is blocked
  by local CoreSimulator `simdiskimaged` failures before useful Swift diagnostics.

## Active: Always-on kiosk — session persistence + standby display (2026-06-12)

Report: every Xcode rebuild bounced the iPad back to activation. Cause: the
kiosk_session cookie and KioskInfo live in the app container (HTTPCookieStorage
/ UserDefaults), which reinstalls wipe; plus the fixed 7-day session would have
forced weekly re-activation even on a healthy kiosk.

- [x] Server: `requireKiosk()` slides `sessionExpiresAt` on activity (~daily write throttle), cookie re-issued with slid expiry (D-039)
- [x] Server: `/api/kiosk/me` returns device `name` so the app can rebuild info after a wipe
- [x] iOS: session token mirrored to Keychain (`AfterFirstUnlock`), cookie re-created on launch, info rebuilt from /me; cleared on deactivate/401
- [x] iOS: activation also extracts `kiosk_session` from `Set-Cookie` when JSON `sessionToken` is absent during API rollout skew
- [x] iOS: XcodeGen bundle ID aligned with the checked-in Xcode project so regenerated builds keep the same Keychain access identity
- [x] iOS: kiosk shell disables system idle timer (screen never sleeps)
- [x] iOS: idle screen redesigned as standby display — live HH:MM:SS clock (1s TimelineView), Gotham date in brand red, TODAY event rows bolder
- [x] Tests updated (KioskContext mocks + kioskMe contract), tsc/vitest/xcodebuild/next build all pass
- [x] Docs: D-039, AREA_KIOSK change log

### Review
- The 7-day expiry now only ends sessions for kiosks dark a full week; admin
  deactivation still revokes instantly. Keychain copy outlives app deletion by
  design — deactivate() and the 401 path both clear it.
- Follow-up correction: persistence still failed on device because native
  activation only saved the token when the API JSON already included
  `sessionToken`. The app now falls back to extracting `kiosk_session` from
  `Set-Cookie`, so one more activation after this build should seed Keychain
  even if the deployed API and native build are briefly out of sync.
- Second persistence hazard fixed: `ios/project.yml` still used
  `com.erikrole.creative` while the checked-in Xcode project uses
  `com.erikrole.Wisconsin`. Any `xcodegen generate` would install a different
  app identity and leave the prior Keychain item unreachable.
- Visual sign-off on the standby clock needs the user's iPad rebuild.

