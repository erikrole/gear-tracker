# iOS Schedule polish plan

Branch: `ios-schedule-polish` (off main, short-lived)

## Slice A — Multi-day event support
- [x] `ScheduleEvent`: `isMultiDay`, day-span helpers (handle allDay exclusive end).
- [x] Grouping: expand a multi-day event into each calendar day it covers (within the loaded window).
- [x] `EventRow`: render per-day segment — start day shows start time, middle days "All day / ongoing", end day shows end; a "multi-day" / "Day n of m" marker.
- [x] Detail sheet: show full date range when multi-day.

## Slice B — Detail sheet (EventDetailSheet) onto the shared design language
- [x] Grouped background; sections become brand cards (cardSurface / Brand.Radius / hairline) instead of `.background(.background.secondary)` + radius 10.
- [x] Section headings use icons + consistent spacing (BrandSectionHeader-style: "Your Event", "Crew", area labels).
- [x] Tidy the event header (sport/home-away/date/time/location/weather) spacing + icon alignment.

## Slice C — ScheduleView headers + layout
- [x] `ScheduleDateHeader`: leading icon, better vertical rhythm/spacing.
- [x] Control strip + section spacing polish.

Verify: `xcodebuild` BUILD SUCCEEDED after each slice. Commit per slice.
