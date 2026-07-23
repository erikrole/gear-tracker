import Foundation
import WidgetKit

@MainActor
final class ShiftGlanceSnapshotCoordinator {
    static let shared = ShiftGlanceSnapshotCoordinator()

    private let store = ShiftGlanceSnapshotStore()
    private var isRefreshing = false

    private init() {}

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let shifts = try await APIClient.shared.myShifts(limit: 10)
            let snapshot = ShiftGlanceSnapshot(myShifts: shifts, generatedAt: Date())
            guard store.save(snapshot) else { return }
            WidgetCenter.shared.reloadTimelines(ofKind: ShiftGlanceContract.widgetKind)
        } catch {
            // Keep the last successful snapshot during transient failures.
        }
    }

    func clear() {
        store.clear()
        WidgetCenter.shared.reloadTimelines(ofKind: ShiftGlanceContract.widgetKind)
    }
}

extension ShiftGlanceSnapshot {
    init(myShifts: [MyShift], generatedAt: Date) {
        let upcoming = myShifts
            .filter { $0.endsAt > generatedAt }
            .sorted { $0.startsAt < $1.startsAt }
            .prefix(4)
            .map { shift in
                ShiftGlanceItem(
                    id: shift.id,
                    eventId: shift.event.id,
                    title: scheduleEventDisplayTitle(shift.asScheduleEvent),
                    area: shift.area.shiftAreaLabel,
                    startsAt: shift.startsAt,
                    endsAt: shift.endsAt,
                    eventStartsAt: shift.event.startsAt,
                    locationName: shift.event.locationName,
                    gearStatus: shift.gear.status,
                    gearLabel: shift.gear.hasGear ? shift.gear.gearLabel : nil
                )
            }
        self.init(generatedAt: generatedAt, shifts: Array(upcoming))
    }
}
