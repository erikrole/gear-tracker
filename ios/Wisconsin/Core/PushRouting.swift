import Foundation

/// Where a Browse-rooted push should land. Browse owns Items and Licenses on
/// compact layouts; on sidebar layouts Licenses is its own tab.
enum BrowseRouteDestination: String, Equatable {
    case items
    case licenses
}

/// The destination a tapped push banner resolves to.
///
/// This exists so the banner and the in-app inbox cannot drift apart. Before,
/// `AppDelegate` read `bookingId`/`eventId` directly while
/// `NotificationsSheet.handleTap` matched on four payload shapes in a specific
/// order, so the same notification could send you to two different screens
/// depending on where you tapped it — a trade alert opened the event in
/// Schedule from a banner, but the Trade Board from the inbox.
///
/// The resolution order below mirrors `NotificationsSheet.handleTap`
/// deliberately. Keep the two in step.
enum PushRoute: Equatable {
    case booking(String)
    case trade(String)
    case event(String)
    case browse(BrowseRouteDestination)

    static func resolve(userInfo: [AnyHashable: Any]) -> PushRoute? {
        func value(_ key: String) -> String? {
            guard let raw = userInfo[key] as? String, !raw.isEmpty else { return nil }
            return raw
        }

        // `checkoutId` is the alias `NotificationPayload.effectiveBookingId`
        // honors. No server payload sends it today, but the model defines it
        // and the inbox accepts it, so the banner path accepts it too.
        if let bookingId = value("bookingId") ?? value("checkoutId") {
            return .booking(bookingId)
        }

        // Trade payloads also carry `eventId` (they are built by
        // `scheduleNotificationPayload`), so this must be checked first or
        // every trade alert would route to Schedule instead of the board.
        if let tradeId = value("tradeId") {
            return .trade(tradeId)
        }

        if let eventId = value("eventId") {
            return .event(eventId)
        }

        // Last resort: payloads that carry no id the app routes on, only a web
        // href (license expiry, firmware releases). Without this they open the
        // app to whatever tab happened to be showing.
        return browseRoute(for: value("href"))
    }

    private static func browseRoute(for href: String?) -> PushRoute? {
        guard let href else { return nil }
        // Parse rather than prefix-match the raw string so query strings and
        // absolute URLs both resolve: firmware sends "/items?search=…".
        guard let path = URLComponents(string: href)?.path, !path.isEmpty else { return nil }
        if path == "/licenses" || path.hasPrefix("/licenses/") { return .browse(.licenses) }
        if path == "/items" || path.hasPrefix("/items/") { return .browse(.items) }
        return nil
    }
}
