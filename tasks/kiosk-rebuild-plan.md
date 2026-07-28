# Kiosk Rebuild Plan (2026-07-27)

## Why

The kiosk works but reads as layered: nine screens accreted over weeks of
incremental passes. Baseline capture on the Work iPad simulator (landscape,
live Camp Randall data) found the problems are not bugs but drift:

- **No type scale.** Screens reach for `.title3.bold()`, `.headline`, `.caption`
  ad hoc. Nothing establishes a reading order.
- **No button hierarchy.** `.borderedProminent`, `.glass`, `.glassProminent`
  with per-call-site tints. Red means "primary", "save", and "remove"
  simultaneously; the primary custody CTA was blue.
- **Three status languages.** "Scanner ready" has three implementations
  (`KioskScannerStatusPill`, `KioskScannerReadinessBadge`, an inline `Label` in
  the detail sheet) rendering white, blue, and green — two of them on screen at
  the same time.
- **Dead canvas.** The idle left panel goes empty below "Tomorrow"; the student
  hub leaves both columns half-empty; the detail sheet is a ~650pt phone column
  on an 1180pt iPad showing 1.5 of 6 custody items.
- **Copy drift.** `Manage: Shoot` for the return path; `Details needed` that
  never says which detail; due stamps carrying the year at a counter where
  everything is due within days.

## Direction (user, 2026-07-27)

- Full rebuild, **IA included**. Current screens are a draft.
- Idle stays **one combined screen** for students and staff. No audience split,
  with the possible exception of Collaborators.
- **Dark + Badger red, pushed further.** Latitude on type, density, depth,
  motion, and the status color language.

## Constraints that do not move

- Kiosk-only custody (D-040). No flow, route, or scan-ownership changes in a
  visual slice.
- Always-on panel: no burn-in-prone bright static edges, no blur/shadow-heavy
  depth. Depth stays gradient-based per `kioskCard()`.
- HID scanner focus rules are load-bearing and hard-won. `@FocusState` stays
  banned near `KioskNativeTextField`; scanner claim/release semantics unchanged.
- Reduce Motion and Dynamic Type behavior must survive every slice.

## Slices

Each slice ends with a `WisconsinKiosk` build plus a landscape simulator
capture of the changed screen.

1. **Foundation.** Kiosk type ramp, button role hierarchy, one status color
   language. No screen rebuilt yet; existing screens adopt the new primitives
   where it is mechanical.
2. **Idle.** The combined front door. Kill the dead panel, rebalance the clock
   against identity and custody state, give empty states real cards, fix the
   clipped A–Z rail and roster edge.
3. **Student hub.** Product-language actions (return is not "Manage:"), due
   urgency that reads at a glance, both columns earning their space.
4. **Custody sheets.** Detail drawer sized for an iPad, item list that shows the
   items, one button hierarchy.
5. **Scan screens.** Checkout / pickup / return share one scaffold; scan target
   earns its contrast; blocking state says what is blocking.
6. **Success + activation.** Terminal moments against the new system.

## Verification per slice

- `xcodebuild -scheme WisconsinKiosk` for the Work iPad simulator.
- `xcrun simctl io <udid> screenshot` (honors orientation; the simulator MCP
  screenshot does not) for landscape visual proof.
- Affected source-contract tests under `tests/ios-kiosk-*`.
- Managed M2 iPad Air hardware pass remains the release gate, not this plan.
