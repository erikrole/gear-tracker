# Native Reservation Setup Final Polish

## Scope

Polish the existing native Details, Gear, and Review flow without changing reservation payloads, permissions, event-link limits, or kiosk custody.

## Changes

- Remove the Details preview hero and requester row.
- Put the editable reservation title first.
- Replace the ambiguous event card with an Event or Manual setup control.
- Add an explicit confirmation action to event selection.
- Use 15-minute date and time increments and remove duration presets.
- Replace the pickup-location sheet with an inline Camp Randall or Kohl Center control.
- Show cross-location gear dimmed and prevent accidental selection without discarding already-selected items after a location change.
- Limit browse categories to All, Cameras, Lenses, Batteries, and Other.
- Add inline battery suggestions for Sony cameras, FX6 bodies, and monitors.
- Lead Review with requester identity and keep the Create action purple.

## Verification

- Focused native source-contract tests passed.
- Full native source-contract suite passed: 237 tests across 56 files.
- iOS source drift and audit-gap checks passed.
- Generic iOS Simulator Xcode build passed.
- Documentation, codemap, and final diff checks passed. The repository's pre-existing XcodeGen project-file drift remains outside this source-only slice.
