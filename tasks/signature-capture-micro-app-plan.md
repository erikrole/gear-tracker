# Signature Capture Micro-App — Execution Ledger

## Goal

Ship the Men’s Basketball signature-capture pilot as an authenticated staff/admin web workflow. Apple Pencil is the only drawing input; touch remains available for controls. Captures are server-rendered into matching private PNG and SVG artifacts, associated with an immutable UWBadgers roster snapshot, and counted complete only after both artifacts and the database state commit.

## Current State

The V1 implementation is deployed through the web, API, schema, artifact, storage, and cleanup contracts. Hardened production deployment `dpl_Gspp8EzUCRM9VseLegodTZiXVLV6` reports 119/119 applied migrations with no pending rows, and authenticated `wisconsincreative.com` smoke proves both rosters plus the revised capture route. The 2026–27 MBB roster is reconciled into 14 players, 7 required coaching staff, and 11 optional support staff; players are presented by jersey number and staff follows the UWBadgers source order, with Greg Gard first for Men’s Basketball. Creative staff are a separate `CREATIVE` collection sourced from active full-time Video/Photo/Graphics accounts, with explicit sync and last-name ordering; the readback contains 11 linked active accounts, including Erik Role for capture testing. The unwanted 2025–26 Preview collection is archived and hidden from the active chooser by default, with an admin-only restore path. Dedicated private Blob provisioning, generated-byte application-wrapper proof, partial-upload cleanup failure injection, and authenticated hardened-production read smoke are complete. Rollout remains gated on a physical Pencil save, authenticated artifact delivery, and physical iPad Safari acceptance.

## Scope

- Canonical collection key: `sportCode + season`, with `MBB` for Men’s Basketball, `CREATIVE` for the standalone Creative staff roster, and `ADHOC` for manually entered one-off signers.
- External roster members are separate from Gear Tracker users and may have a nullable user link. Creative staff use linked full-time Video/Photo/Graphics accounts as separate signature members with no external snapshot and never live in the MBB collection.
- UWBadgers import is fixed to an allowlisted adapter with structural parsing, profile-identity deduplication, preview persistence, and versioned reconciliation. Creative staff sync is explicit, version-checked, audited, and preserves imported roster state.
- Required members are active MBB players/coaching staff and standalone Creative staff by default. Support staff are imported but optional.
- Private app-managed storage is required. Box signature-file integration, native PencilKit, ZIP export, scheduled roster sync, multi-sport adapters, and pressure width are deferred.

## Source Checks

- `prisma/schema.prisma`: `StudentSportAssignment` models internal users and must not be reused.
- `src/lib/permissions.ts`: signature access needs a dedicated resource.
- `src/lib/audit.ts`: audit rows retain only 90 days, so capture and artifact lifecycle state must be durable in signature tables.
- `src/lib/blob.ts`: existing helper is public-media oriented and must not be extended for signatures.
- `src/lib/sports.ts`: `MBB` is the canonical Men’s Basketball code.
- UWBadgers Men’s Basketball roster: duplicate list/card/table representations and separate coaching/support sections require structural scoping and profile-identity deduplication.

## Stop Conditions

Stop before expanding the feature if physical iPad Safari cannot reject accidental touch/palm/mouse drawing, private Blob storage cannot be provisioned, deterministic transparent PNG/SVG output cannot be demonstrated, or pending-delete artifacts cannot be made non-downloadable and retryable.

## Slices

| Slice | Status | Evidence or remaining gate |
| --- | --- | --- |
| Contract, brief, decision, permission, risk, and ledger | Complete | Repo contracts recorded in docs and tasks. |
| Physical-input capture surface and IndexedDB drafts | Implemented locally | Requires target iPad/Safari proof before rollout. |
| Schema, migration, validation, permissions, and completeness | Deployed | Prisma validation, migration-prefix check, generated client pass, service coverage, and migration health pass. Production reports 119/119 migrations applied with no pending rows. |
| UWBadgers snapshot adapter and reconciliation | Complete | Fixed MBB adapter, bounded fetch, structural dedupe, immutable preview, explicit apply. |
| Deterministic SVG/PNG artifact engine | Complete | Focused tests verify hashes, 1000px minimum transparent RGBA PNG output, and sanitized path-only SVG output. Existing captures regenerate their high-quality PNG download from the stored SVG vector. |
| Private Blob lifecycle and authenticated delivery | Provider and cleanup proof complete; local authenticated download proof complete | Dedicated private store passes two-artifact application-wrapper privacy/read/delete proof; injected second-artifact failure leaves neither object behind. Authenticated local browser proof downloaded and inspected both production-format files; deployed application save/delivery remains. |
| Collection, roster, capture, settings, and file library UI | Verified in development | Landing cards show separate MBB and Creative staff rosters. The standalone Creative staff card syncs active full-time Video/Photo/Graphics accounts; MBB remains players/coaches/support only. Collection members render in exact 64px rows with a centered Signature rail: compact theme-aware PNG proof for completed rows and a 160 x 44px centered capture action for incomplete rows. Creative staff titles are omitted on this page while team positions remain. File, requirement, and lifecycle actions remain in the accessible row menu. Authenticated local visual proof covers dark, light, and 1024px responsive states. |
| Roster hierarchy, source ordering, and active-year management | Verified in Preview | Source-role identity parser v3 reconciled the 2026–27 collection to 14 players, 7 required coaches, and 11 optional support staff; players sort numerically, staff preserves source order with Greg Gard first, and the 2025–26 collection is archived/hidden by default with version-checked restore. |
| Operational closeout | Open | Hardened production is Ready and authenticated read smoke passes; a real Pencil save, authenticated artifact delivery, and physical iPad acceptance remain. |

## Verification

- Pure tests for pointer gating, draft expiry/keying, roster parsing/deduplication/reconciliation, artifact sanitization/determinism, permission roles, and save lifecycle transitions.
- `npx prisma validate`, `npm run db:migrate:check`, focused tests, `npx tsc --noEmit --pretty false`, lint, `npm run build:app`, `npm run codemap`, `npm run verify:docs`, and `git diff --check`.
- Authenticated browser proof and physical iPad Safari proof remain explicit acceptance gates; local source/build success cannot replace them.

Local export verification on 2026-08-15 downloaded `erik-role-signature.png` and `erik-role-signature.svg` through the authenticated browser into macOS Downloads. The PNG is 1600 x 645, four-channel RGBA, non-opaque, and includes fully transparent pixels. The SVG contains a viewBox and four path elements with no embedded image, data URI, script, foreign object, or external reference. These export changes are implemented and verified locally but are not yet promoted to production.

Local verification on 2026-08-15: focused signature tests 11/11 plus six signature-service tests, TypeScript, focused lint, Prisma validation with placeholder URLs, migration-prefix check, `git diff --check`, and migration health (119/119) passed. The full suite passed 489/489 with CI placeholder database variables. Migration generation hit the repository's blank schema-engine failure, so `0114_signature_creative_staff` was authored as the additive enum/nullability migration and applied through the working development Neon pooler URL. Authenticated browser smoke covers the 2026–27 collection with numeric player order, source-order staff sections (Greg Gard first), separate Players / Coaching staff / Support staff groups (14 / 7 / 11), a standalone Creative staff roster with 12 active full-time Video/Photo/Graphics accounts, and the admin-only archived-year chooser path. Production deployment `dpl_5WSeBG88rhaBNKKmtfM6ETVX75Um` completed after the Vercel build was hardened for its memory limit; the live unauthenticated redirect passed. Provisioned private Blob failure injection, authenticated production workflow proof, and physical iPad proof remain open.

## Review Notes

- Pencil contract: pen-class web gate (`pointerType === "pen"`), not cryptographic Apple Pencil identification.
- No client-provided SVG, PNG, filename, path, Blob URL, or private token is trusted.
- Stale collection, snapshot, settings, capture, and request versions return `409` while preserving the local draft and prior committed capture.
- The local pre-iPad hardening pass keeps Pencil resize/input handling stable, binds request IDs to their original target, preserves required-state overrides across unchanged imports, and invalidates in-flight saves during collection reset.

## Follow-up: Private Storage and Stroke Smoothing — 2026-08-15

### Goal

- Keep the existing public-media Blob credential out of Signature Capture and make the live Pencil stroke feel less angular while preserving deterministic server-owned artifacts.

### Source Checks

- Before this follow-up, `src/lib/signatures/storage.ts` resolved the generic `BLOB_READ_WRITE_TOKEN`, which is backed by a public Blob store in the current development environment.
- Before this follow-up, `src/app/(app)/signatures/[id]/capture/[memberId]/SignatureCapturePage.tsx` drew raw line segments on the canvas.
- Before this follow-up, `src/lib/signatures/geometry.ts` emitted raw SVG line segments, so preview and committed PNG/SVG artifacts shared the same sharp corners.
- A generated-byte provider smoke test on 2026-08-15 returned Vercel's `private access on a public store` error; no user signature was transmitted.

### Stop Conditions

- Stop the storage rollout at configuration if a dedicated private Blob store/token is not available; do not fall back to the public-media store.
- Stop smoothing changes if the canvas and SVG path rules diverge, artifact determinism changes unexpectedly, or crop bounds no longer include the configured stroke radius and padding.

### Slices

- [x] Use an explicit Signature Capture private Blob credential for upload, read, and cleanup; add a focused storage contract test.
- [x] Render the same midpoint-quadratic smoothing rule in the live canvas and sanitized SVG; add deterministic curve coverage.
- [x] Verify focused tests, TypeScript, lint, app build, and docs checks.
- [x] Provision and connect a dedicated private Blob store without modifying the existing public-media store.
- [x] Prove generated-byte private upload, anonymous denial, authenticated readback, and cleanup.
- [x] Inject a second-artifact upload failure and verify application cleanup leaves neither generated object behind.
- [ ] Authenticated browser/device acceptance where credentials and hardware are available.

### Verification

- [x] `npx vitest run tests/signature-capture.test.ts tests/signature-service.test.ts tests/signature-storage.test.ts` (21/21)
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] Authenticated browser read smoke on hardened Preview.
- [ ] Authenticated physical Pencil save/delivery and full iPad Safari/Apple Pencil proof.

### Review

- Shipped: Signature storage requires dedicated private-store auth; canvas and server artifacts use shared midpoint-quadratic smoothing. Dedicated private store `wisconsin-creative-signatures-private` is connected to Production, Preview, and Development with a Signature-specific token.
- Verified: focused tests 21/21, full suite 3,160/3,160 with CI placeholder database variables, TypeScript, lint, app build, codemap/docs, migration-prefix, and diff checks all pass.
- Deferred: authenticated physical Pencil save/delivery and full iPad/Apple Pencil acceptance.
- Blocked: save/delivery and physical proof require the target iPad and Apple Pencil.
- Proof artifacts: application-wrapper smoke uploaded and read back both generated artifacts, returned anonymous `403`, removed both objects, and left neither object after an injected second upload failure; `tests/signature-capture.test.ts`, `tests/signature-service.test.ts`, and `tests/signature-storage.test.ts` cover the source and transaction contracts.
- Next slice or stop: sign and save on hardened production with the target iPad and Apple Pencil, then verify authenticated delivery.

## Follow-up: Apple Pencil Capture Hardening — 2026-08-15

### Goal

- Make iPad Safari ink immediate and stable, preserve the last Pencil samples through interruptions and rotation, and make local recovery and retries match what the interface promises.

### Audit

- A fresh read-only `gpt-5.6-sol` Medium audit found no source P0, but confirmed P1 issues in the React-bound drawing loop, terminal/interrupted pointer handling, draft load and persistence truth, client request-id reuse, resize distortion, and destructive Clear behavior.
- Private Blob provisioning remains a rollout blocker outside this source slice; the existing fail-closed storage change must remain intact.

### Source Checks

- The capture page currently copies the active stroke into React state and redraws every stored stroke on each Pointer Event.
- Pointer completion does not consume terminal samples and has no lost-capture or page-interruption finalization path.
- The canvas accepts input before IndexedDB draft recovery finishes, while failed draft writes are hidden behind the in-memory `Draft ready` label.
- Server saves are idempotent by request ID, but the client currently generates a new ID for every retry.
- Existing resize handling mutates stored point coordinates independently on each axis.
- The shared midpoint-quadratic geometry and dedicated private-storage boundary are accepted inputs to this slice and must not regress.

### Stop Conditions

- Stop if stable logical coordinates change the server stroke contract, exceed existing coordinate bounds, or make preview and generated artifacts diverge.
- Stop if frame-bounded drawing can save a different stroke snapshot than the one visible on the canvas.
- Stop if draft hardening can overwrite new ink with a late recovery result or an older asynchronous write.
- Do not provision, rename, or delete an external Blob store in this slice.

### Slices

- [x] Add tested stable-canvas and point-deduplication helpers.
- [x] Move active ink to a frame-bounded imperative path and commit completed strokes to React state.
- [x] Capture terminal samples and finalize safely on cancel, lost capture, visibility changes, and page hide.
- [x] Resolve drafts before enabling ink, persist at stroke boundaries, report actual draft state, and make Clear undoable.
- [x] Retain one request ID across ambiguous retries and invalidate it only when ink changes or the server definitively rejects the request.
- [x] Align pen-class copy, 44px controls, stable loading labels, and live status announcements.
- [x] Verify source and sync Signature area acceptance notes without closing private-store or physical-device gates.

### Verification

- [x] `npx vitest run tests/signature-capture.test.ts tests/signature-service.test.ts tests/signature-storage.test.ts` (25/25)
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] Authenticated browser read smoke on hardened Preview `dpl_acg3vUW3iUa3vgQ1CxCSiyaxXNMj`.
- [ ] Physical iPad Safari/Apple Pencil acceptance on the deployed hardened build.

### Review

- Shipped: Stable logical canvas mapping, animation-frame Pencil rendering, terminal/interruption finalization, ordered draft recovery and persistence, undoable Clear, ambiguity-safe request retries, and iPad-aligned copy/controls/status.
- Verified: Focused signature tests 25/25, TypeScript, lint, app build, migration-prefix check (119 migrations), codemap/docs, and diff checks pass. Sol's final P1-only review found no remaining source P0/P1.
- Deferred: Pressure, tilt, hover, squeeze, barrel roll, variable-width ink, native PencilKit, and exact Apple Pencil hardware identification remain out of V1 scope.
- Blocked: A physical Pencil save, authenticated artifact delivery, and full physical iPad proof remain external acceptance gates; private-store provisioning and hardened production deployment are complete.
- Proof artifacts: `src/lib/signatures/capture.ts`, the hardened capture page and signature service, and focused capture/service/storage tests.
- Next slice or stop: Sign and save on hardened production with the target iPad and Apple Pencil, then verify authenticated delivery.

## Follow-up: Roster-Wide Export and Jersey Identity — 2026-08-15

### Goal

- Confirm the artifact contract applies to every signature collection, render player jersey numbers in the existing Wisconsin Athletics Gotham Ultra face, and guarantee clean signer-based download filenames without internal IDs.

### Source Checks

- Every team and Creative staff collection uses the same `SignatureCollectionPage`, authenticated artifact route, and `getReadySignatureArtifact` service boundary.
- Player rows already carry normalized numeric `jerseyNumber` values; non-player rows use the person icon and Creative staff rows have no jersey number.
- `public/Gotham-Ultra.woff2` is registered as the 900 weight of the official Gotham heading family through `--font-heading`.
- Artifact names are currently generated server-side from the member name as `<signer>-signature.<kind>`; focused coverage does not yet lock that contract or punctuation/diacritic normalization.

### Stop Conditions

- Stop if a roster type bypasses the shared collection or artifact route.
- Do not invent or add a new font asset; use the licensed Wisconsin Athletics Gotham family already shipped by the app.
- Do not include collection IDs, member IDs, revision IDs, or storage paths in user-facing filenames.

### Slices

- [x] Apply Gotham Ultra only to real player jersey numerals while retaining icons for staff and Creative rows.
- [x] Centralize and test clean filename generation for PNG and SVG downloads.
- [x] Confirm the shared grid has one Signature header and no roster-specific header drift.
- [x] Verify focused tests, TypeScript, lint, app build, docs, and authenticated MBB plus Creative roster behavior.

### Verification

- [x] Focused signature capture and service tests (31/31).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [x] Authenticated browser proof for one team roster and the Creative staff roster.

### Review

- Shipped: Shared roster player numerals use Gotham Ultra at weight 900; staff and Creative rows remain icon-based. PNG and SVG downloads use one tested server-owned filename helper that strips internal IDs, normalizes punctuation and diacritics, and returns `<signer>-signature.<kind>`.
- Verified: Focused signature tests pass 31/31. TypeScript, lint, production app build, codemap/docs verification, and diff checks pass. Authenticated local MBB proof measured Gotham at weight 900 and every inspected row at 64px; authenticated Creative proof measured all 12 rows at 64px, zero jersey labels, and no title sublines.
- Deferred: Additional sport roster adapters remain outside V1; any future collection using the shared signature route inherits the same display and download contract.
- Blocked: No source blocker. Production promotion and physical iPad/Apple Pencil acceptance remain separate rollout gates.
- Proof artifacts: `SignatureCollectionPage.tsx`, `signatureArtifactFilename`, focused signature tests, and authenticated local MBB plus Creative roster measurements.
- Next slice or stop: Stop this local slice; promote through the normal Vercel release path only when explicitly requested.

## Follow-up: Long-Roster Interaction Polish — 2026-08-16

### Goal

- Keep shared team and Creative signature rosters calm and scannable when they contain several groups, long position labels, repeated capture actions, and admin-only settings.

### Source Checks

- Every current signature collection renders through the shared `SignatureCollectionPage` row and group layout.
- Team positions must remain available without changing the exact 64px row contract; Creative staff titles remain intentionally omitted.
- `OperationalRowActions` already supplies an accessible 40px baseline, and this page already opts into a 44px trigger.
- Capture settings lock after the first saved signature, while collection reset remains an admin-only mutation that requires explicit confirmation.

### Stop Conditions

- Stop if the refinements change signature completeness, required-state, capture, download, artifact, storage, or roster-order contracts.
- Stop if collapsing a group removes its heading or completion summary from keyboard and assistive-technology navigation.
- Stop if a long team position can resize a roster row or if optional-action styling makes capture unavailable.

### Slices

- [x] Make roster groups independently collapsible while preserving their visible completion summaries.
- [x] Clamp team positions to one line with full hover and assistive-technology text and preserve exact 64px rows.
- [x] De-emphasize optional capture actions without changing their label, destination, or target size.
- [x] Collapse admin settings by default and separate collection reset into a confirmed danger area.
- [x] Verify focused tests, TypeScript, lint, app build, docs, and authenticated desktop behavior.
- [ ] Re-capture the changed roster at a 1024px tablet viewport when a resizable authenticated browser or target iPad is available.

### Verification

- [x] Focused signature capture and service tests (27/27).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [x] Authenticated browser proof for expanded/collapsed groups, long titles, optional actions, and settings/reset controls.

### Review

- Shipped: Shared team and Creative rosters now have independently collapsible groups, exact one-line team positions, neutral optional capture actions, collapsed admin settings, and a confirmed reset danger area. Existing 44px row menus remain unchanged.
- Verified: Focused signature tests pass 27/27. TypeScript, full lint, production app build, codemap/docs verification, and diff checks pass. Authenticated local MBB proof measured every rendered roster row at 64px, the longest team title at one 16px line with ellipsis, and every row action at 44 x 44px. Browser interaction proved group collapse, the signed Creative locked-settings state, and the reset confirmation; it was canceled without mutation. No console errors were recorded.
- Deferred: A fresh 1024px capture remains pending because the connected authenticated in-app browser exposes a fixed viewport. Production promotion and physical iPad/Apple Pencil acceptance remain separate rollout gates.
- Blocked: No source blocker.
- Proof artifacts: `SignatureCollectionPage.tsx`, focused roster source-contract coverage, and `tasks/archive/proofs/signature-roster-polish-2026-08-16.png`.
- Next slice or stop: Stop this local slice; use the target iPad for the remaining responsive and Pencil acceptance before production promotion.

## Follow-up: Version History and Ad-Hoc Signatures — 2026-08-16

### Goal

- Retain every successfully committed signature when a signer is recaptured, expose prior private PNG/SVG revisions as usable history, and let staff/admin create one-off signers by entering a name and sport/category.

### Source Checks

- `SignatureArtifactRevision` already provides immutable, monotonically numbered revisions, but recapture finalization currently marks the previous committed revision for deletion.
- Authenticated artifact delivery already accepts any `READY` revision and derives clean filenames from the linked signer, so retained history can reuse the same private route.
- A dedicated `ADHOC` collection can reuse the existing collection/member/capture contracts without mixing manual people into imported MBB or linked Creative staff rosters. The existing member `title` field can carry the manually entered sport/category.
- The user supplied the exact Google Drive path for `WIsconsin-Regular.ttf`. CoreText reports family `WIsconsin`, PostScript name `WIsconsin-Regular`, and complete decimal-digit glyph coverage; the source and bundled copies share SHA-256 `37aa1f33c6e005870944890186950fa4b93eaf522eba3e563267fd47b9d8e27a`.

### Stop Conditions

- Do not make superseded artifacts public, mutable, or complete-counting; only the current `READY` revision determines collection readiness.
- Explicit Remove and collection Reset remain destructive privacy actions and must delete every retained revision for the affected capture scope.
- Do not synthesize or substitute a Wisconsin font. Replace the current Gotham asset only after the font family metadata of the licensed Box file is verified.

### Slices

- [x] Keep superseded successful revisions `READY`, timestamp them as replaced, and serialize revision history newest-first.
- [x] Add private version-history downloads to the existing row action menu and test recapture, remove, and reset lifecycle behavior.
- [x] Add an audited ad-hoc signer mutation that creates/reuses the season's `ADHOC` collection and stores normalized name plus sport/category.
- [x] Add the name and sport/category entry dialog to `/signatures`, then route directly to the new capture surface.
- [x] Verify the real Wisconsin jersey-number font and scope the exact supplied asset to player numerals through a dedicated font token.
- [ ] Complete authenticated browser proof after the green focused tests, TypeScript, lint, app build, and docs/codemap checks.

### Verification

- [x] Focused signature service and route tests (33/33 across capture, service, and storage).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] CoreText family/PostScript metadata and 0–9 glyph verification; focused signature capture tests 18/18 after the font contract change.
- [ ] Authenticated browser proof for a completed ad-hoc creation and live revision-history download controls. The signed-in local landing route rendered the new action, and browser verification caught/fixed additive compatibility for cached members without `revisions`; the existing local data fetch then remained pending, so no roster mutation was performed.

### Review

- Shipped locally: Successful recaptures retain earlier private `READY` revisions; current readiness still points only at the newest revision. Historical PNG/SVG files download through the existing authenticated route with clean `-vN` filenames. Explicit signer removal and collection reset queue every retained revision in scope for cleanup.
- Shipped locally: Staff/admin can enter a name, sport/category, and season from `/signatures`; the server creates or reuses the standalone `ADHOC` collection, creates the required manual signer and capture atomically, audits the mutation, and routes to capture.
- Verified: focused history/ad-hoc tests 33/33 and the updated capture/font suite 18/18, TypeScript, full lint, optimized app build, migration-prefix check (119 migrations and no schema change), codemap/docs verification, and diff checks pass. CoreText verifies the exact licensed font metadata and numeral glyphs. Authenticated local read proof rendered the new landing action and proved the cached-response compatibility fix.
- Deferred: live mutation proof, a real two-version download, production promotion, and physical iPad/Apple Pencil acceptance remain separate gates.
- Blocked: no font blocker remains. The browser controller rejected localhost navigation under its URL safety policy, so live rendering and the pending authenticated ad-hoc creation plus recapture-history download proof were not repeated in this slice.
- Next slice or stop: run authenticated ad-hoc creation, recapture-history download, and rendered jersey-font proof before promotion.

## Follow-up: Annotated Roster Simplification — 2026-08-16

### Goal

- Apply the approved `/signatures` and roster-detail annotations: shorter copy, a season picker, stronger player-number hierarchy, data-backed player position/year labels, default-required presentation, and the correct RGB-red capture action.

### Source Checks

- The shared collection page already stores imported roster metadata in `SignatureMember.title`; no schema change is needed to retain a combined player position/year label.
- MBB players already default to `required=true`, while admins can mark exceptions optional through the existing audited required-state mutation.
- The `brand` button variant owns the Capture action color through the shared `--wi-red` token.

### Stop Conditions

- Stop if current UWBadgers markup does not expose both player position and academic year within the bounded roster-card context.
- Stop if hiding default-required and unsigned labels removes the optional exception or signed-state signal.
- Stop before applying a refreshed roster to Production without explicit mutation approval.

### Slices

- [x] Simplify overview copy and replace free-text import season entry with a bounded season picker.
- [x] Parse and normalize player position plus academic year into the existing title field.
- [x] Increase jersey-number prominence, show only optional exceptions, remove redundant unsigned copy, and shorten the capture action.
- [x] Correct the shared web RGB-red brand token and verify affected Signatures CTAs in both themes.
- [x] Add focused regression coverage and complete authenticated desktop browser proof.
- [ ] Recheck the final roster at a 1024px tablet viewport when a resizable authenticated browser or target iPad is available.

### Verification

- [x] Focused signature capture/service/storage/dev-env tests (39/39) plus color-contract tests (6/6).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] Authenticated browser proof for `/signatures` and one MBB roster at 1422px, with computed style/size measurements and zero console errors.
- [ ] Authenticated 1024px tablet proof; the connected in-app browser exposes a fixed 1422px viewport.

### Review

- Shipped locally: The overview now says `Add Signature`, omits the redundant page description, presents MBB cards as the season only, removes the Creative staff subtitle, and uses a bounded season picker. Roster rows use 48px jersey medallions with 24px Wisconsin numerals, visually assume required/unsigned defaults, retain explicit Optional/Signed exceptions, shorten the action to `Capture`, and use the official `#c80000` RGB red in both themes.
- Shipped locally: UWBadgers parser version v4 normalizes source `Position G Academic Year Sr.` metadata to `Guard • Senior` in the existing member title field; no schema or migration changed.
- Verified: 45 focused tests pass across Signatures, storage, development env, and shared color contracts. TypeScript, full lint, production-shaped app build, codemap/docs, migration-prefix, and diff checks pass. Authenticated Production-backed local browser proof measured the Capture CTA as `rgb(200, 0, 0)`, jersey medallions at 48 x 48px with 24px numerals, and found no visible Required or Needs signature copy and no console errors.
- Deferred: Existing Production player rows still contain the prior null titles. Showing `Guard • Senior` live requires an explicitly approved roster Preview/Apply mutation. A fresh 1024px proof remains pending because the connected browser viewport is fixed at 1422px.
- Blocked: No source or build blocker.
- Proof artifacts: `SignatureCollectionsPage.tsx`, `SignatureCollectionPage.tsx`, `uwbadgers.ts`, shared brand tokens, focused tests, and authenticated computed-style measurements.
- Next slice or stop: Await approval before applying the refreshed 2026–27 roster metadata to Production; otherwise stop with the dev server running for continued UI work.

## Follow-up: Roster Detail Reduction and Quick Look — 2026-08-16

### Goal

- Remove the low-value readiness card and empty Requirement/Status rails, strengthen roster-name typography, make saved signatures directly previewable, and explain the capture-output settings in product language.
- Treat every player signature as required at both the interface and service boundary while retaining admin control over non-player readiness membership.

### Source Checks

- Detail breadcrumbs already support route-owned dynamic labels through `BreadcrumbContext`; the Signatures detail page is the missing consumer.
- Signature thumbnails and downloads already use the authenticated private artifact route, so Quick Look can reuse that route without exposing Blob URLs.
- Pen color, stroke width, crop padding, and maximum dimensions control the generated SVG/PNG appearance, trim, and raster bounds; they are active output settings rather than unused controls.
- Player imports default to required, but the required-state mutation currently accepts a player-to-optional transition and must enforce the product invariant server-side.

### Stop Conditions

- Do not mutate Production roster or signature data while implementing or verifying this UI slice.
- Do not expose private artifact storage URLs or bypass the authenticated artifact route for Quick Look.
- Do not remove non-player readiness controls; only players are unconditionally required.

### Slices

- [x] Remove the readiness card, Requirement/Status columns, and visible Optional labels while preserving useful group progress.
- [x] Apply Gotham Black to roster names and repair the dynamic collection breadcrumb.
- [x] Reject player-to-optional mutations in the service and remove that action from player rows.
- [x] Add an authenticated signature Quick Look and plain-language explanations for every output setting.
- [x] Complete focused tests, static gates, app build, docs synchronization, and authenticated browser proof.

### Verification

- [x] Focused signature capture/service/storage tests (37/37).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app` with ephemeral Vercel Production environment injection.
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] Authenticated browser proof for an MBB player roster, a signed Creative staff Quick Look, settings copy, breadcrumb behavior, and no runtime error overlay.

### Review

- Shipped locally: Detail rosters now use Person, Signature, and Actions only; group summaries retain signed counts without a duplicate readiness card. Optional badges are removed, person names resolve to Gotham at weight 800, and dynamic breadcrumbs identify the active collection.
- Shipped locally: Players cannot be excluded from readiness in the row menu or service mutation. Roster apply also repairs any player that reaches the import boundary with a stale optional state; non-player readiness controls remain available with clearer include/exclude language.
- Shipped locally: Clicking a committed signature opens a private authenticated Quick Look with PNG/SVG downloads. Output settings now explain ink color, line thickness, transparent trim margin, and maximum raster dimensions.
- Verified: 37 focused tests, TypeScript, lint, Production-shaped app build, codemap/docs checks, 119-migration prefix health, and diff checks pass. Authenticated Production-backed local browser proof covered both target rosters without a Production mutation; the dev server was restarted with ephemeral Production environment injection.
- Deferred: Existing Production player position/year metadata still requires the separately approved roster Preview/Apply mutation, and physical iPad/Apple Pencil acceptance remains open.
- Next slice or stop: Keep the Production-backed local server running for the next focused annotation pass; do not deploy until explicitly requested.

## Follow-up: Shared Staff Identity and Final Roster Copy — 2026-08-16

### Goal

- Finish the annotated roster copy, numeral spacing, and Quick Look details.
- Make one same-season signature follow an internal Creative staff member across the standalone Creative Staff roster and any linked team-staff roster membership.
- Replace the manual Creative Staff sync action with automatic, audited reconciliation.

### Source Checks

- `SignatureMember.linkedUserId` already provides the cross-roster identity bridge without a schema change; Creative Staff members use it today, while imported MBB staff do not.
- D-050 currently rejects name-based reconciliation. The UWBadgers source has no internal user identifier, so this slice permits only a unique exact normalized-name match among eligible active internal users and fails closed on ambiguity or an existing conflicting link.
- Private artifacts remain owned by one canonical Creative Staff capture. Linked team rows resolve that capture instead of copying Blob objects, preserving authenticated delivery and cleanup ownership.
- Signature artifacts are already cropped server-side to stroke bounds plus the configured trim margin before PNG/SVG generation.

### Stop Conditions

- Do not add a schema migration or duplicate private artifact files between captures.
- Do not auto-link players, ad-hoc signers, ambiguous names, or a member already linked to another user.
- Do not trigger automatic reconciliation during Production-backed browser verification; implementation proof must remain read-only until deployment or explicit mutation approval.
- Stop if linked capture replacement cannot remain idempotent and version-checked through the canonical Creative Staff capture.

### Slices

- [x] Reconcile the unique-match identity rule in D-050 and link eligible same-season team-staff members during Creative Staff sync.
- [x] Resolve linked reads, saves, replacements, downloads, and removal through the canonical Creative Staff capture.
- [x] Auto-run idempotent Creative Staff reconciliation when the collection landing page mounts, keep collection-list GET read-only against framework prefetch, and remove the manual Sync staff control.
- [x] Apply annotated copy, title casing, numeral tracking, and Quick Look button/header refinements.
- [x] Add focused service/source coverage, sync docs, and complete non-mutating authenticated browser proof.

### Verification

- [x] Focused signature capture/service/storage tests (40/40).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app` with ephemeral Vercel Production environment injection.
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] Authenticated browser proof for copy, numeral spacing, and Quick Look. A Production-backed framework prefetch reached the initial GET-owned automatic reconciliation and linked Ryan Dean and Cole Ahlgren (`linkedTeamMembers: 2`) before GET was hardened back to read-only; no capture or artifact data changed.

### Review

- Shipped locally: A unique exact normalized-name match links eligible same-season team staff to the internal Creative Staff identity. Players, ad-hoc members, ambiguous matches, and conflicting existing links fail closed.
- Shipped locally: Linked roster rows read, save, replace, download, and remove through one canonical Creative Staff capture and one private revision history. Capture settings and optimistic versions come from that canonical owner; no schema or Blob duplication was added.
- Shipped locally: Creative Staff reconciliation runs automatically from the mounted collection landing page through the existing mutation endpoint, remains version-checked, and writes no audit entry for an unchanged roster. Collection-list GET remains read-only so Next.js prefetch cannot mutate Production. Both manual sync controls are removed.
- Shipped locally: Detail headers omit redundant suffixes, groups use Student-Athletes and title-cased staff labels, multi-digit Wisconsin numerals use positive tracking, and Quick Look uses the signer name with equal 44px downloads and no visible implementation-description copy.
- Verified: 40 focused tests, TypeScript, lint, Production-shaped app build, codemap/docs checks, 119-migration prefix health, and diff checks pass. The React quality review found and removed the last manual sync branch.
- Browser proof: Authenticated Production-backed detail routes rendered the MBB and Creative Staff changes with no console warnings or error overlay. Jersey 15 computed to the licensed Wisconsin face at 24px with 1.44px letter spacing; Erik Role Quick Look rendered the server-cropped 469 x 189 artifact and equal 44px download actions.
- Production effect and hardening: A framework prefetch requested `/signatures` after the initial GET-owned automatic reconciliation compiled. It produced one audited Production `SYNC_CREATIVE_STAFF` change at 2026-08-16 13:57:28Z and linked the requested Ryan Dean and Cole Ahlgren MBB support records to their same-name internal users (`linkedTeamMembers: 2`). No signature capture, revision, or Blob artifact was created, copied, replaced, or removed. Automatic reconciliation was then moved to a mounted-page POST and collection-list GET restored to read-only so prefetch cannot repeat this class of hidden write.
- Deferred: Existing Production player position/year metadata still requires the separately approved roster Preview/Apply mutation. Remaining eligible shared staff links will activate on the first post-deploy mounted-page reconciliation; no deployment was performed here. Physical iPad/Apple Pencil acceptance remains open.
- Next slice or stop: Keep the Production-backed local server running for focused review; deploy only when explicitly requested.

## Follow-up: Football and Volleyball Roster Imports — 2026-08-16

### Goal

- Add first-class Football (`FB`) and Volleyball (`VB`) roster imports for the `2026-27` season so existing Illustrator captures can be matched against stable system members.

### Source Checks

- Existing `SignatureCollection.sportCode` is a string and the unique collection key already includes season, so the new team collections do not require a schema migration.
- The canonical Gear Tracker sport codes are `FB` and `VB`; the UWBadgers source uses `/sports/football/roster/2026` and `/sports/womens-volleyball/roster/2026` for the 2026 roster pages while Gear Tracker retains `2026-27`.
- The current parser already deduplicates profile links by source identity; the sport-aware source map keeps MBB behavior separate and prevents an unsupported sport from falling back to MBB.

### Slices

- [x] Add allowlisted MBB, Football, and Volleyball source configuration with sport-specific source keys and parser versions.
- [x] Generalize roster URL construction and profile matching for Football and Volleyball, including player position/year labels.
- [x] Add sport selection to roster preview/apply and label the resulting collections as Football or Volleyball.
- [x] Add focused parser, collection-preview, and UI contract coverage for `FB` and `VB`.
- [ ] Preview and explicitly apply the `2026-27` Football and Volleyball rosters in the target environment.
- [ ] Add and execute the private Illustrator asset backfill/matching flow after the source files and manifest are available.

### Verification

- [x] Focused Signature Capture/service/storage tests (44/44).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint -- --quiet`
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`

### Review

- Shipped locally: Staff/admin can select MBB, Football, or Volleyball in the existing UWBadgers roster import panel; previews remain immutable and apply remains collection-version checked and non-destructive.
- Deferred: No Football or Volleyball roster has been applied or deployed from this slice. Illustrator asset backfill remains intentionally separate so matching can be dry-run and reviewed before private artifact writes.
- Next slice: preview the two 2026-27 sources, review matched roster identity, then import Illustrator PNG/SVG pairs through a duplicate-safe private artifact path.
