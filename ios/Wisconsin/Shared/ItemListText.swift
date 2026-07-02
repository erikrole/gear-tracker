import Foundation

extension Optional where Wrapped == String {
    var nonBlankText: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}

extension String {
    var nonBlankText: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func isSameListText(as other: String) -> Bool {
        trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            == other.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
