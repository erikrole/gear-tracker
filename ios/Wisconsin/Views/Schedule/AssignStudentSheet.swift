import SwiftUI

/// Lets STAFF/ADMIN pick a student from the event's sport roster (or any user
/// if the event has no sportCode) and direct-assign them to an open shift.
struct AssignStudentSheet: View {
    let shiftId: String
    let shiftArea: String
    let sportCode: String?
    let onAssigned: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var roster: [RosterEntry] = []
    @State private var fallbackUsers: [AppUser] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var search = ""
    @State private var assigningUserId: String?
    @State private var assignError: String?

    private var filteredRoster: [RosterEntry] {
        guard !search.isEmpty else { return roster }
        return roster.filter { $0.user.name.localizedCaseInsensitiveContains(search) }
    }

    private var filteredFallback: [AppUser] {
        guard !search.isEmpty else { return fallbackUsers }
        return fallbackUsers.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    private var usingFallback: Bool { sportCode == nil }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    ContentUnavailableView {
                        Label("Couldn't load roster", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(loadError)
                    } actions: {
                        Button("Retry") { Task { await load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if usingFallback {
                    fallbackList
                } else {
                    rosterList
                }
            }
            .navigationTitle("Assign \(shiftArea)")
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

    private var rosterList: some View {
        Group {
            if filteredRoster.isEmpty {
                ContentUnavailableView(
                    search.isEmpty ? "No one on the roster yet" : "No matches",
                    systemImage: "person.3",
                    description: Text(search.isEmpty
                        ? "Add students to the \(sportCode ?? "") roster from the web admin."
                        : "Try a different name.")
                )
            } else {
                List(filteredRoster) { entry in
                    Button { Task { await assign(userId: entry.user.id) } } label: {
                        AssignRow(
                            name: entry.user.name,
                            email: entry.user.email,
                            primaryArea: entry.user.primaryArea,
                            isAssigning: assigningUserId == entry.user.id,
                            highlightArea: shiftArea
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(assigningUserId != nil)
                }
            }
        }
    }

    private var fallbackList: some View {
        // Used when the event has no sportCode — search the global user list.
        Group {
            if filteredFallback.isEmpty && search.isEmpty {
                ContentUnavailableView(
                    "Search to find someone",
                    systemImage: "magnifyingglass",
                    description: Text("Type a name to look up users to assign.")
                )
            } else if filteredFallback.isEmpty {
                ContentUnavailableView("No matches", systemImage: "person.crop.circle.badge.questionmark")
            } else {
                List(filteredFallback) { user in
                    Button { Task { await assign(userId: user.id) } } label: {
                        AssignRow(
                            name: user.name,
                            email: user.email,
                            primaryArea: nil,
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

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            if let sportCode {
                roster = try await APIClient.shared.sportRoster(sportCode: sportCode)
            } else {
                let resp = try await APIClient.shared.users(search: nil, limit: 50)
                fallbackUsers = resp.data
            }
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
            Haptics.error()
        }
    }
}

private struct AssignRow: View {
    let name: String
    let email: String
    let primaryArea: String?
    let isAssigning: Bool
    let highlightArea: String

    var body: some View {
        HStack(spacing: 12) {
            initialsCircle
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.subheadline.weight(.medium))
                Text(email)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let primaryArea, !primaryArea.isEmpty {
                Text(primaryArea)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        primaryArea == highlightArea
                            ? Color.accentColor.opacity(0.18)
                            : Color(.systemGray5),
                        in: Capsule()
                    )
                    .foregroundStyle(primaryArea == highlightArea ? Color.accentColor : .secondary)
            }
            if isAssigning {
                ProgressView().scaleEffect(0.7)
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    private var initialsCircle: some View {
        let initials = name.split(separator: " ").prefix(2).compactMap { $0.first }.map { String($0) }.joined()
        return ZStack {
            Circle().fill(Color(.systemGray5)).frame(width: 32, height: 32)
            Text(initials.isEmpty ? "?" : initials)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}
