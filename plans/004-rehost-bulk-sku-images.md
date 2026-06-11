# Plan 004: Rehost external BulkSku images through Blob

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- prisma/schema.prisma src/app/api/cron/rehost-images/route.ts scripts/backfill-asset-images.mjs src/app/api/assets/import/route.ts 'src/app/api/bulk-skus/[id]/image/route.ts' docs/GAPS_AND_RISKS.md docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md tests`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: M/L
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The app moved asset images to Vercel Blob so production gear photos do not depend on fragile third-party CDN URLs. Item-family images backed by `BulkSku.imageUrl` still bypass that drain after CSV import. This leaves bulk item-family photos exposed to the same privacy, availability, and mixed-source risk that the asset-image rehost cron was created to remove.

## Current State

- `docs/GAPS_AND_RISKS.md:306` explicitly says only `Asset.imageUrl` is drained and `BulkSku.imageUrl` remains exposed.
- `src/app/api/cron/rehost-images/route.ts:31-41` selects candidates from `db.asset.findMany`.
- `prisma/schema.prisma:279-280` gives `Asset` both `imageUrl` and `imageRehostAttempts`.
- `prisma/schema.prisma:412-427` gives `BulkSku` `imageUrl` but no rehost attempt counter.
- `src/app/api/assets/import/route.ts:613-627` upserts `BulkSku.imageUrl` from CSV rows.
- `src/app/api/assets/import/route.ts:695-700` says the cron picks up non-Blob `imageUrl`, but the current cron only picks up assets.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Prisma format | `npx prisma format` | exit 0 |
| Migration prefix check | `npm run db:migrate:check` | exit 0 |
| Focused tests | `npm test -- rehost` or the new focused test file | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Full tests | `npm test` | exit 0 |
| Build check | `npm run build:app` if Plan 001 has landed, otherwise `npm run build` with valid local env | exit 0 |

## Scope

**In scope**:
- `prisma/schema.prisma`
- A new Prisma migration adding `BulkSku.imageRehostAttempts`
- `src/app/api/cron/rehost-images/route.ts`
- `scripts/backfill-asset-images.mjs`, renamed or generalized only if needed
- `src/app/api/assets/import/route.ts` comment and queued count semantics
- Tests for cron/backfill candidate selection and retry behavior
- `docs/GAPS_AND_RISKS.md`, `docs/AREA_ITEMS.md`, `docs/AREA_BULK_INVENTORY.md`

**Out of scope**:
- Do not change the item-family product model.
- Do not change `/api/bulk-skus/[id]/image` immediate rehost behavior.
- Do not bulk-delete or rewrite production URLs without an explicit `--apply` style operator action.
- Do not increase cron work beyond the existing Vercel time budget without measuring it.

## Git Workflow

- Branch: `codex/004-rehost-bulk-sku-images`
- Commit message: `fix: rehost item-family images through Blob`

## Steps

### Step 1: Add BulkSku retry tracking

Add `imageRehostAttempts Int @default(0) @map("image_rehost_attempts")` to `BulkSku`, mirroring `Asset.imageRehostAttempts`.

Create a Prisma migration. Follow the repo migration flow in `docs/PRISMA_NEON_RUNBOOK.md`: edit schema, run `npx prisma format`, create migration, run `npm run db:migrate:check`.

**Verify**: `npm run db:migrate:check` -> exit 0 and no prefix collisions.

### Step 2: Extend the cron while preserving the time budget

Update `src/app/api/cron/rehost-images/route.ts` so it processes both assets and bulk SKUs under the same `DEADLINE_MS`, `CONCURRENCY`, `MAX_ATTEMPTS`, `PER_IMAGE_TIMEOUT_MS`, and `MAX_IMAGE_BYTES` principles.

Keep response data explicit, for example:

```ts
{
  assets: { processed, rehosted, failed, remaining },
  bulkSkus: { processed, rehosted, failed, remaining }
}
```

If the existing response shape has tests or consumers, add fields without removing old ones.

**Verify**: focused cron tests pass.

### Step 3: Generalize or duplicate the backfill script deliberately

Either:

- Generalize `scripts/backfill-asset-images.mjs` into an asset plus bulk SKU backfill with a clear CLI option, or
- Add a sibling script for bulk SKU images.

Preserve dry-run default and require an explicit apply flag for writes.

**Verify**: dry-run command exits 0 without writing data when no live DB env is provided, or document that it requires DB env and test the parser/helper code separately.

### Step 4: Fix importer comment and docs

Update the import comment at `src/app/api/assets/import/route.ts:695-700` so it accurately says both asset and bulk item-family image URLs are queued for cron rehosting.

Update docs:

- `docs/GAPS_AND_RISKS.md`: close or revise the BulkSku backfill gap.
- `docs/AREA_ITEMS.md`: record item-family image rehost behavior.
- `docs/AREA_BULK_INVENTORY.md`: record the retry counter and operator behavior.

**Verify**: `rg -n "BulkSku.*rehost|item-family image|imageRehostAttempts" docs src prisma` -> shows updated docs and code.

## Test Plan

Add tests that prove:

- Cron selects non-Blob `Asset.imageUrl` and non-Blob `BulkSku.imageUrl`.
- Cron skips Blob URLs for both models.
- Failures increment the correct attempt counter.
- Success rewrites the correct row and does not increment attempts.
- Remaining counts include both models.
- Backfill script dry-run includes bulk SKU candidates.

## Done Criteria

- [x] `BulkSku` has a retry counter migration.
- [x] Cron drains both asset and bulk SKU external images.
- [x] Backfill path can handle bulk SKU image backlog.
- [x] Import comments no longer claim asset-only behavior covers all images.
- [x] `docs/GAPS_AND_RISKS.md` no longer lists this as an open gap.
- [x] `npm run db:migrate:check` exits 0.
- [x] `npx tsc --noEmit` exits 0.
- [x] `npm test` exits 0.
- [x] Build check exits 0.
- [x] `plans/README.md` status row updated.

## Review

- 2026-06-11: Implementation added `BulkSku.imageRehostAttempts`, migration `0077_add_bulk_sku_image_rehost_attempts`, combined Asset/BulkSku cron processing with additive response buckets, and generalized the image backfill script while keeping dry-run default. Prisma `migrate dev --create-only` hit the repo's known blank Neon schema-engine failure; migration SQL was generated with `prisma migrate diff` from the pre-change schema to the current schema and committed as a normal migration folder.
- 2026-06-11: Verification passed: `npm run db:migrate:check`, `npx prisma validate`, focused rehost/backfill tests, `npx tsc --noEmit`, `npm test` (196 files, 1153 tests), `DIRECT_URL="" npm run build:app`, and `git diff --check`.

## STOP Conditions

- A migration touching `BulkSku` is already in progress.
- Production has external bulk image URLs but no acceptable operator window for backfill.
- Existing cron consumers require the exact current response shape and cannot accept additive fields.

## Maintenance Notes

Reviewers should check Vercel budget carefully. The fix should expand candidate coverage without turning one cron invocation into a large backfill job.
