import XCTest

/// Drives Browse -> Reports and captures the rendered screen. Swift Charts
/// failures are invisible to a compiler and to model tests: an empty series or
/// a bad axis renders a blank box that still builds and still decodes. This
/// test exists so a human can look at the result.
@MainActor
final class ReportsScreenshotUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testReportsScreenCaptures() throws {
        let app = XCUIApplication()
        app.launch()

        let browseTab = app.buttons["Browse"]
        XCTAssertTrue(browseTab.waitForExistence(timeout: 20), "Browse tab never appeared -- is the app signed in?")
        browseTab.tap()

        let reportsRow = app.staticTexts["Reports"]
        XCTAssertTrue(reportsRow.waitForExistence(timeout: 10), "Reports row missing from Browse")
        reportsRow.tap()

        // Wait on the checkouts metric, not utilization: utilization only
        // renders when the server is new enough to send the custody block, and
        // this test should still pass against an older deployment.
        let checkoutsMetric = app.staticTexts["CHECKOUTS"]
        let loaded = checkoutsMetric.waitForExistence(timeout: 25)

        // Capture whatever landed, loaded or not, so a failure is diagnosable.
        attach(app, name: "reports-top")
        XCTAssertTrue(loaded, "Reports never loaded checkout activity")

        app.swipeUp(velocity: .slow)
        attach(app, name: "reports-mid")

        app.swipeUp(velocity: .slow)
        attach(app, name: "reports-bottom")
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
