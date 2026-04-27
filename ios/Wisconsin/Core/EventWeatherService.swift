import Foundation
import WeatherKit
import CoreLocation

struct EventWeatherData {
    let symbolName: String
    let temperature: String
}

actor EventWeatherService {
    static let shared = EventWeatherService()
    private init() {}

    private let service = WeatherService.shared
    private var cache: [String: EventWeatherData] = [:]

    /// Returns weather for home games starting within the next 5 days.
    /// Returns nil for away games, past events, or events too far in the future.
    func weather(for event: ScheduleEvent) async -> EventWeatherData? {
        guard event.isHome == true else { return nil }
        let now = Date()
        guard event.endsAt > now,
              event.startsAt <= now.addingTimeInterval(5 * 24 * 60 * 60) else { return nil }

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
    }

    // UW Madison venue coordinates. Falls back to campus center for any unrecognized home venue.
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
