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
    /// userId → availability-conflict note (e.g. a class block overlapping the
    /// shift). A non-blocking warning — staff can still assign over it.
    @State private var conflicts: [String: String] = [:]
    @State private var conflictsLoading = false

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
                    List {
                        if conflictsLoading {
                            HStack(spacing: 6) {
                                ProgressView().controlSize(.mini)
                                Text("Checking availability…")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .listRowSeparator(.hidden)
                        }
                        ForEach(filteredUsers) { user in
                            Button { Task { await assign(userId: user.id) } } label: {
                                AssignRow(
                                    name: user.name,
                                    email: user.email,
                                    avatarUrl: user.avatarUrl,
                                    primaryArea: user.primaryArea,
                                    conflictNote: conflicts[user.id],
                                    isAssigning: assigningUserId == user.id,
                                    highlightArea: shiftArea
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(assigningUserId != nil)
                        }
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
        conflictsLoading = true
        // Users and availability conflicts load in parallel — the conflict map is
        // a non-blocking hint, so a failure there never blocks the picker.
        async let usersTask = APIClient.shared.users(search: nil, limit: 200)
        async let conflictsTask = APIClient.shared.shiftConflicts(shiftId: shiftId)
        do {
            let resp = try await usersTask
            users = resp.data
        } catch {
            loadError = error.localizedDescription
        }
        conflicts = await conflictsTask
        conflictsLoading = false
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
    var conflictNote: String? = nil
    let isAssigning: Bool
    let highlightArea: String

    private var isPrimaryAreaMatch: Bool {
        guard let primaryArea, !primaryArea.isEmpty else { return false }
        return primaryArea == highlightArea
    }

    var body: some View {
        HStack(spacing: 12) {
            UserAvatarView(
                name: name,
                avatarUrl: avatarUrl,
                size: 32,
                fallbackBackground: Color(.systemGray5),
                fallbackForeground: Color.secondary,
                borderColor: .clear,
                borderWidth: 0
            )
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(name)
                        .font(.subheadline.weight(.medium))
                    if conflictNote != nil {
                        StatusPill(label: "Conflict", tone: .orange)
                    }
                }
                Text(email)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let conflictNote {
                    Text(conflictNote)
                        .font(.caption2)
                        .foregroundStyle(Color.statusText(.orange))
                        .lineLimit(2)
                }
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
        if let conflictNote { parts.append(conflictNote) }
        if isAssigning { parts.append("Assigning") }
        return parts.joined(separator: ", ")
    }
}
