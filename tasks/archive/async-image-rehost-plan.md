# Plan: Move CSV-import image re-hosting out of the request path

## Problem
`src/app/api/assets/import/route.ts` step 7 (lines ~680-720) re-hosts external
Cheqroom CDN images to Vercel Blob inline, best-effort, in batches of 5, all
inside one serverless request. With ~180 images this blows the 10s (Hobby)
function timeout, so only a fraction get re-hosted and the rest keep raw
`attachments.cheqroomcdn.com` URLs. Those URLs are hostage to a SaaS the team
has migrated off — the upstream cause of "asset photos not displaying in
production".

## Approach (Option 1: cron drain — confirmed with advisor + user)
- No queue table. The signal "asset has a non-blob `imageUrl`" IS the queue.
- Add one field `Asset.imageRehostAttempts` to cap retries on permanently-dead URLs.
- Import stops re-hosting inline — it just creates/updates assets with whatever
  URL the CSV carried (blob or external).
- A daily Vercel Cron drains a small batch within the 10s budget, downloading
  external images to Blob and rewriting `imageUrl` (reusing the
  `downloadImageToBlob` + backfill pattern). Failures increment
  `imageRehostAttempts`; rows past MAX_ATTEMPTS are skipped.
- The current ~180 backlog is fixed out-of-band by running
  `scripts/backfill-asset-images.mjs --apply` once (no serverless timeout).

## Plan tier: Hobby
- Cron frequency: once/day. Schedule `0 4 * * *` (avoids existing 3am/8am/9am crons).
- Function cap: 10s. Cron processes a small batch with a wall-clock guard.

## Slices
1. **Schema/migration**: add `imageRehostAttempts Int @default(0)` to `Asset`.
   `npm run db:migrate:new -- --name add-asset-image-rehost-attempts`.
2. **Import route**: delete inline step 7; rename `imagesHosted` → `imagesQueued`
   (count of external images deferred to cron) in response + audit.
3. **Cron**: `src/app/api/cron/rehost-images/route.ts` via `withCron`. Query
   non-blob `imageUrl` with `imageRehostAttempts < MAX`, process a bounded batch
   with concurrency + wall-clock deadline, update on success, increment on failure.
4. **vercel.json**: add the cron entry.
5. **Docs**: AREA_ITEMS.md change log; GAPS_AND_RISKS if applicable.
6. **Verify**: `npm run build`.

## Out of scope / known gaps
- `BulkSku.imageUrl` external URLs are NOT handled here (matches the backfill
  script + the task's "asset photos" scope). Note in GAPS_AND_RISKS.
