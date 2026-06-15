# iOS Schedule polish plan

Branch: `ios-schedule-polish` (off main, short-lived)

## Slice A — Multi-day event support
- [ ] `ScheduleEvent`: `isMultiDay`, day-span helpers (handle allDay exclusive end).
- [ ] Grouping: expand a multi-day event into each calendar day it covers (within the loaded window).
- [ ] `EventRow`: render per-day segment — start day shows start time, middle days "All day / ongoing", end day shows end; a "multi-day" / "Day n of m" marker.
- [ ] Detail sheet: show full date range when multi-day.

## Slice B — Detail sheet (EventDetailSheet) onto the shared design language
- [ ] Grouped background; sections become brand cards (cardSurface / Brand.Radius / hairline) instead of `.background(.background.secondary)` + radius 10.
- [ ] Section headings use icons + consistent spacing (BrandSectionHeader-style: "Your Event", "Crew", area labels).
- [ ] Tidy the event header (sport/home-away/date/time/location/weather) spacing + icon alignment.

## Slice C — ScheduleView headers + layout
- [ ] `ScheduleDateHeader`: leading icon, better vertical rhythm/spacing.
- [ ] Control strip + section spacing polish.

Verify: `xcodebuild` BUILD SUCCEEDED after each slice. Commit per slice.
