import SwiftUI

// MARK: - Option Picker

struct OptionPickerView: View {
    let title: String
    let options: [(id: String, name: String)]
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    private var filtered: [(id: String, name: String)] {
        guard !search.isEmpty else { return options }
        return options.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        List {
            ForEach(filtered, id: \.id) { option in
                Button {
                    selection = option.id
                    Haptics.selection()
                    dismiss()
                } label: {
                    HStack {
                        Text(option.name)
                            .foregroundStyle(.primary)
                        Spacer()
                        if selection == option.id {
                            Image(systemName: "checkmark")
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.statusText(.blue))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == option.id ? .isSelected : [])
            }
            if filtered.isEmpty && !search.isEmpty {
                ContentUnavailableView.search(text: search)
                    .listRowBackground(Color.clear)
            }
        }
        .searchable(text: $search, prompt: "Search \(title.lowercased())")
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Requester Picker

/// Requester-specific picker: avatars, the signed-in user pinned to the top
/// with a "You" subtitle, search, and a checkmark on the current selection.
struct RequesterPickerView: View {
    let users: [FormUser]
    let currentUserId: String?
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    /// Signed-in user first, everyone else in server (alphabetical) order.
    private var ordered: [FormUser] {
        guard let me = currentUserId,
              let index = users.firstIndex(where: { $0.id == me }) else { return users }
        var copy = users
        let mine = copy.remove(at: index)
        copy.insert(mine, at: 0)
        return copy
    }

    private var filtered: [FormUser] {
        guard !search.isEmpty else { return ordered }
        return ordered.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    var body: some View {
        List {
            ForEach(filtered) { user in
                Button {
                    selection = user.id
                    Haptics.selection()
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        UserAvatarView(name: user.name, avatarUrl: user.avatarUrl, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.name)
                                .foregroundStyle(.primary)
                            if user.id == currentUserId {
                                Text("You")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if selection == user.id {
                            Image(systemName: "checkmark")
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.statusText(.blue))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(selection == user.id ? .isSelected : [])
            }
            if filtered.isEmpty && !search.isEmpty {
                ContentUnavailableView.search(text: search)
                    .listRowBackground(Color.clear)
            }
        }
        .searchable(text: $search, prompt: "Search requester")
        .navigationTitle("Requester")
        .navigationBarTitleDisplayMode(.inline)
    }
}
