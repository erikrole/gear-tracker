# Plan 031: Centralize firmware watch source and coverage rules

## Metadata

- Priority: P1
- Effort: M
- Risk: MED
- Type: tech debt
- Depends on: none
- Planned at: 8d445512
- Status: TODO

## Problem

Firmware watch behavior is working, but the rules are split across runtime service code, asset detail matching, and the seed script. The same brand/model canonicalization and official-source constraints now exist in multiple places, which raises the chance that future coverage work will seed targets that the runtime cannot match or cannot safely poll.

Current evidence:

- `FirmwareWatchTarget` already stores brand, model, source URL, source type, support mode, enabled state, latest release metadata, and polling errors.
- Runtime polling currently supports Sony support pages only.
- Asset detail matching has local Sony canonicalization logic.
- The seed script has separate canonicalization, Sony parser, and unresolved-target handling.
- `CANON_SUPPORT` exists in the Prisma enum but has no runtime parser or allowed host entry.

## Goal

Create one shared source of truth for firmware watch identity normalization, supported source types, and source URL validation so future target-management UI and coverage expansion can build on a stable contract.

## Scope

- Add a shared firmware watch helper module under `src/lib/`.
- Move or mirror canonical brand/model normalization into the shared helper.
- Move runtime source-type support and host allowlist into the shared helper.
- Update the poller and asset detail route to consume the helper.
- Add source-contract coverage for canonicalization and supported/unsupported source behavior.
- Keep the seed script dry-run behavior intact.

## Out Of Scope

- Adding new firmware source parsers.
- Adding a settings UI.
- Changing the database schema or enum values.
- Seeding additional targets.

## Implementation Steps

1. Add `src/lib/firmware-watch-targets.ts`.
   - Export `normalizeFirmwareBrand`.
   - Export `canonicalFirmwareModel`.
   - Export `canonicalFirmwareIdentity`.
   - Export `validateFirmwareSourceUrl`.
   - Export `isSupportedFirmwareSourceType`.
   - Represent `SONY_SUPPORT` as supported.
   - Represent `CANON_SUPPORT` as schema-known but runtime-unsupported until a parser is implemented.

2. Update `src/lib/services/firmware-watch.ts`.
   - Consume the shared URL validation and source-type support helper.
   - Keep Sony parsing behavior unchanged.
   - Keep unsupported source types failing before fetch with a clear error.
   - Preserve notification dedupe and baseline behavior.

3. Update `src/app/api/assets/[id]/route.ts`.
   - Replace local firmware brand/model canonicalization with the shared helper.
   - Preserve current Sony aliases:
     - Strip `/B` suffix.
     - Convert `LCE-` to `ILCE-`.
     - Convert `ILME-FX6` to `ILME-FX6V`.

4. Add tests.
   - Cover shared canonicalization for Sony aliases and non-Sony passthroughs.
   - Cover runtime rejection for schema-known but unsupported source types.
   - Keep existing firmware watch parser, baseline, notification, and asset detail display tests green.

5. Reconcile the seed script.
   - Do not attempt to import TypeScript from `scripts/seed-firmware-watch-targets.mjs` unless the repo already has supported tooling for that path.
   - Add a source-contract test that compares script-documented alias rules to the shared helper, or leave a short comment in the script pointing to the shared runtime helper as the authoritative contract.

6. Update docs.
   - Update `docs/AREA_ITEMS.md` firmware watch section if the shared contract changes developer-facing behavior.
   - Update `docs/GAPS_AND_RISKS.md` only if this closes part of GAP-59. It likely reduces implementation risk but does not expand coverage.
   - Mark this plan `DONE` in `plans/README.md` after verification.

## Acceptance Criteria

- Firmware watch polling still supports Sony support pages exactly as before.
- Asset detail firmware matching still finds the same seeded Sony targets.
- Unsupported schema source types fail clearly before any network fetch.
- Canonicalization rules are test-covered in one shared contract.
- No database schema change is introduced.

## Verification

Run:

```bash
npx vitest run tests/firmware-watch.test.ts tests/item-detail-firmware-display.test.ts
node --check scripts/seed-firmware-watch-targets.mjs
npx prisma validate
npx tsc --noEmit
npm run db:migrate:check
npm run build:app
git diff --check
```

## STOP Conditions

- If moving helpers would require bundling Prisma client types into a client component, stop and split server-safe and type-only modules.
- If a source type needs a new Prisma enum value, stop and create a migration-specific plan.
- If any change causes seed script execution to require app compilation or database access in dry-run mode, stop and redesign.

