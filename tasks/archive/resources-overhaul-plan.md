# Resources Overhaul Plan

**Created:** 2026-07-03
**Owner:** Erik Role
**Area doc:** `docs/AREA_RESOURCES.md`

## The headline decision: markdown or something better?

**Stay on Markdown-in-DB. Level up the rendering, not the storage format.**

The "lightweight and fast, modern" goal is delivered by *rendering + navigation + search*,
not by switching to MDX or a block editor. Concretely:

- MDX-in-repo would kill in-app staff authoring (only commits could add guides).
- A Notion-style block editor (Tiptap/BlockNote) is a real content migration + heavier client.
- We already have `react-markdown` + `remark-gfm` + `@mdxeditor/editor` + `cmdk` installed.

So: keep `Resource.markdown` as source of truth, and make it feel modern via GitHub-style
alert callouts, safe media embeds, a Cmd-K palette, and a hub/doc landing.

## What already exists (do NOT rebuild)

- Sticky, scroll-spy Table of Contents on `/resources/[slug]` (`GuideReader.tsx`).
- Heading deep-links, copy buttons on code blocks + tables, captioned images.
- Full-text client search over the loaded guide payload (title/category/author/body).
- Role/area targeting, freshness (lastVerified) metadata + Mark verified action.
- Cards/list toolbar, area lanes, Contacts + Sport assignments references.

## Chosen answers (from interview)

1. Content model: **Markdown in DB, upgraded reader**
2. Scope: **Full page overhaul, keep guides + contacts + assignments together on /resources**
3. Must-haves: **Rich media & callouts, Sticky TOC (exists), Instant Cmd-K search**
4. Layout: **Hub landing + docs reading view**

## Slices (thin-slice protocol — one PR each, independently mergeable)

### Slice 1 — Callouts + safe media (reader richness) — DONE 2026-07-03
- Add GitHub alert syntax support: `> [!NOTE] > [!TIP] > [!WARNING] > [!IMPORTANT] > [!CAUTION]`
  rendered as styled callout cards in `MarkdownReader.tsx`. Authors just type blockquotes —
  no new editor primitive, MDXEditor already does blockquotes.
- Add a safe video/embed convention (fenced ```embed <url> or a link-card) WITHOUT enabling
  raw HTML (`skipHtml` stays on for XSS safety). YouTube/Vimeo/Loop allowlist -> iframe.
- Files: `MarkdownReader.tsx`, `src/lib/guide-content.ts` (parse alerts), reader CSS.
- Tests: alert parsing + embed allowlist unit tests.

### Slice 2 — Cmd-K instant search palette — DONE 2026-07-03
- Global-ish command palette scoped to Resources using installed `cmdk`.
- Fuzzy over the already-loaded guide list (client-side, zero server) + jump to contacts.
- Keyboard: Cmd/Ctrl-K opens; arrow/enter navigate; recent + type-grouped results.
- Files: new `src/components/resources/ResourceCommandPalette.tsx`, wire into `page.tsx`.

### Slice 3 — Hub landing refinement (full-page hierarchy) — DONE 2026-07-03 (opt-in Featured lead)
- Tighten the landing into a real hub: search up front, featured/recommended row,
  by-area sections, then references (Contacts + Sport assignments) as clearly-secondary.
- Keep everything on /resources (per scope answer) but fix the visual hierarchy so guides
  lead and references support.
- Files: `page.tsx` layout composition (no data-model change).

### Slice 4 — Docs reading view polish — DONE 2026-07-03
- Add a left doc-nav rail on `/resources/[slug]`: sibling guides in the same type/area for
  GitBook-style "where am I" context, plus prev/next. Keep the existing right-hand TOC.
- Files: `GuideReader.tsx`, small addition to `/api/resources` or reuse loaded list.

### Slice 5 — Hardening + docs — DONE 2026-07-03
- a11y pass (palette focus trap, callout roles), mobile checks, dark-mode parity
  (run color-audit), update `AREA_RESOURCES.md` change log + ACs, archive this plan.

## Non-goals (v1)
- No storage-format migration. No MDX. No external Notion/GDocs sync.
- No new DB columns (freshness + targeting already exist).

## Review / closeout (2026-07-03)

All five slices shipped on `feat/resources-reader-overhaul`. Decision held:
Markdown-in-DB stayed the source of truth; the "modern" feel came from rendering,
search, and navigation, with zero migration and no new DB columns.

- Slice 1: alert callouts + allowlisted video embeds (`remark-callouts.ts`,
  `media-embed.ts`). Verified light/dark in browser.
- Slice 2: ⌘K palette (`ResourceCommandPalette` + `resource-search.ts`). Verified
  open, empty-state grouping, recency sort, and body-content matching in browser.
- Slice 3: opt-in Featured hub lead (`splitFeaturedGuides`). Hidden when nothing
  featured, so it reintroduces the removed lead only for teams that opt in.
- Slice 4: docs-style sibling rail + prev/next (`buildSectionNav`). Verified the
  3-column (2xl) and 2-column (<2xl) layouts in browser.
- Slice 5: color-system entry for the callout palette, new ACs (14-17), GAP-62 for
  the editor authoring affordance follow-up, this closeout, plan archived.

Verification: 35+ unit tests green, `tsc` clean, browser checks for each visible
surface. `npm run build` runs `prisma migrate deploy` (Neon blocked locally); build
is validated on Vercel deploy.

Follow-ups: GAP-62 (editor toolbar/preview for callouts + embeds).
