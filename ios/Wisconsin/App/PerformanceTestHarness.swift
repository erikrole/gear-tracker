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
        case .resourcesLicenses, .resourcesLicensesOpen:
            LicensesView()
        case .schedule:
            ScheduleHarnessView()
        case .home, .homeAllClear:
            HomeHarnessView()
        case .login:
            LoginView()
        case .passwordSetup:
            PasswordSetupView(email: "avery.nakamura@wisc.edu")
        case .bookingDetail, .bookingExtend, .bookingEdit, .bookingCancel:
            BookingDetailHarnessView()
        case .itemEdit:
            ItemDetailHarnessView()
        case .createBookingScanner:
            CreateBookingScannerHarnessView()
        case .search, .searchPartial:
            GlobalSearchHarnessView()
        case .itemsList:
            ItemsListHarnessView()
        case .reports:
            ReportsHarnessView()
        }
    }
}

/// Global search with a query already committed. The point of the capture is
/// the result list -- items, reservations, checkouts, and people ranked into
/// one set of destinations -- so the fixture answers all four searches the
/// service fans out to.
struct GlobalSearchHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        GlobalSearchSheet()
            .onAppear { session.currentUser = ScheduleFixtures.staffUser }
    }
}

/// The real `ItemsView`, not the synthetic performance list. The `items`
/// scenario renders a hand-built List of AssetRow for scroll measurement; this
/// one is the shipping screen with its search, filters, and row treatments.
struct ItemsListHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        ItemsView()
            .onAppear { session.currentUser = ScheduleFixtures.staffUser }
    }
}

/// The real `ReportsView` against canned utilization and activity payloads.
/// Swift Charts failures are invisible to a compiler and to model tests -- an
/// empty series renders a blank box that still builds -- so this exists to be
/// looked at.
struct ReportsHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            ReportsView()
        }
        .onAppear { session.currentUser = ScheduleFixtures.staffUser }
    }
}

/// Renders the real `ItemDetailView` against a canned asset so its edit sheet
/// can be captured. Pushed in a stack for the same reason booking detail is.
struct ItemDetailHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            ItemDetailView(assetId: AssetFixtureAPI.assetId)
        }
        .onAppear { session.currentUser = ScheduleFixtures.staffUser }
    }
}

/// The reservation composer with its QR cover seeded open. The simulator has no
/// camera, so what this captures is the permission priming a first-time user
/// meets -- which is the state worth reviewing anyway, since the viewfinder
/// itself is the system's.
struct CreateBookingScannerHarnessView: View {
    @Environment(SessionStore.self) private var session
    @State private var isPresented = true
    @State private var viewModel = CreateBookingViewModel()

    var body: some View {
        Color(.systemGroupedBackground)
            .ignoresSafeArea()
            .sheet(isPresented: $isPresented) {
                CreateBookingSheet(vm: viewModel)
            }
            .onAppear { session.currentUser = ScheduleFixtures.staffUser }
    }
}

/// Renders the real `BookingDetailView` against a canned booking. Wrapped in a
/// `NavigationStack` because the screen is normally pushed, and its toolbar and
/// title are half of what a review is looking at.
struct BookingDetailHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            BookingDetailView(bookingId: BookingFixtureAPI.bookingId)
        }
        .onAppear { session.currentUser = ScheduleFixtures.staffUser }
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
    /// Claims every `/api/` request in a fixture scenario, not just the mapped
    /// paths. An unmapped call would otherwise reach the real host, 401, and
    /// broadcast a session expiry that signs the fixture user out mid-capture.
    override class func canInit(with request: URLRequest) -> Bool {
        guard AppRuntimeMode.usesFixtureAPI else { return false }
        return request.url?.path.hasPrefix("/api/") == true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }

        // Unmapped paths answer 404, never 401: `APIError.notFound` stays local
        // to the caller, while a 401 would tear down the harness session.
        let mapped = Self.body(for: request)
        let payload = mapped ?? Data(#"{"error":"Not served by the fixture harness"}"#.utf8)
        let response = HTTPURLResponse(
            url: url,
            statusCode: mapped == nil ? 404 : 200,
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
        case "/api/users":
            return AppRuntimeMode.performanceScenario == .searchPartial ? nil : FixtureAPI.users
        case "/api/licenses":
            return AppRuntimeMode.performanceScenario == .resourcesLicensesOpen
                ? FixtureAPI.openLicenses
                : FixtureAPI.licenses
        case "/api/licenses/my":
            return AppRuntimeMode.performanceScenario == .resourcesLicensesOpen
                ? FixtureAPI.noLicense
                : FixtureAPI.myLicense
        case "/api/me": return ScheduleFixtureAPI.me
        case "/api/dashboard":
            return AppRuntimeMode.performanceScenario == .homeAllClear
                ? HomeFixtureAPI.allClearDashboard
                : HomeFixtureAPI.dashboard
        case "/api/shift-groups": return ScheduleFixtureAPI.shiftGroups(for: request)
        case "/api/calendar-events": return ScheduleFixtureAPI.calendarEvents
        case "/api/my-shifts": return ScheduleFixtureAPI.myShifts
        case "/api/bookings/\(BookingFixtureAPI.bookingId)": return BookingFixtureAPI.booking
        case "/api/assets/\(AssetFixtureAPI.assetId)": return AssetFixtureAPI.asset
        case "/api/assets": return SearchFixtureAPI.assets
        case "/api/reports/utilization": return ReportsFixtureAPI.utilization
        case "/api/reports/checkouts": return ReportsFixtureAPI.checkouts
        case "/api/reservations": return SearchFixtureAPI.reservations
        // Left unmapped in the partial scenario so the protocol answers 404 and
        // those two sources throw, exactly as a real outage would.
        case "/api/checkouts":
            return AppRuntimeMode.performanceScenario == .searchPartial ? nil : SearchFixtureAPI.checkouts
        default: return nil
        }
    }
}

/// Report payloads sized so every element of the screen has something to draw:
/// a status mix with more than one slice, a custody block, and a daily trend
/// long enough to read as a line rather than a dot.
enum ReportsFixtureAPI {
    static var utilization: Data {
        // No `data` envelope: unlike the other routes served here, the report
        // endpoints decode straight into their model.
        Data("""
        {
          "days":30,"activeAssets":186,"partialFailures":null,"totalAssets":214,
          "statusCounts":{"AVAILABLE":142,"CHECKED_OUT":48,"RESERVED":16,"MAINTENANCE":6,"RETIRED":2},
          "custody":{"utilizationRate":0.63,"custodyDays":1184.5,"assetsUsed":134,
                     "checkoutCount":417,"idleCount":52,"neverCheckedOutCount":28,
                     "topUsed":[
                       {"assetId":"a-1","assetTag":"CAM-014","name":"Sony FX3","checkouts":38,
                        "custodyDays":112.5,"utilizationRate":0.81},
                       {"assetId":"a-2","assetTag":"AUD-007","name":"Sennheiser MKE 600","checkouts":31,
                        "custodyDays":88.0,"utilizationRate":0.72},
                       {"assetId":"a-3","assetTag":"SUP-031","name":"Manfrotto 504X Tripod","checkouts":27,
                        "custodyDays":74.5,"utilizationRate":0.64}
                     ]}
        }
        """.utf8)
    }

    static var checkouts: Data {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        // A shape with a visible weekly rhythm rather than noise, so the chart
        // reads as a real gear room: quiet midweek, heavy on event days.
        let counts = [4, 6, 3, 9, 21, 27, 11, 5, 7, 4, 12, 24, 31, 14,
                      6, 5, 8, 10, 19, 29, 12, 7, 4, 6, 11, 22, 26, 13, 8, 9]
        let points = counts.enumerated().map { offset, count -> String in
            let day = calendar.date(byAdding: .day, value: offset - (counts.count - 1), to: today) ?? today
            return "{\"date\":\"\(formatter.string(from: day))\",\"count\":\(count)}"
        }.joined(separator: ",")
        return Data("""
        {
          "days":30,"partialFailures":null,"totalCheckouts":417,
          "previousTotalCheckouts":362,"overdueCheckouts":3,
          "dailyTrend":[\(points)]
        }
        """.utf8)
    }
}

/// Search fans out to four endpoints at once, so a result list only looks real
/// if every one of them answers. Items, an upcoming reservation, an open
/// checkout, and people all match the same query on purpose -- a search that
/// returns one kind of thing does not exercise the ranking this screen exists
/// to show. `/api/users` is already served above and is reused as-is.
enum SearchFixtureAPI {
    /// Mirrors `AppRuntimeMode.CaptureSeed.searchQuery`, which is what the
    /// view actually reads; kept here so the fixture data and the typed query
    /// stay described in one place.
    static let query = "fx3"

    private static func iso(_ minutes: Int) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date.now.addingTimeInterval(TimeInterval(minutes * 60)))
    }

    static var assets: Data {
        Data("""
        {"data":[
          {"id":"a-1","assetTag":"CAM-014","name":"A-cam body","brand":"Sony","model":"FX3",
           "serialNumber":"FX3-88120","imageUrl":null,"computedStatus":"CHECKED_OUT",
           "location":{"id":"loc-1","name":"Camp Randall Creative Desk"},
           "category":{"id":"cat-1","name":"Cameras"},"department":{"id":"dep-1","name":"Video"},
           "activeBooking":null,"purchaseDate":"2025-03-14","purchasePrice":"3899.00",
           "residualValue":"2100.00","isFavorited":false},
          {"id":"a-2","assetTag":"CAM-021","name":null,"brand":"Sony","model":"FX30",
           "serialNumber":"FX30-2251","imageUrl":null,"computedStatus":"AVAILABLE",
           "location":{"id":"loc-1","name":"Camp Randall Creative Desk"},
           "category":{"id":"cat-1","name":"Cameras"},"department":{"id":"dep-1","name":"Video"},
           "activeBooking":null,"purchaseDate":"2025-08-02","purchasePrice":"2199.00",
           "residualValue":"1500.00","isFavorited":true}
        ],
        "bulkItems":[],"itemOrder":["a-1","a-2"],"total":2,"limit":10,"offset":0}
        """.utf8)
    }

    static var reservations: Data {
        Data("""
        {"data":[
          {"id":"rs-1","kind":"RESERVATION","title":"FX3 for Senior Day","status":"BOOKED",
           "startsAt":"\(iso(2880))","endsAt":"\(iso(3240))","notes":null,"refNumber":"RS-1180",
           "requester":{"id":"u-priya","name":"Priya Ramachandran","email":null,"avatarUrl":null},
           "location":{"id":"loc-1","name":"Camp Randall Creative Desk"},
           "serializedItems":[],"bulkItems":[],"event":null,"events":[],
           "allowedActions":[],"updatedAt":"\(iso(-600))","pickupKioskDevice":null}
        ],"total":1,"limit":10,"offset":0}
        """.utf8)
    }

    static var checkouts: Data {
        Data("""
        {"data":[
          {"id":"\(BookingFixtureAPI.bookingId)","kind":"CHECKOUT","title":"Volleyball vs Nebraska",
           "status":"OPEN","startsAt":"\(iso(-120))","endsAt":"\(iso(180))","notes":null,
           "refNumber":"CO-2418",
           "requester":{"id":"u-avery","name":"Avery Nakamura","email":null,"avatarUrl":null},
           "location":{"id":"loc-1","name":"Camp Randall Creative Desk"},
           "serializedItems":[],"bulkItems":[],"event":null,"events":[],
           "allowedActions":[],"updatedAt":"\(iso(-30))","pickupKioskDevice":null}
        ],"total":1,"limit":10,"offset":0}
        """.utf8)
    }
}

/// One camera body, carrying the fields the edit sheet actually writes to --
/// name, serial, and notes -- plus enough identity for the detail screen behind
/// the sheet to look like a real item rather than a blank form.
enum AssetFixtureAPI {
    static let assetId = "asset-fixture-1"

    static var asset: Data {
        Data("""
        {"data":{
          "id":"\(assetId)","assetTag":"CAM-014","name":"A-cam body",
          "brand":"Sony","model":"FX3","serialNumber":"FX3-88120",
          "imageUrl":null,"qrCodeValue":"CAM-014","linkUrl":null,
          "computedStatus":"AVAILABLE",
          "location":{"id":"loc-1","name":"Camp Randall Creative Desk"},
          "category":{"id":"cat-1","name":"Cameras"},
          "department":{"id":"dep-1","name":"Video"},
          "activeBooking":null,"upcomingReservations":[],"history":[],
          "parentAsset":null,"accessories":null,"metadata":null,
          "purchaseDate":"2025-03-14","purchasePrice":"3899.00","residualValue":"2100.00",
          "notes":"Shutter count checked at the start of the season. Ships with the cage attached.",
          "isFavorited":false
        }}
        """.utf8)
    }
}

/// One open checkout, sized so the detail screen has something to say in every
/// block it renders: a requester, a location, both serialized and bulk gear, a
/// linked event, and the actions an open checkout actually allows.
enum BookingFixtureAPI {
    static let bookingId = "bk-fixture-1"

    private static func iso(_ minutes: Int) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date.now.addingTimeInterval(TimeInterval(minutes * 60)))
    }

    static var booking: Data {
        Data("""
        {"data":{
          "id":"\(bookingId)","kind":"CHECKOUT","title":"Volleyball vs Nebraska","status":"OPEN",
          "startsAt":"\(iso(-120))","endsAt":"\(iso(180))",
          "notes":"Two bodies on the baseline, one roaming. Return through the gear room, not the loading dock.",
          "refNumber":"CO-2418",
          "requester":{"id":"u-avery","name":"Avery Nakamura","email":"avery.nakamura@wisc.edu","avatarUrl":null},
          "location":{"id":"loc-1","name":"Camp Randall Creative Desk"},
          "serializedItems":[
            {"id":"si-1","assetId":"a-1","allocationStatus":"CHECKED_OUT",
             "asset":{"id":"a-1","assetTag":"CAM-014","name":"Sony FX3","brand":"Sony","model":"FX3",
                      "serialNumber":"FX3-88120","imageUrl":null}},
            {"id":"si-2","assetId":"a-2","allocationStatus":"CHECKED_OUT",
             "asset":{"id":"a-2","assetTag":"AUD-007","name":"Sennheiser MKE 600","brand":"Sennheiser",
                      "model":"MKE 600","serialNumber":"MKE-4471","imageUrl":null}}
          ],
          "bulkItems":[
            {"id":"bi-1","plannedQuantity":4,"checkedOutQuantity":4,"checkedInQuantity":0,
             "bulkSku":{"id":"sku-1","name":"V-Mount Battery","unit":"battery","imageUrl":null,
                        "trackByNumber":true},
             "unitAllocations":null}
          ],
          "event":{"id":"ev-1","summary":"Volleyball vs Nebraska","sportCode":"VB",
                   "opponent":"Nebraska","isHome":true},
          "events":[{"id":"ev-1","summary":"Volleyball vs Nebraska","sportCode":"VB",
                     "opponent":"Nebraska","isHome":true}],
          "allowedActions":["EXTEND","EDIT","CANCEL"],
          "updatedAt":"\(iso(-30))",
          "pickupKioskDevice":null
        }}
        """.utf8)
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

    /// Nobody holds a slot, so every claimable row shows its Claim button. Seat
    /// 2 expires inside the 30-day window and Seat 4 has already lapsed, which
    /// is what proves the per-row expiry line still appears once it is worth
    /// acting on. Dates are built relative to launch so the window is exercised
    /// whenever the capture runs, not only in a particular month.
    static var openLicenses: Data {
        json("""
        { "data": [
          { "id": "l1", "code": "PM-AAAA-1111", "label": "Photo Mechanic Seat 1", "status": "AVAILABLE",
            "expiresAt": "\(utcMidnight(daysFromNow: 134))", "claims": [] },
          { "id": "l2", "code": "PM-BBBB-2222", "label": "Photo Mechanic Seat 2", "status": "PARTIAL",
            "expiresAt": "\(utcMidnight(daysFromNow: 12))",
            "claims": [ { "id": "c2", "userId": "u4", "claimedAt": "\(utcMidnight(daysFromNow: -3))", "releasedAt": null,
                          "user": { "id": "u4", "name": "Sam Okonkwo" } } ] },
          { "id": "l3", "code": "PM-CCCC-3333", "label": "Photo Mechanic Seat 3", "status": "CLAIMED",
            "expiresAt": "\(utcMidnight(daysFromNow: 134))",
            "claims": [ { "id": "c3", "userId": "u3", "claimedAt": "\(utcMidnight(daysFromNow: -5))", "releasedAt": null,
                          "user": { "id": "u3", "name": "Jordan Lee" } },
                        { "id": "c4", "userId": "u5", "claimedAt": "\(utcMidnight(daysFromNow: -2))", "releasedAt": null,
                          "user": { "id": "u5", "name": "Riley Chen" } } ] },
          { "id": "l4", "code": "PM-DDDD-4444", "label": "Photo Mechanic Seat 4", "status": "RETIRED",
            "expiresAt": "\(utcMidnight(daysFromNow: -201))", "claims": [] }
        ] }
        """)
    }

    static let noLicense = json("""
    { "data": null }
    """)

    /// Expiries are calendar dates encoded at UTC midnight, matching the
    /// storage contract in `src/lib/license-dates.ts`.
    private static func utcMidnight(daysFromNow days: Int) -> String {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let day = utc.startOfDay(for: Date().addingTimeInterval(Double(days) * 86_400))
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: day)
    }

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
    @Environment(AppState.self) private var appState

    var body: some View {
        ScheduleView()
            .onAppear {
                session.currentUser = ScheduleFixtures.staffUser
                // Non-zero so the Trade Board badge is actually on screen when
                // the toolbar is being looked at.
                appState.openTradeCount = 3
            }
    }
}

/// Renders the real `HomeView` against a canned dashboard.
struct HomeHarnessView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        HomeView()
            .onAppear { session.currentUser = ScheduleFixtures.staffUser }
    }
}

/// The Home dashboard payload. Sized on purpose: more gear and shifts than the
/// queue's per-lane caps show, so truncation is visible, and a staff draft with
/// an otherwise-empty personal queue, so the all-clear contradiction reproduces.
enum HomeFixtureAPI {
    private static func iso(_ minutes: Int) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: Date.now.addingTimeInterval(TimeInterval(minutes * 60)))
    }

    private static func booking(
        _ id: String, _ title: String, _ status: String, _ kind: String,
        startsIn: Int, endsIn: Int, items: Int, overdue: Bool = false
    ) -> String {
        """
        { "id": "\(id)", "kind": "\(kind)", "title": "\(title)", "refNumber": null,
          "eventId": null, "eventIds": [], "linkedEventId": null, "sportCode": null,
          "requesterUserId": "fixture-staff", "requesterName": "Jordan Lee",
          "requesterInitials": "JL", "requesterAvatarUrl": null,
          "locationName": "Media Ops Cage", "startsAt": "\(iso(startsIn))",
          "endsAt": "\(iso(endsIn))", "itemCount": \(items),
          "status": "\(status)", "isOverdue": \(overdue) }
        """
    }

    /// Nothing personal outstanding, one staff draft waiting.
    static var allClearDashboard: Data {
        Data("""
        { "data": {
          "role": "STAFF",
          "stats": { "checkedOut": 0, "overdue": 0, "reserved": 0, "dueToday": 0 },
          "myCheckouts": { "total": 0, "overdue": 0, "items": [] },
          "teamCheckouts": { "total": 0, "overdue": 0, "items": [] },
          "teamReservations": { "total": 0, "items": [] },
          "pendingPickups": { "total": 0, "items": [] },
          "myReservations": [], "overdueCount": 0, "overdueItems": [],
          "myShifts": [], "upcomingEvents": [],
          "drafts": [ { "id": "d1", "kind": "RESERVATION", "title": "Hockey B-roll kit",
                        "itemCount": 6, "updatedAt": "\(iso(-90))" } ],
          "flaggedItems": [], "lostBulkUnits": [], "myEventWork": []
        } }
        """.utf8)
    }

    static var dashboard: Data {
        // Four overdue: one more than the old cap, which used to drop it silently.
        let overdue = (1...4).map {
            booking("od\($0)", "Overdue kit \($0)", "OPEN", "CHECKOUT",
                    startsIn: -60 * 24 * $0, endsIn: -60 * $0, items: $0 + 1, overdue: true)
        }
        let dueToday = (1...2).map {
            booking("dt\($0)", "Camera package \($0)", "OPEN", "CHECKOUT",
                    startsIn: -120, endsIn: 45 * $0, items: 3)
        }
        // Six upcoming: three past the per-lane cap, so the overflow row has
        // something real to report.
        let upcoming = (1...6).map {
            booking("up\($0)", "Field kit \($0)", "OPEN", "CHECKOUT",
                    startsIn: 60 * 24 * $0, endsIn: 60 * 24 * $0 + 180, items: 2)
        }
        let checkouts = (overdue + dueToday + upcoming).joined(separator: ",")
        return Data("""
        { "data": {
          "role": "STAFF",
          "stats": { "checkedOut": 12, "overdue": 4, "reserved": 0, "dueToday": 2 },
          "myCheckouts": { "total": 12, "overdue": 4, "items": [\(checkouts)] },
          "teamCheckouts": { "total": 0, "overdue": 0, "items": [] },
          "teamReservations": { "total": 0, "items": [] },
          "pendingPickups": { "total": 0, "items": [] },
          "myReservations": [],
          "overdueCount": 4,
          "overdueItems": [],
          "myShifts": [],
          "upcomingEvents": [],
          "drafts": [ { "id": "d1", "kind": "RESERVATION", "title": "Hockey B-roll kit",
                        "itemCount": 6, "updatedAt": "\(iso(-90))" } ],
          "flaggedItems": [],
          "lostBulkUnits": [],
          "myEventWork": []
        } }
        """.utf8)
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

    /// Minutes from launch, snapped to a 5-minute mark so the rendered clock
    /// time still reads like a real call time.
    private static func fromNow(_ minutes: Int) -> String {
        let raw = Date.now.addingTimeInterval(TimeInterval(minutes * 60))
        let snapped = raw.timeIntervalSinceReferenceDate
        let rounded = (snapped / 300).rounded() * 300
        return isoString(Date(timeIntervalSinceReferenceDate: rounded))
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

    /// A foreground refresh calls `/api/me`. Without this the fixture session
    /// 401s against the real host and signs itself out mid-screenshot.
    static var me: Data {
        Data("""
        { "user": { "id": "fixture-staff", "name": "Jordan Lee",
                    "email": "jordan.lee@wisc.edu", "role": "STAFF",
                    "affiliation": null, "collaboratorProfile": null,
                    "capabilities": [], "collaboratorPolicy": null,
                    "staffingType": "ST", "avatarUrl": null,
                    "forcePasswordChange": false } }
        """.utf8)
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
            "sportCode": "MHKY", "opponent": "Minnesota", "isHome": false,
            "location": null, "rawLocationText": "3M Arena at Mariucci",
            "coverage": { "total": 3, "filled": 3, "percentage": 100 } },
          { "id": "e3", "summary": "Women's Basketball vs Iowa", "startsAt": "\(at(0, 19, 30))",
            "endsAt": "\(at(0, 22))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "WBB", "opponent": "Iowa", "isHome": true,
            "location": { "id": "loc-kc", "name": "Kohl Center" },
            "coverage": { "total": 5, "filled": 2, "percentage": 40 } },
          { "id": "e9", "summary": "Women's Soccer vs Penn State", "startsAt": "\(fromNow(-45))",
            "endsAt": "\(fromNow(75))", "allDay": false, "status": "CONFIRMED",
            "sportCode": "WSOC", "opponent": "Penn State", "isHome": true,
            "location": { "id": "loc-mc", "name": "McClimon Complex" },
            "coverage": { "total": 4, "filled": 3, "percentage": 75 } },
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

    /// Event detail reads the crew roster from here. Keyed off the requested
    /// `eventId` so tapping different rows does not show one canned crew.
    static func shiftGroups(for request: URLRequest) -> Data {
        let eventId = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "eventId" })?.value ?? "e1"
        guard let plan = crewPlans[eventId] else {
            return Data(#"{ "data": [], "total": 0 }"#.utf8)
        }
        let shifts = plan.shifts.enumerated().map { index, shift -> String in
            let assignment = shift.worker.map { worker in
                """
                { "id": "a-\(eventId)-\(index)", "status": "\(shift.status)",
                  "user": { "id": "u-\(index)", "name": "\(worker)",
                            "primaryArea": "\(shift.area)", "avatarUrl": null,
                            "role": "STUDENT", "staffingType": "ST" } }
                """
            }
            return """
            { "id": "s-\(eventId)-\(index)", "area": "\(shift.area)", "workerType": "ST",
              "startsAt": "\(plan.startsAt)", "endsAt": "\(plan.endsAt)",
              "callStartsAt": "\(plan.callStartsAt)", "callEndsAt": null, "notes": null,
              "assignments": [\(assignment ?? "")] }
            """
        }.joined(separator: ",\n")
        let filled = plan.shifts.filter { $0.worker != nil }.count
        let total = plan.shifts.count
        let percentage = total == 0 ? 0 : Int((Double(filled) / Double(total) * 100).rounded())
        return Data("""
        { "data": [ { "id": "sg-\(eventId)", "eventId": "\(eventId)", "notes": null,
            "event": { "id": "\(eventId)", "summary": "\(plan.summary)",
                       "startsAt": "\(plan.startsAt)", "endsAt": "\(plan.endsAt)",
                       "sportCode": "\(plan.sportCode)", "isHome": true,
                       "opponent": "\(plan.opponent)", "locationId": "\(plan.locationId)" },
            "shifts": [\(shifts)],
            "coverage": { "total": \(total), "filled": \(filled), "percentage": \(percentage) } } ],
          "total": 1 }
        """.utf8)
    }

    private struct CrewSlot {
        let area: String
        let worker: String?
        var status: String { worker == nil ? "OPEN" : "CONFIRMED" }
    }

    private struct CrewPlan {
        let summary: String
        let sportCode: String
        let opponent: String
        let locationId: String
        let startsAt: String
        let endsAt: String
        let callStartsAt: String
        let shifts: [CrewSlot]
    }

    /// Two crews worth looking at: the event the fixture user works, and the
    /// live one, so detail can be captured in both temporal states.
    private static var crewPlans: [String: CrewPlan] {
        [
            "e1": CrewPlan(
                summary: "Volleyball vs Nebraska", sportCode: "VB", opponent: "Nebraska",
                locationId: "loc-fh", startsAt: at(0, 11), endsAt: at(0, 14),
                callStartsAt: at(0, 9, 30),
                shifts: [
                    CrewSlot(area: "VIDEO", worker: "Jordan Lee"),
                    CrewSlot(area: "VIDEO", worker: "Alex Rivera"),
                    CrewSlot(area: "PHOTO", worker: "Sam Chen"),
                    CrewSlot(area: "PHOTO", worker: nil),
                    CrewSlot(area: "GRAPHICS", worker: "Riley Novak"),
                    CrewSlot(area: "SOCIAL", worker: nil),
                ]
            ),
            "e9": CrewPlan(
                summary: "Women's Soccer vs Penn State", sportCode: "WSOC", opponent: "Penn State",
                locationId: "loc-mc", startsAt: fromNow(-45), endsAt: fromNow(75),
                callStartsAt: fromNow(-105),
                shifts: [
                    CrewSlot(area: "VIDEO", worker: "Priya Shah"),
                    CrewSlot(area: "PHOTO", worker: "Marcus Webb"),
                    CrewSlot(area: "GRAPHICS", worker: "Dana Kim"),
                    CrewSlot(area: "SOCIAL", worker: nil),
                ]
            ),
        ]
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
