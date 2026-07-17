import Foundation
import Observation
import OSLog

enum KioskFlowAction: String, Codable, CaseIterable { case checkout, pickup, `return`, manage }
enum KioskFlowSource: String, Codable, CaseIterable { case scan, event, person, reservation, activeCheckout }

struct KioskIntentEvent: Equatable { let id: String; let title: String; let endsAt: Date? }
struct KioskIntentBooking: Equatable { let id: String; let title: String; let startsAt: Date?; let endsAt: Date? }
enum KioskIntentAmbiguity: Equatable { case none; case unresolved(String) }

struct KioskFlowIntent: Equatable {
    var action: KioskFlowAction
    var source: KioskFlowSource
    var identifiedUser: KioskUser?
    var expectedRequester: KioskUser?
    var selectedEvent: KioskIntentEvent?
    var targetBooking: KioskIntentBooking?
    var pendingScanValues: [String]
    let createdAt: Date
    var ambiguity: KioskIntentAmbiguity

    var heroTitle: String {
        let verb = switch action {
        case .checkout: "Checking out"
        case .pickup: "Picking up"
        case .return: "Returning gear"
        case .manage: "Managing checkout"
        }
        return (selectedEvent?.title ?? targetBooking?.title).map { "\(verb) for \($0)" } ?? verb
    }
}

enum KioskIntentCleanupReason: String { case cancel, timeout, success, deactivation, deletedTarget }

enum KioskFlowIntentReducer {
    static func identify(_ user: KioskUser, in intent: KioskFlowIntent) -> KioskFlowIntent {
        var next = intent; next.identifiedUser = user; next.ambiguity = .none; return next
    }
    static func canIdentify(_ user: KioskUser, for intent: KioskFlowIntent) -> Bool {
        intent.expectedRequester?.id == nil || intent.expectedRequester?.id == user.id
    }
    static func consumePendingScans(in intent: KioskFlowIntent) -> (intent: KioskFlowIntent, scans: [String]) {
        var next = intent; let scans = next.pendingScanValues; next.pendingScanValues.removeAll(); return (next, scans)
    }
}

enum KioskScannerOwner: String, CaseIterable { case none, home, identity, studentHub, checkout, pickup, `return`, detail }
enum KioskScannerConnectionState: String { case ready, reconnecting }

@Observable @MainActor
final class KioskScannerCoordinator {
    private static let logger = Logger(subsystem: "com.erikrole.WisconsinKiosk", category: "FlowRouting")
    var owner: KioskScannerOwner = .none
    var connectionState: KioskScannerConnectionState = .ready
    var isEditing = false
    var lastScanAt: Date?
    var notice: String?
    @ObservationIgnored private var scanHandler: ((String) -> Void)?

    var statusText: String {
        if isEditing { return "Scanner paused while editing" }
        if connectionState == .reconnecting { return "Scanner reconnecting" }
        return "Scanner ready"
    }
    var statusSymbol: String {
        if isEditing { return "pause.circle.fill" }
        if connectionState == .reconnecting { return "arrow.triangle.2.circlepath" }
        return "barcode.viewfinder"
    }
    var acceptsScans: Bool { owner != .none && !isEditing && connectionState == .ready }

    func claim(_ owner: KioskScannerOwner, handler: @escaping (String) -> Void) {
        self.owner = owner; scanHandler = handler
        Self.logger.debug("scanner owner=\(owner.rawValue, privacy: .public)")
    }
    func release(_ owner: KioskScannerOwner) {
        guard self.owner == owner else { return }
        self.owner = .none; scanHandler = nil
        Self.logger.debug("scanner released owner=\(owner.rawValue, privacy: .public)")
    }
    func receive(_ value: String) {
        guard acceptsScans else { return }
        lastScanAt = Date(); Self.logger.info("scan received owner=\(self.owner.rawValue, privacy: .public)"); scanHandler?(value)
    }
    func setEditing(_ editing: Bool) { isEditing = editing }
    func rejectEditingBurst() { notice = "Finish editing before scanning"; Self.logger.notice("scanner burst rejected during editing") }
}
