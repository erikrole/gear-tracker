#if DEBUG
import SwiftUI

@MainActor
private final class PerformanceDraftPersistence: ReservationDraftPersistence {
    func bookingDrafts() async throws -> [BookingDraftSummary] { [] }
    func bookingDraft(id: String) async throws -> BookingDraftDetail { throw CancellationError() }
    func saveBookingDraft(
        id: String?,
        title: String,
        requesterUserId: String?,
        locationId: String?,
        startsAt: Date,
        endsAt: Date,
        notes: String?,
        eventIds: [String],
        serializedAssetIds: [String],
        bulkItems: [BulkReservationRequest]
    ) async throws -> String { throw CancellationError() }
    func deleteBookingDraft(id: String) async throws {}
    func createReservation(
        title: String,
        requesterUserId: String,
        locationId: String,
        startsAt: Date,
        endsAt: Date,
        notes: String?,
        eventId: String?,
        eventIds: [String],
        shiftAssignmentId: String?,
        sourceDraftId: String?,
        serializedAssetIds: [String],
        bulkItems: [BulkReservationRequest]
    ) async throws -> String { throw CancellationError() }
}

struct PerformanceTestRootView: View {
    let scenario: AppRuntimeMode.PerformanceScenario

    var body: some View {
        switch scenario {
        case .launch:
            RootView()
        case .items:
            PerformanceItemsView()
        case .equipment:
            PerformanceEquipmentView()
        case .guide:
            PerformanceGuideView()
        case .resourcesGuides:
            GuidesView()
        case .resourcesUsers:
            UsersView()
        case .resourcesLicenses:
            LicensesView()
        case .schedule:
            ScheduleHarnessView()
        }
    }
}

private struct PerformanceItemsView: View {
    private let assets = PerformanceFixtures.assets

    var body: some View {
        NavigationStack {
            List(assets) { asset in
                AssetRow(asset: asset)
                    .listRowSeparator(.hidden)
                    .listRowBackground(Color.clear)
                    .accessibilityIdentifier(asset.id)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Performance Items")
            .accessibilityIdentifier("performance-items-list")
        }
    }
}

@MainActor
private struct PerformanceEquipmentView: View {
    private let fixtures: [Asset]
    @State private var viewModel: CreateBookingViewModel

    init() {
        let fixtures = PerformanceFixtures.assets
        let persistence = PerformanceDraftPersistence()
        let viewModel = CreateBookingViewModel(
            draftPersistence: persistence,
            performsRemoteAssetSearch: false
        )
        viewModel.availableAssets = fixtures
        viewModel.assetTotal = fixtures.count
        viewModel.popularItemOrder = fixtures.map(\.id)
        viewModel.selectedLocationId = PerformanceFixtures.location.id
        viewModel.options = FormOptions(
            locations: [FormOption(id: PerformanceFixtures.location.id, name: PerformanceFixtures.location.name)],
            users: [],
            bulkSkus: PerformanceFixtures.bulkSkus
        )
        self.fixtures = fixtures
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        NavigationStack {
            CreateBookingEquipmentPicker(vm: viewModel, onReview: {})
                .navigationTitle("Performance Equipment")
                .accessibilityIdentifier("performance-equipment-picker")
        }
        .onChange(of: viewModel.assetSearch) { _, search in
            let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
            viewModel.availableAssets = query.isEmpty
                ? fixtures
                : fixtures.filter {
                    [$0.assetTag, $0.name, $0.brand, $0.model]
                        .compactMap { $0 }
                        .joined(separator: " ")
                        .localizedCaseInsensitiveContains(query)
                }
            viewModel.assetTotal = viewModel.availableAssets.count
        }
    }
}

@MainActor
private struct PerformanceGuideView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                NativeMarkdownArticle(markdown: PerformanceFixtures.guideMarkdown)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                    .frame(maxWidth: 720, alignment: .leading)
                    .frame(maxWidth: .infinity)
            }
            .background(Color(.systemBackground))
            .navigationTitle("Performance Guide")
            .navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("performance-guide-article")
        }
    }
}

// MARK: - Fixture API

/// Serves canned API responses for the Resources harness scenarios.
///
/// Registered on `APIClient`'s session only when a fixture scenario is active,
/// so the real views, view models, and `Codable` decode paths all run unchanged
/// against representative payloads — no signed-in session and no network.
final class FixtureAPIProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool {
        body(for: request) != nil
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url, let payload = Self.body(for: request) else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }

        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!

        let delay = AppRuntimeMode.fixtureResponseDelayMilliseconds
        guard delay > 0 else {
            deliver(response, payload)
            return
        }
        // `HTTPURLResponse` and `Data` are Sendable; the protocol instance is
        // reached weakly so a cancelled load simply drops the delivery.
        DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(delay)) { [weak self] in
            self?.deliver(response, payload)
        }
    }

    override func stopLoading() {}

    private func deliver(_ response: HTTPURLResponse, _ payload: Data) {
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: payload)
        client?.urlProtocolDidFinishLoading(self)
    }

    private static func body(for request: URLRequest) -> Data? {
        guard let path = request.url?.path else { return nil }
        switch path {
        case "/api/resources": return FixtureAPI.guides
        case "/api/users": return FixtureAPI.users
        case "/api/licenses": return FixtureAPI.licenses
        case "/api/licenses/my": return FixtureAPI.myLicense
        case "/api/calendar-events": return ScheduleFixtureAPI.calendarEvents
        case "/api/my-shifts": return ScheduleFixtureAPI.myShifts
        default: return nil
        }
    }
}

private enum FixtureAPI {
    static let guides = json("""
    { "data": [
      { "id": "g1", "title": "Key contacts", "slug": "key-contacts", "type": "CONTACTS",
        "category": "Contacts", "summary": "Escalation numbers, vendor contacts, and internal owners.",
        "searchText": "contacts phone escalation", "markdown": "", "featured": true,
        "personalizationReason": "Your area", "published": true, "updatedAt": "2026-08-14T15:04:00.000Z",
        "author": { "id": "u1", "name": "Media Ops" } },
      { "id": "g2", "title": "Camp Randall building numbers", "slug": "camp-randall", "type": "BUILDING_NUMBERS",
        "category": "Building Numbers", "summary": "Gate codes, dock access, and elevator notes.",
        "searchText": "building rooms dock", "markdown": "", "published": true,
        "personalizationReason": "General", "updatedAt": "2026-08-09T18:20:00.000Z",
        "author": { "id": "u2", "name": "Erik Role" } },
      { "id": "g3", "title": "Media Drive overview", "slug": "media-drive", "type": "MEDIA_DRIVE",
        "category": "Media Drive", "summary": "Where footage lands and how it is named.",
        "searchText": "media drive paths naming", "markdown": "", "published": true,
        "personalizationReason": "General", "updatedAt": "2026-08-02T12:00:00.000Z",
        "author": { "id": "u1", "name": "Media Ops" } },
      { "id": "g4", "title": "Card offload SOP", "slug": "card-offload-sop", "type": "SOP",
        "category": "SOP", "summary": "The standard offload and verification pass after a shoot.",
        "searchText": "offload sop cards verify", "markdown": "", "published": true,
        "personalizationReason": "Your area", "updatedAt": "2026-07-28T09:45:00.000Z",
        "author": { "id": "u3", "name": "Jordan Lee" } },
      { "id": "g5", "title": "Wireless audio troubleshooting", "slug": "wireless-audio", "type": "TROUBLESHOOTING",
        "category": "Troubleshooting", "summary": "Dropouts, interference, and battery symptoms.",
        "searchText": "audio wireless dropouts", "markdown": "", "published": false,
        "personalizationReason": "General", "updatedAt": "2026-07-21T22:10:00.000Z",
        "author": { "id": "u2", "name": "Erik Role" } }
    ] }
    """)

    static let users = json("""
    { "total": 5, "limit": 50, "offset": 0, "data": [
      { "id": "u1", "name": "Alex Rivera", "email": "alex.rivera@wisc.edu", "role": "STAFF",
        "title": "Photo Lead", "primaryArea": "PHOTO", "active": true },
      { "id": "u2", "name": "Erik Role", "email": "erik.role@wisc.edu", "role": "ADMIN",
        "title": "Creative Director", "primaryArea": "VIDEO", "active": true },
      { "id": "u3", "name": "Jordan Lee", "email": "jordan.lee@wisc.edu", "role": "STUDENT",
        "gradYear": 2027, "primaryArea": "VIDEO", "active": true },
      { "id": "u4", "name": "Sam Okonkwo", "email": "sam.okonkwo@wisc.edu", "role": "STUDENT",
        "gradYear": 2026, "primaryArea": "PHOTO", "active": true },
      { "id": "u5", "name": "Riley Chen", "email": "riley.chen@wisc.edu", "role": "STUDENT",
        "gradYear": 2025, "primaryArea": "GRAPHICS", "active": false }
    ] }
    """)

    static let licenses = json("""
    { "data": [
      { "id": "l1", "code": "PM-AAAA-1111", "label": "Photo Mechanic Seat 1", "status": "PARTIAL",
        "expiresAt": "2026-12-31T00:00:00.000Z",
        "claims": [ { "id": "c1", "userId": "u3", "claimedAt": "2026-08-16T14:00:00.000Z", "releasedAt": null,
                      "user": { "id": "u3", "name": "Jordan Lee" } } ] },
      { "id": "l2", "code": "PM-BBBB-2222", "label": "Photo Mechanic Seat 2", "status": "AVAILABLE",
        "expiresAt": "2026-12-31T00:00:00.000Z", "claims": [] },
      { "id": "l3", "code": "PM-CCCC-3333", "label": "Photo Mechanic Seat 3", "status": "RETIRED",
        "expiresAt": "2026-01-31T00:00:00.000Z", "claims": [] }
    ] }
    """)

    static let myLicense = json("""
    { "data": { "id": "l1", "claimId": "c1", "code": "PM-AAAA-1111",
                "label": "Photo Mechanic Seat 1", "expiresAt": "2026-12-31T00:00:00.000Z",
                "claimedAt": "2026-08-16T14:00:00.000Z" } }
    """)

    private static func json(_ literal: String) -> Data {
        Data(literal.utf8)
    }
}

private enum PerformanceFixtures {
    /// Exercises every block kind the guide reader can draw. Shaped after the
    /// templates in src/app/(app)/resources/new/_components/NewGuideClient.tsx.
    static let guideMarkdown = """
    # Key contacts

    Use this Guide for phone numbers, escalation contacts, and internal owners.
    Reach the desk at [av-desk@wisc.edu](mailto:av-desk@wisc.edu) or
    [555-555-5555](tel:+15555555555).

    > [!WARNING]
    > Do not unplug the media drive mid-transfer.

    > [!TIP]
    > Put the owner in the table so people know who fixes stale details.

    ## Emergency

    | Contact | Role | Phone | When to use |
    | --- | :-: | ---: | --- |
    | Building desk | Facilities | `555-555-5555` | Power, doors, or HVAC |
    | Media Ops | On-call staff | `555-000-1111` | Anything that blocks a shoot |

    ## Rig reference

    ![Camera shelf, second bay from the left](https://example.invalid/rig.png)

    ## Steps

    1. Pull the kit and check the case tag.
    2. Confirm the card is formatted.
       - Use the in-camera format, not the desktop one.
    3. Log the checkout at the kiosk.

    - [x] Batteries charged
    - [ ] Lens cloth packed

    ## Copyable values

    ```text
    /Volumes/MediaDrive/2026/Projects
    ```

    ## Walkthrough

    ```embed
    https://youtu.be/dQw4w9WgXcQ
    ```

    Formatting check: **bold**, _italic_, ~~struck~~, and `inline code`.

    ---

    | Field | Value |
    | --- | --- |
    | Maintainer | Media Ops |
    | Last verified | 2026-08-18 |
    """

    static let location = AssetLocation(id: "performance-location", name: "Camp Randall")
    private static let categoryNames = ["Cameras", "Lenses", "Audio", "Lighting"]

    static let assets: [Asset] = (0..<300).map { index in
        let categoryName = categoryNames[index % categoryNames.count]
        return Asset(
            id: String(format: "performance-asset-%03d", index),
            assetTag: String(format: "PERF-%04d", index),
            name: "Performance \(categoryName.dropLast()) \(index)",
            brand: index.isMultiple(of: 2) ? "Sony" : "Canon",
            model: "Model \(index)",
            serialNumber: String(format: "SERIAL-%06d", index),
            imageUrl: nil,
            computedStatus: .available,
            location: location,
            category: AssetCategory(id: categoryName.lowercased(), name: categoryName),
            department: nil,
            activeBooking: nil,
            purchaseDate: nil,
            purchasePrice: nil,
            residualValue: nil,
            isFavorited: index.isMultiple(of: 7)
        )
    }

    static let bulkSkus: [FormBulkSku] = (0..<20).map { index in
        FormBulkSku(
            id: "performance-bulk-\(index)",
            name: "Performance Battery \(index)",
            category: "Batteries",
            unit: "each",
            locationId: location.id,
            binQrCodeValue: nil,
            trackByNumber: index.isMultiple(of: 2),
            categoryName: "Batteries",
            imageUrl: nil,
            currentQuantity: 20,
            availableQuantity: 15
        )
    }
}
// MARK: - Schedule harness

/// Renders the real `ScheduleView` against canned events and shifts. The
/// fixture session is seeded as STAFF so the crew-coverage chips and the
/// past-events filter — both role-gated — are actually exercised.
struct ScheduleHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        ScheduleView()
            .onAppear {
                session.currentUser = ScheduleFixtures.staffUser
                NSLog("HARNESS-DEBUG seeded role=\(session.currentUser?.role ?? "nil")")
            }
    }
}

private enum ScheduleFixtures {
    static let staffUser = CurrentUser(
        id: "fixture-staff",
        name: "Jordan Lee",
        email: "jordan.lee@wisc.edu",
        role: "STAFF",
        affiliation: nil,
        collaboratorProfile: nil,
        capabilities: [],
        collaboratorPolicy: nil,
        staffingType: "ST",
        avatarUrl: nil,
        forcePasswordChange: false
    )
}

/// Builds the schedule payloads relative to the current day, so the "Today"
/// and "Tomorrow" headers and the relative-time affordances render the way a
/// real session would rather than freezing at an authored date.
enum ScheduleFixtureAPI {
    private static func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: date)
    }

    private static func at(_ dayOffset: Int, _ hour: Int, _ minute: Int = 0) -> String {
        let calendar = Calendar.current
        let day = calendar.date(byAdding: .day, value: dayOffset, to: Date.now) ?? .now
        let date = calendar.date(
            bySettingHour: hour,
            minute: minute,
            second: 0,
            of: calendar.startOfDay(for: day)
        ) ?? day
        return isoString(date)
    }

    /// All-day events encode a bare calendar date at UTC midnight.
    private static func allDay(_ dayOffset: Int) -> String {
        let calendar = Calendar.current
        let day = calendar.date(byAdding: .day, value: dayOffset, to: Date.now) ?? .now
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        let parts = calendar.dateComponents([.year, .month, .day], from: day)
        let date = utc.date(from: DateComponents(
            year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0, second: 0
        )) ?? day
        return isoString(date)
    }

    static var calendarEvents: Data {
        let events = """
        [
          { "id": "e1", "summary": "Volleyball vs Nebraska", "startsAt": "\(at(0, 11))",
            "endsAt": "\(at(0, 14))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "VB", "opponent": "Nebraska", "isHome": true,
            "location": { "id": "loc-fh", "name": "UW Field House" },
            "coverage": { "total": 6, "filled": 4, "percentage": 67 } },
          { "id": "e2", "summary": "Men's Hockey at Minnesota", "startsAt": "\(at(0, 16))",
            "endsAt": "\(at(0, 19))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "MIH", "opponent": "Minnesota", "isHome": false,
            "location": null, "rawLocationText": "3M Arena at Mariucci",
            "coverage": { "total": 3, "filled": 3, "percentage": 100 } },
          { "id": "e3", "summary": "Women's Basketball vs Iowa", "startsAt": "\(at(0, 19, 30))",
            "endsAt": "\(at(0, 22))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "WBB", "opponent": "Iowa", "isHome": true,
            "location": { "id": "loc-kc", "name": "Kohl Center" },
            "coverage": { "total": 5, "filled": 2, "percentage": 40 } },
          { "id": "e4", "summary": "Football vs Ohio State", "startsAt": "\(at(1, 12))",
            "endsAt": "\(at(1, 15, 30))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "FB", "opponent": "Ohio State", "isHome": true,
            "location": { "id": "loc-cr", "name": "Camp Randall Stadium" },
            "coverage": { "total": 12, "filled": 8, "percentage": 67 } },
          { "id": "e5", "summary": "Men's Soccer vs Indiana", "startsAt": "\(at(1, 18))",
            "endsAt": "\(at(1, 20))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "MSOC", "opponent": "Indiana", "isHome": true,
            "location": { "id": "loc-mc", "name": "McClimon Complex" },
            "coverage": { "total": 4, "filled": 1, "percentage": 25 } },
          { "id": "e6", "summary": "Big Ten Swimming Championships", "startsAt": "\(allDay(2))",
            "endsAt": "\(allDay(4))", "allDay": true, "status": "CONFIRMED",
            "sportCode": "WSWIM", "opponent": null, "isHome": null,
            "location": { "id": "loc-sc", "name": "Soderholm Family Aquatic Center" },
            "coverage": { "total": 9, "filled": 5, "percentage": 56 } },
          { "id": "e7", "summary": "Softball at Michigan", "startsAt": "\(at(3, 9))",
            "endsAt": "\(at(3, 11))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "SB", "opponent": "Michigan", "isHome": false,
            "location": null, "rawLocationText": "Alumni Field",
            "coverage": { "total": 2, "filled": 0, "percentage": 0 } },
          { "id": "e8", "summary": "Equipment inventory audit", "startsAt": "\(at(4, 13))",
            "endsAt": "\(at(4, 16))", "allDay": false, "status": "CONFIRMED",
            "sportCode": null, "opponent": null, "isHome": null,
            "location": { "id": "loc-cage", "name": "Media Ops Cage" },
            "coverage": { "total": 3, "filled": 3, "percentage": 100 } }
        ]
        """
        return Data("{ \"data\": \(events), \"total\": 8 }".utf8)
    }

    static var myShifts: Data {
        let shifts = """
        [
          { "id": "s1", "area": "CAMERA", "workerType": "ST", "startsAt": "\(at(0, 9, 30))",
            "endsAt": "\(at(0, 14, 30))", "status": "ACTIVE",
            "event": { "id": "e1", "summary": "Volleyball vs Nebraska", "startsAt": "\(at(0, 11))",
                       "endsAt": "\(at(0, 14))", "sportCode": "VB", "isHome": true,
                       "opponent": "Nebraska", "locationId": "loc-fh", "locationName": "UW Field House" },
            "gear": { "status": "checked_out",
                      "bookings": [ { "id": "b1", "status": "CHECKED_OUT", "kind": "SERIALIZED", "itemCount": 4 } ] } },
          { "id": "s2", "area": "REPLAY", "workerType": "FT", "startsAt": "\(at(1, 12))",
            "endsAt": "\(at(1, 15, 30))", "status": "ACTIVE",
            "event": { "id": "e4", "summary": "Football vs Ohio State", "startsAt": "\(at(1, 12))",
                       "endsAt": "\(at(1, 15, 30))", "sportCode": "FB", "isHome": true,
                       "opponent": "Ohio State", "locationId": "loc-cr", "locationName": "Camp Randall Stadium" },
            "gear": { "status": "pickup_ready",
                      "bookings": [ { "id": "b2", "status": "RESERVED", "kind": "SERIALIZED", "itemCount": 7 } ] } }
        ]
        """
        return Data("{ \"data\": \(shifts) }".utf8)
    }
}
#endif
