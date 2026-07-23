import Foundation
import WeatherKit
import CoreLocation

struct EventWeatherData {
    let symbolName: String
    let temperature: String
}

extension ScheduleEvent {
    /// Weather is operational context only when it can affect the event.
    ///
    /// A mapped or raw venue is stronger evidence than the sport because Track
    /// and Tennis can run indoors or outdoors. Kohl Center, UW Field House, and
    /// LaBahn Arena are the only covered home venues. If no venue evidence
    /// exists, fall back only for sports whose home competition is
    /// unambiguously outdoors.
    var isOutdoorHomeEvent: Bool {
        guard isHome == true else { return false }

        let mappedVenue = location?.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let rawVenue = rawLocationText?.trimmingCharacters(in: .whitespacesAndNewlines)
        let venueText: String
        if let mappedVenue, !mappedVenue.isEmpty {
            venueText = mappedVenue.lowercased()
        } else {
            venueText = rawVenue?.lowercased() ?? ""
        }

        if !venueText.isEmpty {
            let coveredVenueTerms = [
                "kohl center",
                "field house",
                "labahn",
                "la bahn",
            ]
            return !coveredVenueTerms.contains { venueText.contains($0) }
        }

        guard let sportCode else { return false }
        let outdoorOnlySports: Set<String> = [
            "FB",
            "MXC", "WXC", "XC",
            "MGOLF", "WGOLF", "GOLF",
            "MROW", "LROW", "WROW", "ROW",
            "MSOC", "WSOC",
            "SB", "BASE",
        ]
        return outdoorOnlySports.contains(sportCode.uppercased())
    }
}

actor EventWeatherService {
    static let shared = EventWeatherService()
    private init() {}

    private let service = WeatherService.shared
    private var cache: [String: EventWeatherData] = [:]

    func weather(for event: ScheduleEvent) async -> EventWeatherData? {
        #if targetEnvironment(simulator)
        return nil
        #else
        guard event.isOutdoorHomeEvent else { return nil }
        let now = Date()
        guard event.endsAt > now,
              event.startsAt <= now.addingTimeInterval(10 * 24 * 60 * 60) else { return nil }

        if let hit = cache[event.id] { return hit }

        let coord = venueCoordinate(for: event)
        let location = CLLocation(latitude: coord.latitude, longitude: coord.longitude)

        do {
            let hourly = try await service.weather(for: location, including: .hourly)
            guard let hour = hourly.min(by: {
                abs($0.date.timeIntervalSince(event.startsAt)) < abs($1.date.timeIntervalSince(event.startsAt))
            }) else { return nil }

            let tempF = Int(hour.temperature.converted(to: .fahrenheit).value.rounded())
            let result = EventWeatherData(symbolName: hour.symbolName, temperature: "\(tempF)°")
            cache[event.id] = result
            return result
        } catch {
            return nil
        }
        #endif
    }

    private func venueCoordinate(for event: ScheduleEvent) -> CLLocationCoordinate2D {
        let name = (event.location?.name ?? "").lowercased()
        switch true {
        case name.contains("camp randall"):  return .init(latitude: 43.0700, longitude: -89.4122)
        case name.contains("kohl"):          return .init(latitude: 43.0731, longitude: -89.4192)
        case name.contains("mcclimon"):      return .init(latitude: 43.0647, longitude: -89.4056)
        case name.contains("nielsen"):       return .init(latitude: 43.0761, longitude: -89.4135)
        case name.contains("natatorium"):    return .init(latitude: 43.0744, longitude: -89.4117)
        case name.contains("goodman"):       return .init(latitude: 43.0718, longitude: -89.3897)
        default:                             return .init(latitude: 43.0731, longitude: -89.4095)
        }
    }
}
