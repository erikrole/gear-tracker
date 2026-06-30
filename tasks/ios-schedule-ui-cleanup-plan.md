# iOS Schedule UI Cleanup Plan

Date: 2026-06-29

## Goal

Clean up the native iOS Schedule page so the first viewport is focused on events, not filter chrome, while preserving the current Schedule data contract, List/Calendar mode, Trade Board access, Calendar subscription, My shifts scope, Past events access for staff/admin, venue filtering, sport filtering, crew coverage chips, and multi-day/all-day display behavior.

## Slice

- [x] Collapse venue, sport, My shifts, and Past events controls into one filter sheet with a compact active-filter summary in the Schedule control strip.
- [x] Keep the List/Calendar segmented control visible and self-describing.
- [x] Calm the top toolbar actions so routine actions do not read as red/destructive.
- [x] Simplify date headers and event rows so cards do not look selected unless there is a real selected state.
- [x] Add bottom scroll clearance above the native tab bar.
- [x] Sync Mobile/Schedule docs and focused source-contract tests.

## Visual Proof Follow-up

- [x] Review real iPhone screenshots for List, Filters sheet, Calendar, and filtered empty states.
- [x] Reduce the Filters control from a large red-tinted pill to a neutral compact control with only the count badge using brand red.
- [x] Put sheet actions back in native order: Clear on the cancellation side, Done on the confirmation side.
- [x] Keep assigned-shift rows neutral, using a blue My shift text cue that matches the calendar legend instead of a red warning-like fill.
- [x] Keep calendar selected-day rows visually aligned with list rows, including staff coverage chips and clear row backgrounds.
- [x] Remove the duplicated Event detail bottom-bar prep-gear action that overlapped Crew rows in the medium sheet; keep the inline Reserve gear row as the contextual action.
- [x] Calm Event detail section-header icon color, lighten the hero title weight, replace duplicate my-shift markers with one inline You cue, and move Add shift into the Crew header.

## Verification

- [x] Focused Vitest source-contract tests for the iOS Schedule UI.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run verify:docs`
- [x] Focused `git diff --check`
- [x] `npm run ios:xcode:verify` when the local Xcode environment is available.

## Review

- 2026-06-29: Native iOS Schedule cleanup shipped locally. The first viewport now keeps List/Calendar plus a compact filter summary and one Filters button instead of multiple chip rows. The Filters sheet owns My shifts, Past events, venue, and sport controls, and calendar day counts/dots now honor the same venue/sport/my-shifts filters as the list. Event rows use a neutral hairline card with a subtle My shift cue instead of blue selection-like outlines, multi-day copy uses secondary text, date headers are lighter, and both list surfaces reserve bottom scroll clearance above the native tab bar. Verification passed with focused Vitest, iOS drift, iOS gap audit, docs/codemap verification, focused whitespace check, and `npm run ios:xcode:verify` outside the sandbox. The first sandboxed Xcode run failed from CoreSimulator permission and Swift macro plugin service errors, then passed when rerun with approved unsandboxed access.
- 2026-06-29 screenshot follow-up: Real iPhone screenshots showed the first pass still overweighted filters and assigned-shift state. The follow-up makes the Filters control neutral, restores Clear/Done sheet placement, changes My shift from red fill/text to neutral row plus blue personal-scope label, keeps staff coverage chips in the calendar selected-day list, and uses clearer generic empty-state copy when multiple filters are active.
- 2026-06-29 detail follow-up: Event detail screenshots showed the bottom-bar Prep gear action duplicating the inline Reserve gear row and overlapping Crew content in the medium detent. The duplicate bottom toolbar action was removed, the inline Reserve gear row remains the prep path, and the sheet title was shortened to Event so the toolbar no longer repeats a truncated event title.
- 2026-06-29 detail polish follow-up: Event detail now uses quiet secondary section icons, a lighter semantic event title, native toolbar Add shift, and one inline You capsule for the signed-in assignment instead of a row wash plus extra indicators. After screenshot feedback, Add shift was revised from a large bordered icon-only treatment to native SwiftUI toolbar chrome with a title-and-symbol label, matching recent sheet action patterns while keeping Crew focused on coverage. Verification re-ran with focused Vitest, iOS drift, iOS gap audit, docs/codemap check, focused whitespace check, and `npm run ios:xcode:verify`.
