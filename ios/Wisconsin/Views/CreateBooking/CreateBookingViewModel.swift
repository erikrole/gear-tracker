import SwiftUI

/// Returns the next clean hour boundary after `now`, plus `addingHours`.
/// `addingHours: 0` → the upcoming `:00`; `addingHours: 1` → one hour after that.
private func nextCleanHour(addingHours: Int = 0) -> Date {
    let cal = Calendar.current
    let nextHour = cal.nextDate(
        after: .now,
        matching: DateComponents(minute: 0, second: 0),
        matchingPolicy: .nextTime
    ) ?? .now
    return cal.date(byAdding: .hour, value: addingHours, to: nextHour) ?? nextHour
}

struct AssetCategoryGroup: Identifiable {
    let id: String
    let title: String
    let assets: [Asset]
}

@MainActor
@Observable
final class CreateBookingViewModel {
    private let assetPickerLimit = 300

    var title = ""
    var selectedUserId: String = ""
    var selectedLocationId: String = ""
    var startsAt = nextCleanHour(addingHours: 0)
    var endsAt = nextCleanHour(addingHours: 1)
    var notes = ""
    var userEditedTitle = false
    var userEditedLocation = false
    var userEditedWindow = false

    var prefillEventId: String?
    var prefillShiftAssignmentId: String?

    var options: FormOptions?
    var events: [ScheduleEvent] = []
    var selectedEventIds: [String] = []
    var isLoadingOptions = false
    var isLoadingEvents = false
    var isSubmitting = false
    var error: String?
    var eventError: String?

    // Equipment selection
    var selectedAssetIds: Set<String> = []
    var selectedBulkQuantities: [String: Int] = [:]
    var availableAssets: [Asset] = []
    var selectedAssetSnapshots: [String: Asset] = [:]
    var isLoadingAssets = false
    var isAddingScannedAsset = false
    var assetSearch = ""
    var assetTotal = 0
    var assetOffset = 0
    var scanError: String?
    var hasMoreAssets: Bool { availableAssets.count < assetTotal }
    private var searchTask: Task<Void, Never>?

    // Conflict checking — non-blocking pre-flight hint against the date window.
    var conflictedAssetIds: Set<String> = []
    private var conflictCheckTask: Task<Void, Never>?

    func scheduleConflictCheck() {
        conflictCheckTask?.cancel()
        guard !selectedAssetIds.isEmpty, !selectedLocationId.isEmpty, endsAt > startsAt else {
            conflictedAssetIds = []
            return
        }
        let ids = Array(selectedAssetIds)
        let location = selectedLocationId
        let start = startsAt, end = endsAt
        conflictCheckTask = Task {
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            let result = await APIClient.shared.checkAvailability(
                locationId: location, serializedAssetIds: ids, startsAt: start, endsAt: end
            )
            conflictedAssetIds = Set(result.keys)
        }
    }

    var selectedUser: FormUser? { options?.users.first(where: { $0.id == selectedUserId }) }
    var selectedLocation: FormOption? { options?.locations.first(where: { $0.id == selectedLocationId }) }
    var selectedEvents: [ScheduleEvent] {
        let byId = Dictionary(uniqueKeysWithValues: events.map { ($0.id, $0) })
        return selectedEventIds
            .compactMap { byId[$0] }
            .sorted { $0.startsAt < $1.startsAt }
    }
    var linkedEventCount: Int {
        if !selectedEventIds.isEmpty { return selectedEventIds.count }
        return prefillEventId == nil ? 0 : 1
    }
    var linkedEventLabel: String? {
        if selectedEvents.isEmpty {
            return prefillEventId == nil ? nil : "Linked to event"
        }
        if selectedEvents.count == 1 { return selectedEvents[0].shortBookingEventTitle }
        return "\(selectedEvents.count) linked events"
    }
    var selectedAssets: [Asset] {
        selectedAssetIds
            .compactMap { id in selectedAssetSnapshots[id] ?? availableAssets.first(where: { $0.id == id }) }
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
    var availableAssetGroups: [AssetCategoryGroup] {
        let grouped = Dictionary(grouping: availableAssets) { asset in
            let categoryName = asset.category?.name.trimmingCharacters(in: .whitespacesAndNewlines)
            return categoryName?.isEmpty == false ? categoryName! : "Uncategorized"
        }
        return grouped
            .map { title, assets in
                AssetCategoryGroup(
                    id: title,
                    title: title,
                    assets: assets.sorted(by: compareAssetsByDisplayName)
                )
            }
            .sorted { lhs, rhs in
                if lhs.title == "Uncategorized" { return false }
                if rhs.title == "Uncategorized" { return true }
                return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
            }
    }
    var availableBulkSkus: [FormBulkSku] {
        let all = options?.bulkSkus ?? []
        let query = assetSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        return all
            .filter { sku in
                guard selectedLocationId.isEmpty || sku.locationId == nil || sku.locationId == selectedLocationId else { return false }
                if query.isEmpty { return true }
                return sku.name.localizedCaseInsensitiveContains(query)
                    || (sku.categoryName?.localizedCaseInsensitiveContains(query) ?? false)
                    || (sku.category?.localizedCaseInsensitiveContains(query) ?? false)
            }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    var selectedBulkSkus: [FormBulkSku] {
        let all = options?.bulkSkus ?? []
        return all
            .filter { (selectedBulkQuantities[$0.id] ?? 0) > 0 }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    var selectedBulkTotal: Int {
        selectedBulkQuantities.values.reduce(0, +)
    }
    var selectedEquipmentCount: Int {
        selectedAssetIds.count + selectedBulkTotal
    }
    var selectedBulkRequests: [BulkReservationRequest] {
        selectedBulkQuantities
            .filter { $0.value > 0 }
            .sorted { $0.key < $1.key }
            .map { BulkReservationRequest(bulkSkuId: $0.key, quantity: $0.value) }
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !selectedUserId.isEmpty
            && !selectedLocationId.isEmpty
            && endsAt > startsAt
    }

    /// Moves the start date while preserving the booking duration, matching
    /// calendar-app behavior. Only called from the From picker binding so
    /// programmatic prefills never shift an explicitly set end date.
    func adjustStart(to newStart: Date) {
        userEditedWindow = true
        let duration = endsAt.timeIntervalSince(startsAt)
        startsAt = newStart
        endsAt = newStart.addingTimeInterval(max(duration, 0))
    }

    func adjustEnd(to newEnd: Date) {
        userEditedWindow = true
        endsAt = newEnd
    }

    func prefill(title: String, startsAt: Date, endsAt: Date, userId: String, eventId: String?, shiftAssignmentId: String?) {
        self.title = title
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.selectedUserId = userId
        self.prefillEventId = eventId
        self.prefillShiftAssignmentId = shiftAssignmentId
    }

    func loadEvents() async {
        guard events.isEmpty else { return }
        isLoadingEvents = true
        eventError = nil
        do {
            events = try await APIClient.shared.calendarEvents(includePast: false, limit: 60)
        } catch {
            eventError = error.localizedDescription
        }
        isLoadingEvents = false
    }

    func toggleEvent(_ event: ScheduleEvent) {
        if selectedEventIds.contains(event.id) {
            selectedEventIds.removeAll { $0 == event.id }
        } else {
            guard selectedEventIds.count < 3 else {
                Haptics.warning()
                return
            }
            selectedEventIds.append(event.id)
        }
        sortSelectedEventIds()
        applySelectedEventsToDetails()
        Haptics.selection()
    }

    func removeSelectedEvent(_ event: ScheduleEvent) {
        selectedEventIds.removeAll { $0 == event.id }
        applySelectedEventsToDetails()
    }

    func setTitleFromUser(_ value: String) {
        userEditedTitle = true
        title = value
    }

    func setLocationFromUser(_ value: String) {
        userEditedLocation = true
        selectedLocationId = value
    }

    private func sortSelectedEventIds() {
        let byId = Dictionary(uniqueKeysWithValues: events.map { ($0.id, $0) })
        selectedEventIds.sort {
            (byId[$0]?.startsAt ?? .distantFuture) < (byId[$1]?.startsAt ?? .distantFuture)
        }
    }

    private func applySelectedEventsToDetails() {
        let picked = selectedEvents
        guard let first = picked.first else { return }
        if !userEditedTitle || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            title = first.shortBookingEventTitle
            userEditedTitle = false
        }
        if !userEditedWindow {
            startsAt = first.startsAt
            endsAt = picked.last?.endsAt ?? first.endsAt
        }
        prefillEventId = nil
        prefillShiftAssignmentId = nil
        scheduleConflictCheck()
    }

    /// Prefills a reservation context started from an item row.
    /// Sets a sensible title, preselects the asset, and seeds the equipment list
    /// so the asset is visible at the top of step 2.
    func prefillReservation(for asset: Asset) {
        if title.isEmpty {
            title = "Reservation: \(asset.displayName)"
        }
        selectedAssetIds.insert(asset.id)
        selectedAssetSnapshots[asset.id] = asset
        if !availableAssets.contains(where: { $0.id == asset.id }) {
            availableAssets.insert(asset, at: 0)
            if assetTotal == 0 { assetTotal = 1 }
        }
        // Pre-seed the location to the asset's home location if nothing is set yet.
        if selectedLocationId.isEmpty {
            selectedLocationId = asset.location.id
        }
    }

    /// Prefills a reservation context started from a bulk-item family (e.g.
    /// a scanned battery unit). Seeds one unit of the SKU; the equipment step
    /// resolves the SKU details once form options load.
    func prefillReservation(forFamily family: AssetFamilySearchResult) {
        if title.isEmpty {
            title = "Reservation: \(family.name)"
        }
        if (selectedBulkQuantities[family.id] ?? 0) == 0 {
            selectedBulkQuantities[family.id] = 1
        }
        if selectedLocationId.isEmpty {
            selectedLocationId = family.locationId
        }
    }

    func loadOptions() async {
        guard options == nil else { return }
        isLoadingOptions = true
        do {
            options = try await APIClient.shared.formOptions()
        } catch {
            self.error = error.localizedDescription
        }
        isLoadingOptions = false
    }

    func loadAvailableAssets(reset: Bool = false) async {
        // Search-driven resets must still pass through while an older request
        // is in flight, then the snapshot guard below drops stale responses.
        if !reset, isLoadingAssets { return }
        let capturedSearch = assetSearch
        if reset {
            availableAssets = []
            assetOffset = 0
            assetTotal = 0
            error = nil
        }
        isLoadingAssets = true
        defer { isLoadingAssets = false }
        do {
            let resp = try await APIClient.shared.assets(
                search: capturedSearch.isEmpty ? nil : capturedSearch,
                statuses: [.available],
                locationId: selectedLocationId.isEmpty ? nil : selectedLocationId,
                sort: "name",
                limit: assetPickerLimit,
                offset: 0
            )
            // Stale-write guard: drop the response if the user has typed more
            // since this request was started. Mirrors the global-search fix.
            guard capturedSearch == assetSearch else { return }
            availableAssets = resp.data
            for asset in resp.data where selectedAssetIds.contains(asset.id) {
                selectedAssetSnapshots[asset.id] = asset
            }
            assetTotal = resp.total
            assetOffset = resp.data.count
        } catch {
            guard capturedSearch == assetSearch else { return }
            self.error = error.localizedDescription
        }
    }

    func toggleAsset(_ asset: Asset) {
        if selectedAssetIds.contains(asset.id) {
            selectedAssetIds.remove(asset.id)
            selectedAssetSnapshots.removeValue(forKey: asset.id)
        } else {
            selectedAssetIds.insert(asset.id)
            selectedAssetSnapshots[asset.id] = asset
        }
        scheduleConflictCheck()
    }

    func removeSelectedAsset(_ asset: Asset) {
        selectedAssetIds.remove(asset.id)
        selectedAssetSnapshots.removeValue(forKey: asset.id)
        scheduleConflictCheck()
    }

    func quantity(for sku: FormBulkSku) -> Int {
        selectedBulkQuantities[sku.id] ?? 0
    }

    func setBulkQuantity(_ sku: FormBulkSku, quantity: Int) {
        let clamped = min(max(quantity, 0), max(sku.availableQuantity, 0))
        if clamped == 0 {
            selectedBulkQuantities.removeValue(forKey: sku.id)
        } else {
            selectedBulkQuantities[sku.id] = clamped
        }
    }

    func incrementBulk(_ sku: FormBulkSku) {
        setBulkQuantity(sku, quantity: quantity(for: sku) + 1)
    }

    func decrementBulk(_ sku: FormBulkSku) {
        setBulkQuantity(sku, quantity: quantity(for: sku) - 1)
    }

    func removeSelectedBulk(_ sku: FormBulkSku) {
        selectedBulkQuantities.removeValue(forKey: sku.id)
    }

    func addScannedAsset(id: String) async {
        scanError = nil
        isAddingScannedAsset = true
        defer { isAddingScannedAsset = false }
        do {
            let detail = try await APIClient.shared.asset(id: id)
            let asset = detail.asAsset
            guard asset.computedStatus == .available else {
                scanError = "\(asset.displayName) is \(asset.computedStatus.label.lowercased())."
                Haptics.warning()
                return
            }
            selectedAssetIds.insert(asset.id)
            selectedAssetSnapshots[asset.id] = asset
            if !availableAssets.contains(where: { $0.id == asset.id }) {
                availableAssets.insert(asset, at: 0)
                assetTotal = max(assetTotal, availableAssets.count)
            }
            scheduleConflictCheck()
            Haptics.success()
        } catch {
            scanError = error.localizedDescription
            Haptics.error()
        }
    }

    func onSearchChange() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await loadAvailableAssets(reset: true)
        }
    }

    func submit() async throws -> String {
        guard !selectedUserId.isEmpty, !selectedLocationId.isEmpty else {
            throw APIError.serverError("Select a requester and location.")
        }
        isSubmitting = true
        defer { isSubmitting = false }
        return try await APIClient.shared.createReservation(
            title: title.trimmingCharacters(in: .whitespaces),
            requesterUserId: selectedUserId,
            locationId: selectedLocationId,
            startsAt: startsAt,
            endsAt: endsAt,
            notes: notes.isEmpty ? nil : notes,
            eventId: selectedEventIds.isEmpty ? prefillEventId : nil,
            eventIds: selectedEventIds,
            shiftAssignmentId: prefillShiftAssignmentId,
            serializedAssetIds: Array(selectedAssetIds),
            bulkItems: selectedBulkRequests
        )
    }

    private func compareAssetsByDisplayName(_ lhs: Asset, _ rhs: Asset) -> Bool {
        let nameOrder = lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName)
        if nameOrder != .orderedSame { return nameOrder == .orderedAscending }
        return (lhs.assetTag ?? "").localizedStandardCompare(rhs.assetTag ?? "") == .orderedAscending
    }
}
