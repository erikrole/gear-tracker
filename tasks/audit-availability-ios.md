# Audit: iOS My Availability - 2026-07-03

Scope: `AvailabilityView` and `AddAvailabilitySheet` in `ios/Wisconsin/Views/AvailabilityView.swift`, reachable from Profile / Settings for Student-scheduling-class users.

## Findings

- [x] [Safety] **Swipe delete mutated availability immediately.** A scheduling availability block is student-owned but operationally important: staff use it when reviewing assignments, time off, pickup, and trades. A trailing swipe could remove that context with no confirmation.
      Fix: swipe delete now opens a native confirmation dialog that names the affected block and explains that staff will no longer see it before calling the existing delete API.

## Runtime Notes

- Simulator verification is pending as part of the Profile / Settings sweep. Source pass confirms the view still uses native `List`, `Form`, `DatePicker`, `Picker`, `TextField`, toolbar add action, and grouped empty/error states.

## Acceptance Criteria

- [x] AC: Student-scheduling-class users can view weekly and one-time availability blocks.
- [x] AC: Add Availability keeps the existing weekly / one-time, intent, day/date, time, and optional label controls.
- [x] AC: Destructive delete requires explicit confirmation before mutation.

## Sources

- `ios/Wisconsin/Views/AvailabilityView.swift`
- `docs/AREA_SHIFTS.md`
- `docs/AREA_MOBILE.md`
