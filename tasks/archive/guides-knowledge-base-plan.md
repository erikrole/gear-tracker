# Guides Knowledge Base Plan - 2026-05-09

## Goal
- Reframe Guides from narrow SOP storage into the all-purpose Creative knowledge base for contact numbers, building numbers, Media Drive context, server paths, SOPs, how-to notes, and general operational information.

## Peer patterns checked
- Items: dense search-first operational surface with stable search input identifiers and fast scanning.
- Settings: grouped domain framing with concrete descriptions and role-aware operational language.
- Existing Guides audit: keep server-side auth gates, ownership-aware edit visibility, filtered empty-state recovery, and stable search input identifiers.

## Plan
- [x] Structure: keep the existing Guide model and routes; avoid schema churn for this framing slice.
- [x] UX: broaden `/guides` copy, category defaults, empty states, and card previews around knowledge-base use.
- [x] UI: make guide cards more scannable without introducing nested card layouts or custom primitives.
- [x] Consistency: reuse shadcn primitives and preserve existing category-chip/search behavior.
- [x] Hardening: expose only text summaries in list payloads, not full content.
- [x] Verification: add focused tests for guide text extraction and run safe checks.
- [x] Docs: sync `docs/AREA_GUIDES.md` and task record.
- [x] Authoring speed: add starter templates for Contacts, Server Paths, SOPs, and Troubleshooting entries.
- [x] Markdown migration: add `Guide.markdown`, switch create/edit/reader to Markdown, and convert the existing guide row for visual review.
- [x] Landing page personalization: add admin-curated featured cards and role/area ranking for `/guides`.
- [x] Reader polish: make individual guides feel like editorial knowledge-base articles with theme-aware surfaces, stronger Gotham typography, upgraded TOC, and captioned photos.
- [x] Conversion fidelity: preserve BlockNote quotes, dividers, tables, bold spans, and inline code when converting legacy guide content to Markdown.
- [x] Table polish: render Markdown tables as compact reference tables with stronger theme-aware grid lines and overflow protection.
- [x] Code and quote polish: render inline code, fenced code blocks, and quote blocks with dedicated theme-aware guide reader styling.
- [x] Living-doc affordances: add heading deep links and copy actions for fenced code blocks and reference tables.
- [x] Living-doc templates: upgrade starter templates with tables, copyable snippets, quote notes, owner fields, and last-verified metadata.
- [x] Reference navigation: make Media Drive and Building Numbers first-class guide categories, split landing quick cards into area browsing and reference browsing, and add starter templates for both.
- [x] Live Contacts directory: show active users and their current profile contact fields inside the Contacts reference view so profile edits stay synced.
- [x] Slack contact seed: add a synced user `slackHandle` field and surface it in the Contacts directory.
- [x] Slack profile links: add a synced user `slackProfileUrl` field and make Contacts open Slack only when a real profile URL exists.
- [x] Contacts filtering: add role, area, and staff/admin contact-hygiene filters to the live directory.
- [x] URL navigation: persist Guides landing search, category, area, and reference filters in query params so common knowledge-base entry points can be shared.
- [x] Freshness closeout: add last-verified metadata, reader verification action, and landing/reader freshness badges for living knowledge-base maintenance.

## Propagation candidates
- [ ] Global search: consider indexing guide summaries later if the app needs cross-surface knowledge lookup.
- [ ] Settings: consider a future admin-managed category taxonomy only if freeform categories become noisy.

## Review
- Shipped: Knowledge-base framing, category suggestions, extracted list summaries, broader search, scannable cards, create/edit language, authoring templates, Markdown editor/reader migration, and Guides area doc sync.
- Shipped: Role + area targeting fields, featured guide ranking, landing-page cards, and create/edit targeting controls.
- Shipped: Theme-respecting editorial reader shell, stronger article typography, upgraded desktop table of contents, and larger captioned Markdown photo treatment.
- Shipped: Improved legacy BlockNote-to-Markdown conversion and regenerated the existing Photo Mechanic + Lightroom guide so its quote formatting and Hotkeys table render again.
- Shipped: Compact Markdown reference table styling for restored guide tables.
- Shipped: Dedicated Markdown code and quote styling for guide reader fidelity.
- Shipped: Copyable reference snippets and linkable headings for living knowledge-base guides.
- Shipped: Rich starter templates that encourage maintainable living docs instead of blank placeholder pages.
- Shipped: Guides landing navigation now separates Creative area guides from reference facts, with first-class Contacts, Building Numbers, Media Drive, and Server Paths cards plus matching starter templates for Building Numbers and Media Drive.
- Shipped: Contacts now has a live directory sourced from active User profiles, including synced phone, title/year, area, location, email, and Slack handle data.
- Shipped: Contacts can now open real Slack profile URLs from the User record while preserving `@handle` as display/search text.
- Shipped: Contacts now supports role/area filtering and staff/admin cleanup views for missing phone or Slack data.
- Shipped: Guides landing filters are URL-backed for direct links to Contacts, Media Drive, Server Paths, recently updated entries, user-area matches, categories, and text search.
- Shipped: Guides now expose freshness state, record who last verified a guide, and let allowed editors mark entries verified from the reader.
- Verified: `npx vitest run tests/guide-content.test.ts tests/guide-sanitize.test.ts tests/guide-ranking.test.ts tests/guide-freshness.test.ts`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, authenticated `/guides` and guide-reader HTTP 200 smoke, and authenticated mark-verified API smoke.
- Deferred: Global app search indexing, managed guide category taxonomy, and deleting legacy BlockNote JSON after the converted guide is visually accepted.
