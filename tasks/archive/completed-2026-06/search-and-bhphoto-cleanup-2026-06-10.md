# Completed Search and B&H Image Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Remove ambient quick search type-to-search (2026-06-10)

Root cause: even after tightening the input guard, ambient type-to-search remains too collision-prone for a data-entry-heavy app. The explicit top-bar/mobile Search trigger and `Cmd/Ctrl+K` shortcut cover the command-palette workflow without stealing printable typing from page surfaces.

- [x] Remove printable-key type-to-search from AppShell.
- [x] Keep `Cmd/Ctrl+K` and top-bar/mobile Search triggers.
- [x] Add focused regression coverage that printable keys do not seed/open quick search.
- [x] Sync Search docs and record verification.

### Review
- 2026-06-10: Removed ambient type-to-search from the global command palette. Quick Search now opens only through the visible Search trigger or `Cmd/Ctrl+K`.
- 2026-06-10: Corrected removal verification passed: focused AppShell regression test, TypeScript, migration-prefix check, whitespace check, and authenticated in-app browser smoke on `http://127.0.0.1:3015/items`. With page focus, typing `x` did not open a command dialog or command input; the visible top Search trigger still opened the command palette. Browser shortcut injection could not reliably deliver `Cmd/Ctrl+K`, so the shortcut path is pinned by source regression coverage.
- 2026-06-10: AppShell type-to-search now exits when another handler already called `preventDefault()` and checks both the key event target and `document.activeElement` for text-entry/search/combobox/dialog ownership before opening the global palette.
- 2026-06-10: Authenticated in-app browser smoke on `http://127.0.0.1:3014/items?q=sony` passed. Typing in the Items search field kept the local `sony` query, filtered rows rendered, no command dialog or command input appeared, and browser console warnings/errors were empty.
- 2026-06-10: Verification passed: `npx vitest run tests/app-shell-search-source.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, and `git diff --check`.
- 2026-06-10: `npm run build` was attempted but the sandboxed run failed on blocked Neon DNS, and the escalated run was rejected because this repo's build script can apply pending migrations to Neon. Safer `npx next build` compiled the app, then failed on unrelated in-progress firmware-watch Prisma client drift: `FirmwareSupportMode` is present in the dirty schema/source but not generated in `@prisma/client`.

---

## Completed: Fix B&H images in the asset image picker (2026-06-10)

Root cause (verified with curl): Brave returns B&H image URLs on `www.bhphotovideo.com/cdn-cgi/...`, which sits behind Cloudflare bot protection that 403s hotlinked `<img>` loads, server-side rehost fetches, AND Brave's own thumbnail proxy ("Source image is unreachable"). The identical file paths on `static.bhphoto.com` serve openly (200, no special headers) in 500/1000/1500/2500px square variants.

- [x] `src/lib/bhphoto-image.ts` -- pure `toBhStaticImageUrl(url, size?)` rewriter (handles cdn-cgi-wrapped + direct URLs)
- [x] `src/lib/image-search.ts` -- map B&H results to static host: hero-size `url` (1000px), original-size `thumbnailUrl`
- [x] `src/lib/blob.ts` -- rewrite B&H URLs before rehost fetch; browser-like UA/Accept headers
- [x] `src/components/ChooseImageModal.tsx` -- grid renders `thumbnailUrl` first (hotlink-safe), falls back to `url`
- [x] Tests: new `tests/bhphoto-image.test.ts` + extend `tests/image-search.test.ts`
- [x] Doc sync: AREA_ITEMS.md changelog
- [x] `npm run build` + test suite green

### Review
B&H picker tiles now render from `static.bhphoto.com` and saving a B&H result rehosts the 1000x1000 hero image to Vercel Blob. Non-B&H tiles got more reliable too (Brave thumbnail preferred over hotlinked originals). If a 1000px variant ever 404s, the existing client fallback saves the 500px thumbnail instead.

Follow-up (same day, from live screenshot): two more real-world B&H URL shapes surfaced. `multiple_images/imagesNxN/` gallery paths now rewrite (and size-upgrade) like regular product images, and `static.bhphotovideo.com/explora/...` blog images, verified 403 on every host AND via Brave's thumbnail proxy, are dropped from results entirely rather than shown as blank tiles.
