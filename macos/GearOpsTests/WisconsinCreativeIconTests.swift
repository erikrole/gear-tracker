import AppKit
import SwiftUI
import XCTest
@testable import GearOps

final class WisconsinCreativeIconTests: XCTestCase {
    /// Regression guard for the popover and notification identity: the host app
    /// bundle must actually carry compiled icon resources. When this fails, the
    /// build produced a bundle with no `AppIcon`, which is what makes macOS fall
    /// back to the generic application placeholder.
    func testHostBundleShipsTheCompiledAppIcon() throws {
        let icon = try XCTUnwrap(
            WisconsinCreativeIconSource.resolveBundledIcon(),
            "The built app bundle is missing its compiled AppIcon resources."
        )

        XCTAssertFalse(icon.representations.isEmpty)
        XCTAssertGreaterThanOrEqual(icon.size.width, 64)
        XCTAssertGreaterThanOrEqual(icon.size.height, 64)
    }

    /// Absence must be reported as `nil` so the view can substitute the Block W
    /// mark. `NSApplication.applicationIconImage` and `NSWorkspace.icon(forFile:)`
    /// both return Apple's generic placeholder here instead, which is why
    /// neither is used for resolution.
    func testBundleWithoutIconResourcesResolvesToNil() throws {
        let root = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("GearOpsIconTest-\(UUID().uuidString)")
            .appendingPathComponent("Empty.bundle")
        let contents = root.appendingPathComponent("Contents")
        try FileManager.default.createDirectory(at: contents, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }

        let info: [String: Any] = ["CFBundleIdentifier": "com.erikrole.GearOpsIconTest"]
        try (info as NSDictionary).write(to: contents.appendingPathComponent("Info.plist"))

        let bundle = try XCTUnwrap(Bundle(url: root))
        XCTAssertNil(WisconsinCreativeIconSource.resolveBundledIcon(in: bundle))
    }

    func testBlockWMarkStaysInsideItsFrameAndKeepsSourceAspectRatio() {
        let rect = CGRect(x: 0, y: 0, width: 120, height: 120)
        let path = BlockWMark().path(in: rect)

        XCTAssertFalse(path.isEmpty)

        let bounds = path.boundingRect
        XCTAssertTrue(rect.insetBy(dx: -0.01, dy: -0.01).contains(bounds))
        XCTAssertEqual(bounds.width / bounds.height, 371.04 / 305.88, accuracy: 0.001)
    }

    func testBlockWMarkCentresWithinANonSquareFrame() {
        let rect = CGRect(x: 0, y: 0, width: 200, height: 100)
        let bounds = BlockWMark().path(in: rect).boundingRect

        XCTAssertEqual(bounds.midX, rect.midX, accuracy: 0.01)
        XCTAssertEqual(bounds.midY, rect.midY, accuracy: 0.01)
        XCTAssertLessThanOrEqual(bounds.height, rect.height + 0.01)
    }
}
