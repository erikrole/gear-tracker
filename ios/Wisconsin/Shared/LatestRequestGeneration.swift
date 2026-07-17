import Foundation

/// Grants mutation ownership to the newest asynchronous request.
///
/// Cancellation alone is not enough: URLSession errors can wrap cancellation,
/// and a superseded task can resume after its replacement has started. Callers
/// capture the token returned by `begin()` and check `owns(_:)` after every
/// suspension before publishing shared state.
struct LatestRequestGeneration {
    private var currentToken: UUID?

    mutating func begin() -> UUID {
        let token = UUID()
        currentToken = token
        return token
    }

    mutating func invalidate() {
        currentToken = nil
    }

    func owns(_ token: UUID) -> Bool {
        currentToken == token
    }
}

/// Serializes authentication operations that can replace or clear the shared
/// cookie jar. `enqueue(_:)` is synchronous, so a caller registers its place
/// before its first suspension and cannot be overtaken by a later mutation.
@MainActor
final class AuthMutationQueue {
    private var tail: (id: UUID, task: Task<Void, Never>)?

    @discardableResult
    func enqueue(
        _ operation: @escaping @MainActor () async -> Void
    ) -> Task<Void, Never> {
        let predecessor = tail?.task
        let id = UUID()
        let task = Task { @MainActor [weak self] in
            await predecessor?.value
            await operation()
            if self?.tail?.id == id {
                self?.tail = nil
            }
        }
        tail = (id, task)
        return task
    }
}
