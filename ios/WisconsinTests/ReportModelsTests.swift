import XCTest
@testable import Wisconsin

/// These payloads are trimmed captures of real `/api/reports/*` responses. A
/// silent decode failure here is the one bug that would compile cleanly and
/// render an empty chart, so the fixtures keep the server's exact key names,
/// including the fields iOS deliberately ignores.
final class ReportModelsTests: XCTestCase {

    // MARK: Utilization

    private let utilizationJSON = """
    {
      "activeAssets": 190,
      "days": 30,
      "totalAssets": 198,
      "statusCounts": {
        "AVAILABLE": 187,
        "CHECKED_OUT": 3,
        "PENDING_PICKUP": 0,
        "RESERVED": 0,
        "MAINTENANCE": 0,
        "RETIRED": 8
      },
      "byLocation": [{ "location": "Camp Randall", "locationId": "loc-1", "count": 196 }],
      "byType": [{ "type": "Lenses", "count": 20 }],
      "byCategory": [{ "category": "Tripods", "categoryId": "cat-1", "count": 7 }],
      "byDepartment": [],
      "custody": {
        "assetsUsed": 56,
        "checkoutCount": 264,
        "custodyDays": 194.17638385797454,
        "idleCount": 134,
        "idlePricedCount": 8,
        "idleValue": 1408.19,
        "neverCheckedOutCount": 124,
        "utilizationRate": 0.03406603225578501,
        "idleAssets": [
          {
            "assetId": "asset-idle-1",
            "assetTag": "a7 V 2 Grip",
            "category": "Accessories",
            "lastCheckedOutAt": null,
            "name": "Sony VG-C4EM Vertical Grip",
            "purchasePrice": 326.03
          }
        ],
        "topUsed": [
          {
            "assetId": "asset-1",
            "assetTag": "70-200 4",
            "checkouts": 10,
            "custodyDays": 11.088537719907407,
            "name": "Sony FE 70-200mm f/2.8 GM OSS II",
            "utilizationRate": 0.36961792399691357
          }
        ]
      }
    }
    """

    func testUtilizationReportDecodesCustodyMetrics() throws {
        let report = try JSONDecoder().decode(UtilizationReport.self, from: Data(utilizationJSON.utf8))

        XCTAssertEqual(report.days, 30)
        XCTAssertEqual(report.activeAssets, 190)
        XCTAssertEqual(report.totalAssets, 198)
        let custody = try XCTUnwrap(report.custody)
        XCTAssertEqual(custody.assetsUsed, 56)
        XCTAssertEqual(custody.idleCount, 134)
        XCTAssertEqual(custody.neverCheckedOutCount, 124)
        XCTAssertEqual(custody.utilizationRate, 0.03406603225578501, accuracy: 1e-9)
        XCTAssertEqual(custody.custodyDays, 194.17638385797454, accuracy: 1e-9)

        let top = try XCTUnwrap(custody.topUsed.first)
        XCTAssertEqual(top.assetTag, "70-200 4")
        XCTAssertEqual(top.checkouts, 10)
        XCTAssertEqual(top.custodyDays, 11.088537719907407, accuracy: 1e-9)
    }

    func testStatusSlicesDropEmptyBucketsAndKeepWebOrdering() throws {
        let report = try JSONDecoder().decode(UtilizationReport.self, from: Data(utilizationJSON.utf8))
        let slices = ReportStatusSlice.build(from: report.statusCounts)

        // Zero-count statuses would render as invisible wedges with visible
        // legend rows, so they are dropped entirely.
        XCTAssertEqual(slices.map(\.status), ["AVAILABLE", "CHECKED_OUT", "RETIRED"])
        XCTAssertEqual(slices.map(\.count), [187, 3, 8])
        XCTAssertEqual(slices.map(\.label), ["Available", "Checked out", "Retired"])
        // Chart roles, not status text tones: these colours fill wedges.
        XCTAssertEqual(slices.map(\.role), [.available, .active, .neutral])
    }

    func testUtilizationReportDecodesAPreCustodyServerPayload() throws {
        // The shape this endpoint returned before the custody rebuild. A build
        // in the App Store will meet it during any deploy window or rollback,
        // and must still draw the status snapshot instead of erroring out.
        let legacy = """
        {
          "totalAssets": 198,
          "statusCounts": { "AVAILABLE": 187, "CHECKED_OUT": 3, "RETIRED": 8 },
          "byLocation": [{ "location": "Camp Randall", "count": 196 }],
          "byType": [{ "type": "Lenses", "count": 20 }],
          "byDepartment": []
        }
        """
        let report = try JSONDecoder().decode(UtilizationReport.self, from: Data(legacy.utf8))

        XCTAssertNil(report.custody)
        XCTAssertNil(report.days)
        XCTAssertNil(report.activeAssets)
        XCTAssertEqual(report.totalAssets, 198)
        XCTAssertEqual(ReportStatusSlice.build(from: report.statusCounts).count, 3)
    }

    func testStatusSlicesSurfaceUnknownServerStatuses() {
        let slices = ReportStatusSlice.build(from: ["AVAILABLE": 2, "QUARANTINED": 5])

        // A status added on the server later must still appear rather than
        // silently vanishing from the donut.
        XCTAssertEqual(slices.map(\.status), ["AVAILABLE", "QUARANTINED"])
        XCTAssertEqual(slices.last?.role, .neutral)
    }

    // MARK: Checkouts

    private let checkoutJSON = """
    {
      "days": 30,
      "totalCheckouts": 82,
      "previousTotalCheckouts": 22,
      "overdueCheckouts": 0,
      "focusDate": null,
      "recentCheckouts": [],
      "topRequesters": [],
      "dailyTrend": [
        { "date": "2026-07-11", "count": 0 },
        { "date": "2026-07-12", "count": 0 },
        { "date": "2026-07-13", "count": 2 }
      ]
    }
    """

    func testCheckoutActivityReportDecodesTrendAndPriorWindow() throws {
        let report = try JSONDecoder().decode(CheckoutActivityReport.self, from: Data(checkoutJSON.utf8))

        XCTAssertEqual(report.totalCheckouts, 82)
        XCTAssertEqual(report.previousTotalCheckouts, 22)
        XCTAssertEqual(report.overdueCheckouts, 0)
        XCTAssertEqual(report.dailyTrend?.count, 3)
        XCTAssertEqual(report.dailyTrend?.last?.date, "2026-07-13")
        XCTAssertEqual(report.dailyTrend?.last?.count, 2)
    }

    func testCheckoutReportToleratesMissingPriorWindow() throws {
        // An all-time or first-ever window omits the comparison; the card just
        // drops its delta rather than failing to decode.
        let json = """
        { "days": 30, "totalCheckouts": 5, "overdueCheckouts": 1, "dailyTrend": [] }
        """
        let report = try JSONDecoder().decode(CheckoutActivityReport.self, from: Data(json.utf8))

        XCTAssertNil(report.previousTotalCheckouts)
        XCTAssertEqual(report.totalCheckouts, 5)
    }

    // MARK: Trend points

    func testTrendPointsParseServerDaysAsUTC() throws {
        let report = try JSONDecoder().decode(CheckoutActivityReport.self, from: Data(checkoutJSON.utf8))
        let points = ReportTrendPoint.build(from: try XCTUnwrap(report.dailyTrend))

        XCTAssertEqual(points.count, 3)

        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        XCTAssertEqual(utc.component(.year, from: points[0].day), 2026)
        XCTAssertEqual(utc.component(.month, from: points[0].day), 7)
        XCTAssertEqual(utc.component(.day, from: points[0].day), 11)
    }

    func testTrendPointsSkipMalformedDaysInsteadOfCrashing() {
        let points = ReportTrendPoint.build(from: [
            CheckoutTrendPoint(date: "2026-07-13", count: 2),
            CheckoutTrendPoint(date: "not-a-date", count: 9),
            CheckoutTrendPoint(date: "2026-07", count: 4),
        ])

        XCTAssertEqual(points.count, 1)
        XCTAssertEqual(points.first?.count, 2)
    }

    func testNearestTrendPointResolvesChartSelection() throws {
        let report = try JSONDecoder().decode(CheckoutActivityReport.self, from: Data(checkoutJSON.utf8))
        let points = ReportTrendPoint.build(from: try XCTUnwrap(report.dailyTrend))

        // chartXSelection reports a position on a continuous axis, not one of
        // the plotted days, so a mid-afternoon touch must snap to its day.
        let midday = try XCTUnwrap(ReportTrendPoint.parseDay("2026-07-13")).addingTimeInterval(14 * 3600)
        XCTAssertEqual(ReportTrendPoint.nearest(to: midday, in: points)?.count, 2)

        let beforeRange = try XCTUnwrap(ReportTrendPoint.parseDay("2026-01-01"))
        XCTAssertEqual(ReportTrendPoint.nearest(to: beforeRange, in: points)?.day,
                       ReportTrendPoint.parseDay("2026-07-11"))
    }

    func testNearestReturnsNilForAnEmptySeries() {
        XCTAssertNil(ReportTrendPoint.nearest(to: Date(), in: []))
    }
}
