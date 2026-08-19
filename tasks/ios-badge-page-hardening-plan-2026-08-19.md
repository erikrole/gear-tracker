# Plan: iOS Badge Page Cleanup, Polish, and Hardening

- Date: 2026-08-19
- Area: `docs/AREA_BADGES.md`
- Surface: `ios/Wisconsin/Views/UserDetailView.swift` (badge card, gallery sheet, detail sheet),
  `ios/Wisconsin/Shared/BadgeEarnedCelebration.swift` (shared badge artwork)
- Status: Active

## Why now

`docs/AREA_BADGES.md` records native visual acceptance as the last open gate for the v7 badge
release. Reading the shipped iOS badge surface against the web tab and the API contract turned up
correctness drift, not just cosmetics: iOS carries its own copies of constants the web owns, and
they have gone stale in exactly the way the 2026-07-22 rarity fix warned about.

## Defects found (evidence)

1. **Stale hidden-badge list.** `hiddenBadgeKeys` on iOS holds 4 keys; `HIDDEN_BADGE_KEYS` in
   `src/lib/badges/display.ts` holds 9. iOS is missing `old_faithful`, `battery_run`,
   `buzzer_beater`, `take_thirteen`, `holiday_hours`. One stale constant causes four visible bugs:
   the five surprises render as ordinary locked tiles, `hiddenSurpriseCount` undercounts,
   `completionPercent` disagrees with web for the same user, and the profile card's "Closest"
   row can name a hidden badge and show its progress.
2. **Closest-to-earned reads unfiltered badges.** `closestToEarned` filters `profile.badges`, not
   the visible collection, so it can surface a hidden surprise even once (1) is fixed.
3. **Rarity colour disagrees with the rest of the system.** Badge page maps common→blue,
   uncommon→green. Web (`badgeRarityMedallionClass`) and the iOS celebration
   (`EarnedBadgeReward.accentColor`) both map common→brand primary, uncommon→blue. The badge page
   is the outlier: a badge is one colour when you earn it and another on your shelf.
4. **Two divergent Lucide→SF Symbol maps in one app.** 12 catalog icons resolve to a different
   glyph in the celebration than on the badge page, and the 11 custom-badge picker icons are
   absent from the celebration map so they all collapse to `trophy.fill`. The celebration map also
   violates the one-to-one rule the page map is tested for (three scan icons share one symbol).
5. **`awardedByName` is served and never decoded on iOS.** Manual recognition loses its
   attribution; web prints it under the award note.
6. **Retired badges are unlabelled on iOS.** Web shows a Retired chip for `!active && earned`.
7. **`symbolEffect(.bounce, value:)` never fires** — `recentlyEarned` is derived and never changes
   during the view's lifetime — and is not guarded by Reduce Motion.
8. **Dead code:** `badgeTapFeedback` state and `String.badgeTone` are declared and never read.
9. **Ad-hoc filter chips.** The gallery re-implements chips instead of the shared `FilterChip`,
   losing the 44pt touch target and the `.isSelected` VoiceOver trait.

## Slices

1. **Shared badge artwork.** Move one icon map and one rarity vocabulary into
   `Shared/BadgeEarnedCelebration.swift` (already a member of both the Wisconsin and
   WisconsinKiosk targets, so no `project.pbxproj` change). Point the celebration and the badge
   page at it. Adopt the page's one-to-one map; adopt web/celebration rarity colour.
2. **Correctness.** Sync hidden keys, filter the closest row, decode and render `awardedByName`,
   label retired awards, fix the bounce trigger with a Reduce Motion guard, delete dead code.
3. **Polish.** Shared `FilterChip`; newest-earned-first shelf with a New chip; summary band that
   matches web's vocabulary (completion, earned, goals left, hidden); holders line so rarity means
   something; Dynamic Type via `@ScaledMetric`; honest overflow affordance on the shelf.
4. **Tests + docs.** Extend the source-contract suite to guard the shared map, the hidden-key
   parity, and the rarity parity; update `docs/AREA_BADGES.md`.

## Verification

- `npx vitest run` on the badge suites, `npx tsc --noEmit`, `npm run build:app`.
- `xcodebuild` for the `Wisconsin` and `WisconsinKiosk` schemes on
  `platform=iOS Simulator,name=iPhone 16 Pro`.
- Simulator visual acceptance of the badge card, gallery, and detail sheet in light and dark.

## Out of scope

Web badge tab behaviour, badge evaluators, schema, and the kiosk success screen. Unrelated
in-flight scoreboard work stays untouched.
