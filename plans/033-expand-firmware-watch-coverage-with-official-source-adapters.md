# Plan 033: Expand firmware watch coverage with verified official sources

## Metadata

- Priority: P2
- Effort: M/L
- Risk: MED
- Type: direction
- Depends on: 031, 032
- Planned at: 8d445512
- Status: TODO

## Problem

Firmware watch is live for a small verified Sony set, but GAP-59 remains open because several live camera bodies are skipped. The current system intentionally avoids guessed URLs and only seeds targets when an official source and parser are proven. That caution is correct, but it needs a structured coverage pass so the gap can shrink without lowering source quality.

Current skipped examples from the inventory report:

- Sony `ILCE-1M2`
- Sony `ILCE-7M5`
- Sony `ILCE-9M3`
- DJI `DJMAVIC3CRC`
- GoPro `CHDHX-112-TH`
- Insta360 `CINSAATA_GO3S13`
- Insta360 `CINSABMA`
- JVC `GY-HM250U`

## Goal

Expand firmware watch coverage only for camera bodies with verified official manufacturer source URLs and parser-backed release metadata.

## Scope

- Refresh official-source evidence for skipped live camera bodies.
- Add parser support only when the source format is stable and testable.
- Update seed targets for newly verified sources.
- Add fixtures and tests for every new parser or source type.
- Update the inventory report and GAP-59.

## Out Of Scope

- Using third-party firmware aggregators.
- Guessing support URLs from product names.
- Adding targets whose page cannot expose a reliable version string.
- Adding a broad web scraper that depends on fragile JavaScript rendering.
- Adding a schema enum migration inside this plan without stopping first.

## Implementation Steps

1. Refresh source evidence.
   - Search current official manufacturer sites for every skipped model.
   - Use only manufacturer-owned pages as source candidates.
   - Record candidate URL, source type, latest visible version, release date if present, and parser feasibility in `tasks/firmware-watch-inventory-report.md`.
   - Do not promote any source whose page cannot be verified from an official URL.

2. Decide parser path per manufacturer.
   - Sony unresolved models can use `SONY_SUPPORT` only if their official Sony support pages expose the same parseable metadata contract.
   - Canon should remain unsupported unless there is a live Canon camera body and a parser-backed official source.
   - DJI, GoPro, Insta360, and JVC require explicit parser support and source type decisions.
   - If adding a source type requires a Prisma enum value, stop and write a migration plan before implementation.

3. Add parser fixtures and tests.
   - Store minimal static fixtures for each new official source format.
   - Test version extraction, release-date extraction when available, missing-version rejection, and unsupported-host rejection.
   - Keep the poller behavior unchanged: baseline first observation, notify only on later version changes.

4. Update seed coverage.
   - Add verified targets to `scripts/seed-firmware-watch-targets.mjs`.
   - Keep dry-run as the default.
   - Preserve expected-model checks where a page can expose model identifiers.
   - Keep unresolved targets listed with a reason when official support remains unavailable or unparseable.

5. Update docs.
   - Update `tasks/firmware-watch-inventory-report.md` with seeded and still-skipped targets.
   - Update `docs/AREA_ITEMS.md` firmware watch coverage.
   - Update `docs/DECISIONS.md` only if the official-source policy changes.
   - Update `docs/GAPS_AND_RISKS.md` to reduce or close GAP-59 based on verified coverage.
   - Mark this plan `DONE` in `plans/README.md` after verification.

## Acceptance Criteria

- Every newly seeded target has an official manufacturer source URL.
- Every new source format has parser tests using stable fixtures.
- No new target is added from an unofficial aggregator or guessed URL.
- Unsupported or unparseable live bodies remain explicitly documented as skipped.
- Existing Sony targets continue to poll and notify as before.

## Verification

Run:

```bash
npx vitest run tests/firmware-watch.test.ts
node --check scripts/seed-firmware-watch-targets.mjs
npx prisma validate
npx tsc --noEmit
npm run db:migrate:check
npm run build:app
git diff --check
```

If source checks require live network access, record the exact manufacturer pages checked and the date checked in `tasks/firmware-watch-inventory-report.md`.

## STOP Conditions

- Stop if only unofficial or reseller pages are available for a target.
- Stop if a source needs a new Prisma enum value and no migration plan exists.
- Stop if a source page is PDF-only or JavaScript-rendered and no stable fixture/parser contract can be defined.
- Stop if a page exposes a download but no reliable latest-version signal.

