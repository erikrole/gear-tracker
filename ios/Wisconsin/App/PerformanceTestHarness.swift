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

private enum PerformanceFixtures {
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
#endif
