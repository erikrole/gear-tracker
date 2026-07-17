import XCTest
@testable import Wisconsin_Kiosk

final class KioskFlowRoutingTests: XCTestCase {
    private let usman = KioskUser(id: "usman", name: "Usman", avatarUrl: nil, role: "STUDENT", affiliation: nil, affiliationBadge: nil)

    func testExpectedRequesterRejectsAnotherIdentityWithoutChangingIntent() {
        let other = KioskUser(id: "other", name: "Other", avatarUrl: nil, role: "STUDENT", affiliation: nil, affiliationBadge: nil)
        let intent = KioskFlowIntent(
            action: .pickup, source: .scan, identifiedUser: nil, expectedRequester: usman,
            selectedEvent: nil, targetBooking: nil, pendingScanValues: ["secret"],
            createdAt: Date(), ambiguity: .none
        )
        XCTAssertFalse(KioskFlowIntentReducer.canIdentify(other, for: intent))
        XCTAssertTrue(KioskFlowIntentReducer.canIdentify(usman, for: intent))
        XCTAssertEqual(intent.pendingScanValues.count, 1)
    }

    func testPendingScansAreConsumedExactlyOnce() {
        let intent = KioskFlowIntent(
            action: .checkout, source: .scan, identifiedUser: usman, expectedRequester: nil,
            selectedEvent: nil, targetBooking: nil, pendingScanValues: ["one"],
            createdAt: Date(), ambiguity: .none
        )
        let first = KioskFlowIntentReducer.consumePendingScans(in: intent)
        let second = KioskFlowIntentReducer.consumePendingScans(in: first.intent)
        XCTAssertEqual(first.scans, ["one"])
        XCTAssertTrue(second.scans.isEmpty)
    }

    func testHIDBurstRestoresOriginalTextAndSuppressesTheRemainder() {
        var detector = KioskHIDBurstDetector()
        let start = Date()
        var text = "Practice"
        for offset in 0..<5 {
            XCTAssertEqual(detector.evaluate(replacement: "X", currentText: text, at: start.addingTimeInterval(Double(offset) * 0.02)), .allow)
            text += "X"
        }
        XCTAssertEqual(detector.evaluate(replacement: "X", currentText: text, at: start.addingTimeInterval(0.10)), .reject(baseline: "Practice"))
        XCTAssertEqual(detector.evaluate(replacement: "Y", currentText: "Practice", at: start.addingTimeInterval(0.12)), .suppress)
    }

    func testHumanTypingWithPausesIsAllowed() {
        var detector = KioskHIDBurstDetector()
        let start = Date()
        for offset in 0..<8 {
            XCTAssertEqual(detector.evaluate(replacement: "a", currentText: String(repeating: "a", count: offset), at: start.addingTimeInterval(Double(offset) * 0.2)), .allow)
        }
    }

    @MainActor
    func testScannerHasOnlyOneLogicalOwner() {
        let scanner = KioskScannerCoordinator()
        scanner.claim(.home) { _ in }
        scanner.claim(.identity) { _ in }
        XCTAssertEqual(scanner.owner, .identity)
        scanner.setEditing(true)
        XCTAssertFalse(scanner.acceptsScans)
        XCTAssertEqual(scanner.statusText, "Scanner paused while editing")
    }
}
