# Product Image Search Plan - 2026-05-20

## Goal
- Let staff pick a clean product photo while adding or editing an item, without scraping retailer pages and without changing the item creation contract.
- Keep the human in the loop. The app should suggest candidate images, show the source domain, and re-host the chosen image through the existing Vercel Blob image routes.

## Source Checks
- `docs/DECISIONS.md`: D-005 is withdrawn because B&H scraping was blocked. Any revival must use a source or API with explicit access.
- `docs/AREA_ITEMS.md`: item creation already supports upload, URL image selection, and manual override behavior. It also says metadata enrichment from external product URLs is not supported in V1, so this feature is image-only.
- `docs/AREA_BULK_INVENTORY.md`: bulk item families are backed by `BulkSku`, appear in `/items`, and have their own image endpoint.
- `docs/GAPS_AND_RISKS.md`: async image re-hosting recently shipped for `Asset.imageUrl`, but `BulkSku.imageUrl` still has a known third-party CDN exposure follow-up.
- `src/components/ChooseImageModal.tsx`: one shared modal already owns paste URL, upload, remove, and save behavior.
- `src/app/api/assets/[id]/image/route.ts`: asset image `PUT` already requires edit permission, accepts HTTPS URLs, downloads to Blob, deletes previous Blob images, and writes audit history.
- `src/app/api/bulk-skus/[id]/image/route.ts`: bulk SKU image `PUT` mirrors the same re-host and audit pattern for `BulkSku`.
- `src/lib/rate-limit.ts`: `enforceRateLimit` already supports Upstash Redis with an in-memory fallback.
- Brave official docs, checked 2026-05-20: Brave has a supported image search endpoint at `/res/v1/images/search` with token auth, SafeSearch, count, country, language, and 429 responses.

## Decision
- Build on **Brave Search API**.
- Keep the internal helper small enough that another provider can be added later if Brave stops fitting, but do not ship extra provider setup now.
- Do not scrape B&H, Google Images HTML, retailer pages, or CDN pages.

Reason: Brave gives us an official image-search API. Extra legacy provider branches create setup drag without a real benefit for this project.

## User Setup

### Recommended: Brave
1. Create or use a Brave Search API account.
2. Add this env var locally and in Vercel Production plus Preview:
   - `BRAVE_SEARCH_API_KEY=...`
If no supported provider is configured, the Search tab is hidden and paste URL plus upload continue to work.

## Slice 1: Provider, Config, and API

### Files
- Edit `src/lib/env.ts`
- Add `src/lib/image-search.ts`
- Add `src/app/api/image-search/route.ts`
- Edit `.env.example`

### Config
- Add optional env getters:
  - `braveSearchApiKey`
- Add `.env.example` comments for Brave setup.

### Provider Shape
```ts
export type ImageSearchResult = {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  sourceUrl: string;
  sourceDomain: string;
  width: number | null;
  height: number | null;
};
```

Provider contract:
- `isImageSearchConfigured(): boolean`
- `getImageSearchProviderName(): "brave" | "none"`
- `searchProductImages(query: string): Promise<ImageSearchOutcome>`

Outcome:
- `{ status: "ok", results }`
- `{ status: "unconfigured", results: [] }`
- `{ status: "quota", results: [] }`
- `{ status: "failed", results: [] }`

### Brave Adapter
- Endpoint: `https://api.search.brave.com/res/v1/images/search`
- Headers:
  - `Accept: application/json`
  - `Accept-Encoding: gzip`
  - `X-Subscription-Token: <BRAVE_SEARCH_API_KEY>`
- Params:
  - `q`
  - `count=12`
  - `country=US`
  - `search_lang=en`
  - `safesearch=strict`
  - `spellcheck=1`
- Map each result into the provider shape. Normalize the source from the result page URL when available.
- Treat HTTP 429 as quota or rate limit. Treat 401 and 403 as failed configuration.

### Filtering
- Normalize whitespace and cap query length at 200 characters.
- Drop results with no direct image URL.
- Drop obviously tiny images when dimensions are known and the long edge is under 300px.
- De-dupe by direct image URL first, then by thumbnail URL.
- Prefer results with a usable source page URL and domain.
- Return no more than 8 results to the UI.

### API Route
- `GET /api/image-search`
- Use `withAuth`.
- Gate with `requirePermission(user.role, "asset", "edit")`. This matches the staff/admin gate for assets, and current permissions give the same roles bulk SKU edit rights.
- `?probe=1` returns provider status without calling an external API:
  - `{ data: { configured: boolean, provider: "brave" | "none" } }`
- Normal query:
  - Validate `q` with zod: trimmed string, 1 to 200 chars.
  - Rate limit by user: `image-search:${user.id}`, 30 searches per minute.
  - Return `ok({ configured, provider, quotaExceeded, results })`.

### Cache
- Cache by provider plus normalized query for 1 hour.
- Reuse the same Redis env as `src/lib/rate-limit.ts` if configured.
- If Redis is not configured or fails, use an in-memory Map with timestamp.
- Cache successful result arrays and quota responses briefly. Do not cache generic failures for long.

## Slice 2: ChooseImageModal Search Tab

### Files
- Edit `src/components/ChooseImageModal.tsx`
- Use existing shadcn components from `src/components/ui/`

### Props
- Add `searchQuery?: string`

### Behavior
- On open, if `searchQuery` is present, call `/api/image-search?probe=1`.
- Render the Search tab only when configured.
- If configured and `searchQuery` exists, default to Search and run the first search automatically.
- Preserve current URL and Upload tabs exactly when unconfigured.
- Keep all user-triggered fetches guarded:
  - 401 handling through `handleAuthRedirect`
  - `parseErrorMessage`
  - double-click guard while saving or searching
  - AbortController for search requests when the query changes or the modal closes

### UI
- Search tab includes:
  - editable input prefilled from `searchQuery`
  - Search button
  - loading skeleton grid
  - 2 to 4 column responsive thumbnail grid
  - source domain under each result
  - selected tile treatment
  - one-line guidance: `Pick a manufacturer or product photo.`
- Empty state:
  - `No images found. Try a more specific search.`
- Quota state:
  - `Image search quota reached. Paste a URL or upload a file instead.`
- Failure state:
  - `Image search failed. Paste a URL or upload a file instead.`

### Save Flow
- Keep the existing `PUT uploadEndpoint` path.
- When a search result is selected, save the selected result URL through the existing URL save path.
- If the full image URL fails to re-host, retry once with `thumbnailUrl`.
- If both fail, show the existing parsed error and keep the selection visible.
- Continue to call `onImageChanged` with the Blob URL returned by the image endpoint.

## Slice 3: Thread Search Seeds Through Call Sites

### Files
- Edit `src/app/(app)/items/new-item-sheet.tsx`
- Edit `src/app/(app)/items/[id]/page.tsx`
- Edit `src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx`

### New Item Sheet
- On successful serialized item creation, preserve a search seed derived from the submitted body:
  - `brand model`
  - fallback `name`
  - fallback `assetTag`
- Pass `searchQuery={searchSeed}` to the post-create `ChooseImageModal`.
- Keep no change to the create POST body.

### Item Detail
- Pass `searchQuery` from:
  - `brand model`
  - fallback `name`
  - fallback `assetTag`

### Bulk SKU Header
- Pass `searchQuery={sku.name}`.
- This is especially useful because `BulkSku.imageUrl` still has a known external-image follow-up risk.

## Slice 4: Tests

### Unit Tests
- Add provider tests for:
  - query normalization
  - provider configured and unconfigured states
  - Brave response mapping
  - quota classification
  - tiny image filtering
  - URL and thumbnail de-dupe
  - cache hit avoids provider call

### Route Tests
- Add `GET /api/image-search` coverage for:
  - unauthenticated request
  - student forbidden
  - staff/admin allowed
  - `probe=1`
  - invalid query
  - configured provider success
  - quota response
  - rate limit 429

### UI Tests
- Add focused component tests where the existing test stack supports them:
  - Search tab hidden when unconfigured
  - Search tab defaults active with a seed
  - result selection enables Save
  - full image save failure retries thumbnail
  - paste URL and upload still work when search is hidden

## Slice 5: Docs

### Files
- `.env.example`
- `docs/AREA_ITEMS.md`
- `docs/AREA_BULK_INVENTORY.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md` if the bulk image risk is reduced by the chosen flow

### Doc Updates
- Add a decision record for Brave-backed human-pick image search.
- State that this replaces the withdrawn B&H scrape direction and does not do metadata enrichment.
- Add the setup notes for Brave.
- Add a change log entry to `AREA_ITEMS.md`.
- Add a `BulkSku.imageUrl` note only if the implementation materially improves bulk external image re-hosting risk.

## Verification
- `npx vitest run tests/image-search.test.ts`
- `npx vitest run tests/api-image-search.test.ts`
- `npx tsc --noEmit`
- `git diff --check`
- `npx next build`
- With Brave keys set locally:
  - start `npm run dev`
  - create a standard item for `Sony FX3`
  - click Add image
  - confirm Search opens with `Sony FX3`
  - confirm results render with source domains
  - pick one and save
  - confirm saved `imageUrl` is a Vercel Blob URL
  - confirm the image renders in the list and detail header
- Repeat from item detail.
- Repeat from a bulk SKU header.
- Unset provider keys:
  - confirm Search tab is absent
  - confirm Paste URL still saves
  - confirm Upload still saves
- Force provider 429 or mocked quota:
  - confirm quota message
  - confirm Paste URL and Upload remain available.

## Stop Conditions
- Stop if no current provider can be configured. Do not ship dead UI.
- Stop if the selected provider terms block storing or re-hosting returned images.
- Stop if Brave result mapping does not expose enough source context for a trustable pick grid.
- Stop if the chosen route response shape differs from the modal assumptions.
- Stop if save-to-Blob fails for normal direct image URLs, because search without reliable re-hosting would create broken item photos.

## Suggested Improvements and Features
- Add a small domain trust cue: manufacturer, retailer, marketplace, unknown.
- Add a source-domain allow or block list in code config, starting with obvious low-quality domains only after observing real results.
- Add an optional `white background` filter by biasing the query text with `product photo white background`.
- Add a `manufacturer only` quick filter by appending the detected brand to the query and excluding marketplace-heavy terms only if results are noisy.
- Add search suggestions under the input:
  - `brand model`
  - `brand model product photo`
  - `brand model front`
  - `brand model kit`
- Add a small "Open source" link on result tiles so staff can inspect uncertain images before saving.
- Store only the final Blob URL on the item. Do not persist raw search result URLs unless a future audit requirement needs provenance.
- Consider a future `imageSourceDomain` audit metadata field only if operations needs to know where a picked photo came from.
- Add provider usage logging without query contents first: provider, status, result count, latency, quota flag. Add query logging only if there is a clear operational need.
- Add a periodic provider health check in diagnostics only if search becomes important enough to support.

## Deferred
- Auto-selecting the first result. Too risky because top image results often include rentals, kits, or unrelated accessories.
- Metadata enrichment. This plan is image-only and must not overwrite item identity or `tagName`.
- Admin UI for provider keys. Env configuration matches existing optional services.
- Multi-photo gallery. Current data model stores one primary image.
- Bulk automated backfill through search. Human pick avoids wrong-image mass writes.
