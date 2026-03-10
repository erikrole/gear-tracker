# B&H Metadata Enrichment V1

## 1) Feature Header
- Feature name: B&H Product URL Enrichment
- Owner: Erik
- Date: 2026-03-10
- Priority: High
- Target phase: Now (Phase A)

## 2) Problem
- Current pain: When adding new gear, staff must manually type brand, model, and product name. This is slow and error-prone.
- Why now: Item creation flow is complete — enrichment is the next logical step to reduce data entry friction.
- Who is blocked: Staff adding new items to inventory.

## 3) Outcome
- Expected behavior: Staff paste a B&H product URL, fields auto-populate with brand/model/name, user edits and saves.
- Success signal: Item creation with B&H URL takes <30 seconds vs >2 minutes for manual entry.

## 4) Scope
### In scope
- Server-side API endpoint to fetch and parse B&H product pages
- Extract: product title, brand, model/MFR number, image URL
- Client-side: "Paste B&H URL" input in item create form
- Auto-prefill brand, model, name (productName), imageUrl fields
- User can edit any prefilled field before save
- Graceful fallback: parse failure shows warning, manual entry continues

### Out of scope
- Image upload/hosting (just store the B&H CDN URL)
- Caching layer (V2 concern)
- Other retailers (Amazon, Adorama, etc.)
- Enrichment for existing/already-created items (V2)
- Image proxy or download

## 5) Guardrails
- B&H import must NEVER overwrite `assetTag` (tagName). Tag is physical and user-assigned.
- Import failure must not block manual item creation.
- Server-side fetch only — no client-side CORS issues.
- Parser must handle B&H page structure changes gracefully (fail open, not crash).
- No new Prisma schema changes needed — `name`, `brand`, `model`, `imageUrl`, `linkUrl` already exist.

## 6) Affected Areas
- Domain area: Assets
- User roles affected: ADMIN, STAFF (item creators)
- Location impact: All

## 7) Data and API Impact
- Data model: No changes — uses existing Asset fields
- Read-path: No changes
- Write-path: New `POST /api/enrichment/bh` endpoint (fetch + parse only, no DB write)
- External integration: HTTP fetch to bhphotovideo.com product pages

## 8) UX Flow
1. User opens item create form
2. User pastes B&H product URL into "Product URL" field
3. Client calls `POST /api/enrichment/bh` with the URL
4. Server fetches page, parses metadata, returns `{ brand, model, name, imageUrl }`
5. Client prefills brand, model, name, imageUrl fields (only if currently empty)
6. User reviews, edits if needed, and saves
7. If parse fails: warning toast, all fields remain editable for manual entry

## 9) Acceptance Criteria
1. Pasting a valid B&H URL auto-fills brand, model, name fields
2. Parse failure shows a warning but does not prevent item creation
3. assetTag is never modified by enrichment
4. User can edit any prefilled field before saving
5. Server endpoint validates URL domain is bhphotovideo.com
6. Endpoint returns within 5s (timeout with graceful failure)
7. Build passes, no new dependencies required

## 10) Edge Cases
- Invalid URL (not bhphotovideo.com) → reject with clear message
- B&H page returns 404 or is unavailable → graceful failure
- B&H changes page structure → parser returns partial data, fills what it can
- User pastes URL then clears it → prefilled fields remain (user chose them)
- Product page has no image → imageUrl returns null, field stays empty

## 11) File Scope
- Allowed files to modify:
  - `src/app/api/enrichment/bh/route.ts` (new)
  - `src/lib/services/bh-parser.ts` (new)
  - `src/app/(app)/items/page.tsx` (add URL input + fetch wiring)
  - `tests/bh-parser.test.ts` (new)
- Forbidden files:
  - `prisma/schema.prisma` (no schema changes)
  - Any booking/checkout/event files

## 12) Developer Brief
1. Create `src/lib/services/bh-parser.ts` — fetch URL, parse HTML for product metadata
2. Create `POST /api/enrichment/bh` — validate URL, call parser, return structured result
3. Add "Product URL" field to item create form — on blur/button, call API, prefill fields
4. Write parser tests with sample HTML fixtures

## 13) Test Plan
- Unit: bh-parser.test.ts — parse known HTML structures, handle missing fields, handle empty/broken HTML
- Manual: paste real B&H URL, verify prefill, verify failure mode

## 14) Risks and Mitigations
- Risk: B&H blocks server-side requests
  - Mitigation: Use standard User-Agent, implement timeout, fail gracefully
- Risk: B&H changes page structure
  - Mitigation: Parser returns partial data; multiple selector strategies with fallbacks
- Risk: Cloudflare Worker fetch limits
  - Mitigation: Single fetch per enrichment call; well within subrequest budget
