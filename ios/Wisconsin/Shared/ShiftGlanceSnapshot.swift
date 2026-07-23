import Foundation

enum ShiftGlanceContract {
    static let appGroupIdentifier = "group.com.erikrole.Wisconsin"
    static let storageKey = "ShiftGlanceSnapshot.v1"
    static let widgetKind = "ShiftGlance"
    static let maximumAge: TimeInterval = 12 * 60 * 60
}

struct ShiftGlanceSnapshot: Codable, Equatable, Sendable {
    let generatedAt: Date
    let shifts: [ShiftGlanceItem]

    func upcoming(at date: Date) -> [ShiftGlanceItem] {
        shifts
            .filter { $0.endsAt > date }
            .sorted { $0.startsAt < $1.startsAt }
    }

    func isStale(at date: Date) -> Bool {
        date.timeIntervalSince(generatedAt) > ShiftGlanceContract.maximumAge
    }
}

struct ShiftGlanceItem: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let eventId: String
    let title: String
    let area: String
    let startsAt: Date
    let endsAt: Date
    let eventStartsAt: Date
    let locationName: String?
    let gearStatus: String
    let gearLabel: String?

    func isActive(at date: Date) -> Bool {
        startsAt <= date && endsAt > date
    }
}

struct ShiftGlanceSnapshotStore {
    private let defaults: UserDefaults?

    init(suiteName: String = ShiftGlanceContract.appGroupIdentifier) {
        defaults = UserDefaults(suiteName: suiteName)
    }

    init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    func load() -> ShiftGlanceSnapshot? {
        guard let data = defaults?.data(forKey: ShiftGlanceContract.storageKey) else {
            return nil
        }
        return try? JSONDecoder().decode(ShiftGlanceSnapshot.self, from: data)
    }

    @discardableResult
    func save(_ snapshot: ShiftGlanceSnapshot) -> Bool {
        guard let data = try? JSONEncoder().encode(snapshot) else { return false }
        defaults?.set(data, forKey: ShiftGlanceContract.storageKey)
        return defaults != nil
    }

    func clear() {
        defaults?.removeObject(forKey: ShiftGlanceContract.storageKey)
    }
}
