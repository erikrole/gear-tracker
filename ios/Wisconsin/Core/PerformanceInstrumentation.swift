import Foundation
import MetricKit
import os

enum AppRuntimeMode {
    enum PerformanceScenario: String {
        case launch
        case items
        case equipment
    }

    static var performanceScenario: PerformanceScenario? {
#if DEBUG
        guard let rawValue = ProcessInfo.processInfo.environment["GT_PERFORMANCE_SCENARIO"] else {
            return nil
        }
        return PerformanceScenario(rawValue: rawValue)
#else
        return nil
#endif
    }

    static var isPerformanceTesting: Bool {
        performanceScenario != nil
    }
}

enum AppPerformanceSignposts {
    private static let signposter = OSSignposter(
        subsystem: "com.erikrole.Wisconsin",
        category: "Performance"
    )

    static func begin(_ name: StaticString) -> OSSignpostIntervalState {
        signposter.beginInterval(name, id: signposter.makeSignpostID())
    }

    static func end(_ name: StaticString, _ state: OSSignpostIntervalState) {
        signposter.endInterval(name, state)
    }
}

/// Receives Apple's daily MetricKit reports and keeps a small, protected,
/// on-device diagnostic ring. Nothing is uploaded or added to normal logs.
/// Developers can retrieve the app container when a device exhibits a launch,
/// hang, CPU, memory, or disk regression that a local trace cannot reproduce.
final class AppMetricMonitor: NSObject, MXMetricManagerSubscriber, @unchecked Sendable {
    static let shared = AppMetricMonitor()

    private let lock = NSLock()
    private var started = false
    private let maximumStoredReports = 12
    private let logger = Logger(
        subsystem: "com.erikrole.Wisconsin",
        category: "MetricKit"
    )

    private override init() {
        super.init()
    }

    func start() {
        lock.lock()
        defer { lock.unlock() }
        guard !started else { return }
        started = true
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        persist(payloads.map { $0.jsonRepresentation() }, prefix: "metrics")
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        persist(payloads.map { $0.jsonRepresentation() }, prefix: "diagnostics")
    }

    private func persist(_ reports: [Data], prefix: String) {
        guard !reports.isEmpty else { return }
        lock.lock()
        defer { lock.unlock() }

        do {
            let directory = try reportDirectory()
            for report in reports {
                let filename = "\(prefix)-\(Int(Date.now.timeIntervalSince1970))-\(UUID().uuidString).json"
                let url = directory.appendingPathComponent(filename, isDirectory: false)
                try report.write(to: url, options: [.atomic])
                try FileManager.default.setAttributes(
                    [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                    ofItemAtPath: url.path
                )
            }
            try pruneReports(in: directory)
            logger.info("Stored \(reports.count, privacy: .public) local MetricKit report(s)")
        } catch {
            logger.error("Unable to store local MetricKit report: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func reportDirectory() throws -> URL {
        let manager = FileManager.default
        let applicationSupport = try manager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        var directory = applicationSupport.appendingPathComponent("PerformanceMetrics", isDirectory: true)
        try manager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        return directory
    }

    private func pruneReports(in directory: URL) throws {
        let manager = FileManager.default
        let reports = try manager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.creationDateKey],
            options: [.skipsHiddenFiles]
        )
        let ordered = try reports.sorted {
            let left = try $0.resourceValues(forKeys: [.creationDateKey]).creationDate ?? .distantPast
            let right = try $1.resourceValues(forKeys: [.creationDateKey]).creationDate ?? .distantPast
            return left > right
        }
        for staleReport in ordered.dropFirst(maximumStoredReports) {
            try manager.removeItem(at: staleReport)
        }
    }
}
