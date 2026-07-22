import SwiftUI

// MARK: - Semantic tones
//
// One home for the colour rules that more than one screen needs. `StatusTone`
// in Brand.swift says what a tone *looks* like; this file says which tone a
// piece of domain data *earns*. Booking and asset status already had shared
// owners (`StatusBadge`, `assetStatusTone`); venue and crew coverage did not,
// and drifted across five and two call sites respectively.
//
// The canonical table these mirror is docs/COLOR_SYSTEM.md. Change that doc
// first, then this file -- never a call site.

// MARK: Venue (scheduling domain)

/// Where a game is played: green home, orange away, gray for everything
/// without a direction -- neutral sites and non-games alike.
///
/// This was previously re-derived in five views, which had quietly acquired
/// four different greys for the same meaning (`systemGray4`, `systemGray3`,
/// `statusText(.gray)` and `.gray`). Routing through `StatusTone` keeps venue
/// on the same token set as every other semantic colour in the app.
///
/// Green here means "home game", not "available" -- see the note in
/// COLOR_SYSTEM.md about which vocabulary a row speaks.
func venueTone(isHome: Bool?) -> StatusTone {
    switch isHome {
    case true: return .green
    case false: return .orange
    case nil: return .gray
    }
}

/// The venue tone as a rail/accent colour, for the many event rows that want a
/// `Color` rather than a `StatusTone`.
func venueRailColor(isHome: Bool?) -> Color {
    Color.statusText(venueTone(isHome: isHome))
}

// MARK: Crew coverage (staffing domain)

/// How well a shift is staffed: green fully covered, orange partially, red
/// when nobody is on it. This is its own domain -- red here is an unstaffed
/// shift, not an overdue booking -- but it shares the urgency direction of
/// every other tone in the app, so the same three colours carry it.
func coverageTone(percentage: Int) -> StatusTone {
    if percentage >= 100 { return .green }
    if percentage > 0 { return .orange }
    return .red
}

func coverageTone(_ coverage: ShiftCoverage) -> StatusTone {
    coverageTone(percentage: coverage.percentage)
}
