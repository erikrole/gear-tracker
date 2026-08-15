# Signature Capture Micro-App — Execution Ledger

## Goal

Ship the Men’s Basketball signature-capture pilot as an authenticated staff/admin web workflow. Apple Pencil is the only drawing input; touch remains available for controls. Captures are server-rendered into matching private PNG and SVG artifacts, associated with an immutable UWBadgers roster snapshot, and counted complete only after both artifacts and the database state commit.

## Current State

The V1 implementation is deployed through the web, API, schema, artifact, storage, and cleanup contracts. Production migration health reports 119/119 applied migrations with no pending rows, and the live `/signatures` route correctly redirects unauthenticated users to `/login`. The configured development Neon database has the signature schema and authenticated in-app browser smoke passes. The 2026–27 MBB roster is reconciled into 14 players, 7 required coaching staff, and 11 optional support staff; players are presented by jersey number and staff follows the UWBadgers source order, with Greg Gard first for Men’s Basketball. Creative staff are a separate `CREATIVE` collection sourced from active full-time Video/Photo/Graphics accounts, with explicit sync and last-name ordering; the development readback contains 12 active accounts, including Erik Role for capture testing. The unwanted 2025–26 Preview collection is archived and hidden from the active chooser by default, with an admin-only restore path. Rollout remains gated on private Blob provisioning, cleanup failure-injection proof, and physical iPad Safari acceptance.

## Scope

- Canonical collection key: `sportCode + season`, with `MBB` for Men’s Basketball and `CREATIVE` for the standalone Creative staff roster.
- External roster members are separate from Gear Tracker users and may have a nullable user link. Creative staff use linked full-time Video/Photo/Graphics accounts as separate signature members with no external snapshot and never live in the MBB collection.
- UWBadgers import is fixed to an allowlisted adapter with structural parsing, profile-identity deduplication, preview persistence, and versioned reconciliation. Creative staff sync is explicit, version-checked, audited, and preserves imported roster state.
- Required members are active MBB players/coaching staff and standalone Creative staff by default. Support staff are imported but optional.
- Private app-managed storage is required. Box, native PencilKit, ZIP export, scheduled roster sync, multi-sport adapters, pressure width, and superseded-file retention are deferred.

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
| Deterministic SVG/PNG artifact engine | Complete | Focused tests verify hashes, dimensions, transparency, and SVG sanitization. |
| Private Blob lifecycle and authenticated delivery | Implemented locally | Requires provisioned private store and failure-injection proof. |
| Collection, roster, capture, settings, and file library UI | Verified in development | Landing cards show separate MBB and Creative staff rosters. The standalone Creative staff card syncs active full-time Video/Photo/Graphics accounts; MBB remains players/coaches/support only. Completed cards render the committed PNG beneath the signer identity; incomplete-state actions clear after save and file/lifecycle actions remain in the compact accessible menu. Authenticated browser readback verifies 12 Creative staff members and Erik Role’s capture tile. |
| Roster hierarchy, source ordering, and active-year management | Verified in Preview | Source-role identity parser v3 reconciled the 2026–27 collection to 14 players, 7 required coaches, and 11 optional support staff; players sort numerically, staff preserves source order with Greg Gard first, and the 2025–26 collection is archived/hidden by default with version-checked restore. |
| Operational closeout | Open | Physical iPad, private storage, cleanup failure-injection, and authenticated production workflow proof remain. |

## Verification

- Pure tests for pointer gating, draft expiry/keying, roster parsing/deduplication/reconciliation, artifact sanitization/determinism, permission roles, and save lifecycle transitions.
- `npx prisma validate`, `npm run db:migrate:check`, focused tests, `npx tsc --noEmit --pretty false`, lint, `npm run build:app`, `npm run codemap`, `npm run verify:docs`, and `git diff --check`.
- Authenticated browser proof and physical iPad Safari proof remain explicit acceptance gates; local source/build success cannot replace them.

Local verification on 2026-08-15: focused signature tests 11/11 plus six signature-service tests, TypeScript, focused lint, Prisma validation with placeholder URLs, migration-prefix check, `git diff --check`, and migration health (119/119) passed. The full suite passed 489/489 with CI placeholder database variables. Migration generation hit the repository's blank schema-engine failure, so `0114_signature_creative_staff` was authored as the additive enum/nullability migration and applied through the working development Neon pooler URL. Authenticated browser smoke covers the 2026–27 collection with numeric player order, source-order staff sections (Greg Gard first), separate Players / Coaching staff / Support staff groups (14 / 7 / 11), a standalone Creative staff roster with 12 active full-time Video/Photo/Graphics accounts, and the admin-only archived-year chooser path. Production deployment `dpl_5WSeBG88rhaBNKKmtfM6ETVX75Um` completed after the Vercel build was hardened for its memory limit; the live unauthenticated redirect passed. Provisioned private Blob failure injection, authenticated production workflow proof, and physical iPad proof remain open.

## Review Notes

- Pencil contract: pen-class web gate (`pointerType === "pen"`), not cryptographic Apple Pencil identification.
- No client-provided SVG, PNG, filename, path, Blob URL, or private token is trusted.
- Stale collection, snapshot, settings, capture, and request versions return `409` while preserving the local draft and prior committed capture.
- The local pre-iPad hardening pass keeps Pencil resize/input handling stable, binds request IDs to their original target, preserves required-state overrides across unchanged imports, and invalidates in-flight saves during collection reset.
