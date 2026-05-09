import SwiftUI

/// Lets STAFF/ADMIN pick any user and direct-assign them to an open shift.
struct AssignStudentSheet: View {
    let shiftId: String
    let shiftArea: String
    let sportCode: String?
    let onAssigned: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var users: [AppUser] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var search = ""
    @State private var assigningUserId: String?
    @State private var assignError: String?

    private var filteredUsers: [AppUser] {
        guard !search.isEmpty else { return users }
        return users.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    ContentUnavailableView {
                        Label("Couldn't load users", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(loadError)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if filteredUsers.isEmpty {
                    ContentUnavailableView(
                        search.isEmpty ? "No users found" : "No matches",
                        systemImage: "person.2",
                        description: Text(search.isEmpty ? "No users available to assign." : "Try a different name.")
                    )
                } else {
                    List(filteredUsers) { user in
                        Button { Task { await assign(userId: user.id) } } label: {
                            AssignRow(
                                name: user.name,
                                email: user.email,
                                avatarUrl: user.avatarUrl,
                                primaryArea: user.primaryArea,
                                isAssigning: assigningUserId == user.id,
                                highlightArea: shiftArea
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(assigningUserId != nil)
                    }
                }
            }
            .navigationTitle("Assign \(shiftArea.shiftAreaLabel)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .searchable(text: $search, prompt: "Search by name")
            .alert(
                "Couldn't assign",
                isPresented: Binding(get: { assignError != nil }, set: { if !$0 { assignError = nil } })
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(assignError ?? "")
            }
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            let resp = try await APIClient.shared.users(search: nil, limit: 200)
            users = resp.data
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    private func assign(userId: String) async {
        assigningUserId = userId
        defer { assigningUserId = nil }
        do {
            try await APIClient.shared.assignShift(shiftId: shiftId, userId: userId)
            Haptics.success()
            onAssigned()
            dismiss()
        } catch {
            assignError = error.localizedDescription
            Haptics.warning()
        }
    }
}

private struct AssignRow: View {
    let name: String
    let email: String
    let avatarUrl: String?
    let primaryArea: String?
    let isAssigning: Bool
    let highlightArea: String

    private var isPrimaryAreaMatch: Bool {
        guard let primaryArea, !primaryArea.isEmpty else { return false }
        return primaryArea == highlightArea
    }

    var body: some View {
        HStack(spacing: 12) {
            avatar
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.subheadline.weight(.medium))
                Text(email)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            if let primaryArea, !primaryArea.isEmpty {
                Text(primaryArea.shiftAreaLabel)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        isPrimaryAreaMatch
                            ? Color.accentColor.opacity(0.18)
                            : Color(.systemGray5),
                        in: Capsule()
                    )
                    .foregroundStyle(isPrimaryAreaMatch ? Color.accentColor : .secondary)
                    .accessibilityHidden(true)  // Surfaced via combined row label below.
            }
            if isAssigning {
                ProgressView().scaleEffect(0.7)
                    .accessibilityLabel("Assigning")
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    @ViewBuilder
    private var avatar: some View {
        let placeholder = ZStack {
            Circle().fill(Color(.systemGray5)).frame(width: 32, height: 32)
            Text(initials.isEmpty ? "?" : initials)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }

        if let urlString = avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
            .frame(width: 32, height: 32)
            .clipShape(Circle())
        } else {
            placeholder
        }
    }

    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap { $0.first }.map { String($0) }.joined()
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [name, email]
        if let primaryArea, !primaryArea.isEmpty {
            let label = primaryArea.shiftAreaLabel
            if isPrimaryAreaMatch {
                parts.append("\(label) specialist (matches this shift)")
            } else {
                parts.append("\(label) specialist")
            }
        }
        if isAssigning { parts.append("Assigning") }
        return parts.joined(separator: ", ")
    }
}
