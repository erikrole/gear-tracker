import XCTest
@testable import Wisconsin

private actor TestSignal {
    private var isSignaled = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        if isSignaled { return }
        await withCheckedContinuation { continuation in
            waiters.append(continuation)
        }
    }

    func signal() {
        guard !isSignaled else { return }
        isSignaled = true
        let continuations = waiters
        waiters.removeAll()
        for continuation in continuations {
            continuation.resume()
        }
    }
}

final class LatestRequestGenerationTests: XCTestCase {
    func testNewestRequestOwnsStateWhenResponsesFinishOutOfOrder() {
        var generation = LatestRequestGeneration()
        let stale = generation.begin()
        let latest = generation.begin()
        var publishedValue: String?

        if generation.owns(latest) { publishedValue = "latest" }
        if generation.owns(stale) { publishedValue = "stale" }

        XCTAssertEqual(publishedValue, "latest")
    }

    func testInvalidationRevokesInFlightRequestOwnership() {
        var generation = LatestRequestGeneration()
        let inFlight = generation.begin()

        generation.invalidate()

        XCTAssertFalse(generation.owns(inFlight))
    }

    @MainActor
    func testAuthMutationQueuePreventsLogoutFromClearingANewerLoginCookie() async {
        let queue = AuthMutationQueue()
        let logoutStarted = TestSignal()
        let releaseLogout = TestSignal()
        var cookie: String? = "old"
        var loginStarted = false

        let logout = queue.enqueue {
            await logoutStarted.signal()
            await releaseLogout.wait()
            cookie = nil
        }
        await logoutStarted.wait()

        let login = queue.enqueue {
            loginStarted = true
            cookie = "new"
        }
        await Task.yield()

        XCTAssertFalse(loginStarted)
        XCTAssertEqual(cookie, "old")

        await releaseLogout.signal()
        await logout.value
        await login.value

        XCTAssertTrue(loginStarted)
        XCTAssertEqual(cookie, "new")
    }

    @MainActor
    func testCredentialQueueFinishesRegistrationBeforeLogoutRevocation() async {
        let queue = AuthMutationQueue()
        let registrationStarted = TestSignal()
        let releaseRegistration = TestSignal()
        var operations: [String] = []

        let registration = queue.enqueue {
            operations.append("register-start")
            await registrationStarted.signal()
            await releaseRegistration.wait()
            operations.append("register-finish")
        }
        await registrationStarted.wait()

        let revocation = queue.enqueue {
            operations.append("revoke")
        }
        await Task.yield()

        XCTAssertEqual(operations, ["register-start"])

        await releaseRegistration.signal()
        await registration.value
        await revocation.value

        XCTAssertEqual(operations, ["register-start", "register-finish", "revoke"])
    }

    @MainActor
    func testAuthSessionBoundaryRejectsAnOlderAccountsLateResponse() {
        let boundary = AuthSessionBoundary()
        let olderAccount = boundary.capture()

        boundary.advance()
        let currentAccount = boundary.capture()

        XCTAssertFalse(boundary.owns(olderAccount))
        XCTAssertTrue(boundary.owns(currentAccount))
    }
}
