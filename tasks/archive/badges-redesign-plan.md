# Badges Awards & Sections Redesign (Web + iOS)

Created: 2026-07-02
Status: Complete (all slices shipped 2026-07-02)
Decision refs: AREA_BADGES.md UI Direction, D-034

## Problem

- Web `/users/{id}?tab=badges` buries ~24 visible badges behind two navigation levels: summary cards → 320px collection cards (only a featured medallion visible) → drill-in gallery → detail dialog. Chrome-heavy, content-light — the last "loud" surface after the app-wide calmer passes.
- Web badge tiles stack three redundant chips (Earned/Locked + rarity + Manual) when the medallion already encodes locked (grayscale) and rarity (rim tone).
- iOS badge tiles are text-heavy (name + description + note in a 130pt tile) and use a plain rounded-rect medallion that shares nothing with web's shaped artifact medallions — breaks the iOS-little-brother rule.
- iOS profile badge section renders up to 12 full tiles in a grid, making User Detail very tall; docs call for a "profile-safe compact summary".
- iOS gallery sheet is a flat grid while web groups by collection — sibling mismatch.

## Direction: one shelf level, medallion-first

Same vocabulary on both platforms: five collections (Gear Flow, Reliability, Scans, Teamwork, Staff Picks), shaped rarity medallions, compact tiles that lead with the artifact, detail dialog/sheet as the full story.

## Slices

- [x] **Web: flatten UserBadgesTab to shelves.** One header band (completion number + progress bar + earned/remaining/hidden inline) replaces the 3 summary cards. Five full-width shelf sections, each a header (icon, title, earned/total tabular count, "+N hidden" where applicable) over a responsive grid of compact tiles: centered medallion, name, one quiet meta line, progress bar when derivable, New chip only when fresh. Global filter ToggleGroup stays; shelves collapse when empty under filter. Deletes AwardCollectionCard/AwardCollections/AwardCollectionDetail/BadgeGallery drill-in state. BadgeDetailDialog untouched.
- [x] **iOS: shaped medallions + shelf profile + collection gallery.** Port coin/hex/shield/stack silhouettes as SwiftUI Shapes with rarity fill/stroke and locked-gray state, same category→shape mapping as web. Profile badges card becomes a horizontal shelf of earned medallions (tap → detail sheet) with count + See all. Gallery sheet groups into the same five collections with section headers and compact medallion-first tiles (description moves to detail sheet only). Filters, summary cells, haptics, BadgeDetailSheet unchanged.
- [x] **Verify + docs.** `npm run build`, `npx vitest run tests/`, xcodebuild Wisconsin simulator build, scratch-route screenshot check (light/dark) for the web tab, AREA_BADGES.md + AREA_MOBILE.md change logs, archive this plan.

## Out of scope

- `/reports/badges` staff analytics (follows report layout patterns, not award chrome).
- Award badge dialog (redesigned 2026-05-14).
- Badge APIs, schema, rarity/hidden-key model, `src/lib/badges/*`, `BadgeMedallion.tsx` (stays the canonical web artifact renderer).
