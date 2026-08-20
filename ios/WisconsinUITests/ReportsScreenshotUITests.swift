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

/// Captures the Schedule list against the fixture harness, so a UI change can
/// be compared shot-for-shot without a signed-in session or a live network.
@MainActor
final class ScheduleScreenshotUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testScheduleListCaptures() throws {
        let app = XCUIApplication()
        app.launchEnvironment["GT_PERFORMANCE_SCENARIO"] = "schedule"
        app.launch()

        let title = app.navigationBars["Schedule"]
        XCTAssertTrue(title.waitForExistence(timeout: 20), "Schedule never rendered")
        // Wait on fixture content, not just the chrome.
        let firstEvent = app.staticTexts["Volleyball vs Nebraska"]
        XCTAssertTrue(firstEvent.waitForExistence(timeout: 15), "Fixture events never loaded")

        attach(app, name: "schedule-top")

        app.swipeUp(velocity: .slow)
        attach(app, name: "schedule-mid")

        app.swipeUp(velocity: .slow)
        attach(app, name: "schedule-bottom")

        // Calendar mode shares EventRow with the list, so a row change lands
        // here too. Capture it rather than assuming it survived.
        let calendar = app.buttons["Calendar"]
        if calendar.waitForExistence(timeout: 5) {
            calendar.tap()
            _ = app.staticTexts["Volleyball vs Nebraska"].waitForExistence(timeout: 10)
            attach(app, name: "schedule-calendar")
        }
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}

/// Captures Event detail in both temporal states. The Schedule list grew a NOW
/// badge and a dimmed finished state before detail had either, so these two
/// shots are what prove the screens now agree.
@MainActor
final class EventDetailScreenshotUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testEventDetailCaptures() throws {
        let app = XCUIApplication()
        app.launchEnvironment["GT_PERFORMANCE_SCENARIO"] = "schedule"
        app.launch()

        XCTAssertTrue(app.navigationBars["Schedule"].waitForExistence(timeout: 20),
                      "Schedule never rendered")

        // A finished event the fixture user works, so the crew and gear blocks
        // are populated rather than empty.
        openEvent(app, titled: "Volleyball vs Nebraska")
        attach(app, name: "event-detail-ended")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // The event straddling launch time.
        openEvent(app, titled: "Women's Soccer vs Penn State")
        attach(app, name: "event-detail-live")
    }

    private func openEvent(_ app: XCUIApplication, titled title: String) {
        let row = app.staticTexts[title]
        XCTAssertTrue(row.waitForExistence(timeout: 15), "\(title) never appeared")
        row.tap()
        // Wait on the crew section, not the title: the title is already on the
        // list screen, so it exists before the push finishes.
        _ = app.staticTexts["Crew"].waitForExistence(timeout: 10)
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}

/// Captures the Home action queue. The fixture carries more gear than the
/// per-lane caps show and a staff draft with an empty personal queue, so both
/// the truncation and the all-clear contradiction are on screen.
@MainActor
final class HomeScreenshotUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testHomeCaptures() throws {
        let app = XCUIApplication()
        app.launchEnvironment["GT_PERFORMANCE_SCENARIO"] = "home"
        app.launch()

        // Wait on fixture content, not chrome.
        XCTAssertTrue(app.staticTexts["Overdue"].waitForExistence(timeout: 20),
                      "Home never loaded the dashboard fixture")
        attach(app, name: "home-top")

        app.swipeUp(velocity: .slow)
        attach(app, name: "home-queue")

        app.swipeUp(velocity: .slow)
        attach(app, name: "home-bottom")
    }

    func testHomeAllClearWithStaffDraft() throws {
        let app = XCUIApplication()
        app.launchEnvironment["GT_PERFORMANCE_SCENARIO"] = "homeAllClear"
        app.launch()

        XCTAssertTrue(app.staticTexts["Hockey B-roll kit"].waitForExistence(timeout: 20),
                      "Staff draft never rendered")
        attach(app, name: "home-all-clear")
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
