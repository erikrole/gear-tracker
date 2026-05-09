import SwiftUI

/// Hashable wrapper so UsersView can push to UserDetailView without colliding
/// with UserDetailView's own `String`-typed navigationDestination (which
/// routes booking IDs to BookingDetailView).
struct UserRouteId: Hashable {
    let id: String
}

@MainActor
@Observable
final class UsersViewModel {
    var users: [AppUser] = []
    var isLoading = false
    var error: String?
    var pageError: String?
    var searchText = ""
    var selectedRole: String? = nil // "ADMIN" | "STAFF" | "STUDENT" | nil
    var includeInactive = false
    var hasMore = true

    private var offset = 0
    private let limit = 50
    private var searchTask: Task<Void, Never>?
    private var loadTask: Task<Void, Never>?

    func load(reset: Bool = false) async {
        if reset {
            loadTask?.cancel()
        } else if isLoading {
            return
        }
        let task = Task { await performLoad(reset: reset) }
        loadTask = task
        await task.value
    }

    private func performLoad(reset: Bool) async {
        if reset {
            offset = 0
            hasMore = true
            pageError = nil
        }
        isLoading = true
        if reset { error = nil }
        do {
            let result = try await APIClient.shared.users(
                search: searchText.isEmpty ? nil : searchText,
                role: selectedRole,
                includeInactive: includeInactive,
                limit: limit,
                offset: offset
            )
            if Task.isCancelled { isLoading = false; return }
            if reset { users = result.data } else { users += result.data }
            offset += result.data.count
            hasMore = offset < result.total
            pageError = nil
        } catch is CancellationError {
            // Superseded by a newer load.
        } catch {
            if reset {
                self.error = error.localizedDescription
            } else {
                self.pageError = error.localizedDescription
                hasMore = false
            }
        }
        isLoading = false
    }

    func retryPage() async {
        pageError = nil
        hasMore = true
        await load()
    }

    func onSearchChange() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            await load(reset: true)
        }
    }
}

struct UsersView: View {
    @State private var vm = UsersViewModel()

    var body: some View {
        // Apple's recommended pattern for binding to an @Observable model:
        // shadow `vm` with a @Bindable wrapper for the duration of body so
        // the dynamic-member subscript resolves cleanly.
        @Bindable var vm = vm
        return NavigationStack {
            content
                .navigationTitle("Users")
                .searchable(text: $vm.searchText, prompt: "Search by name or email…")
                .onChange(of: vm.searchText) { vm.onSearchChange() }
                .onChange(of: vm.selectedRole) { Task { await vm.load(reset: true) } }
                .onChange(of: vm.includeInactive) { Task { await vm.load(reset: true) } }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        filterMenu
                    }
                }
                .refreshable { await vm.load(reset: true) }
                .task {
                    if vm.users.isEmpty && vm.error == nil {
                        await vm.load(reset: true)
                    }
                }
                .navigationDestination(for: UserRouteId.self) { route in
                    UserDetailView(userId: route.id)
                }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let error = vm.error, vm.users.isEmpty {
            ContentUnavailableView {
                Label("Couldn't load users", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Retry") { Task { await vm.load(reset: true) } }
                    .buttonStyle(.borderedProminent)
            }
        } else if vm.users.isEmpty && vm.isLoading {
            List {
                ForEach(0..<10, id: \.self) { _ in
                    UserRowSkeleton().listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
            .allowsHitTesting(false)
        } else if vm.users.isEmpty {
            ContentUnavailableView(
                "No users",
                systemImage: "person.2",
                description: Text(vm.searchText.isEmpty
                    ? (hasFilter ? "No users match these filters." : "No users yet.")
                    : "No results for \"\(vm.searchText)\".")
            )
        } else {
            List {
                ForEach(vm.users) { user in
                    NavigationLink(value: UserRouteId(id: user.id)) {
                        UserListRow(user: user)
                    }
                }
                if let pageError = vm.pageError {
                    VStack(spacing: 8) {
                        Text(pageError)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") { Task { await vm.retryPage() } }
                            .buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .listRowSeparator(.hidden)
                } else if vm.hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .listRowSeparator(.hidden)
                        .task(id: vm.users.count) { await vm.load() }
                } else if vm.users.count > 10 {
                    Text("End of list")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 12)
                        .listRowSeparator(.hidden)
                }
            }
            .listStyle(.plain)
        }
    }

    private var hasFilter: Bool {
        vm.selectedRole != nil || vm.includeInactive
    }

    private var filterMenu: some View {
        Menu {
            // Picker inside Menu renders the checkmark for the selected tag
            // automatically — no `systemImage: cond ? "checkmark" : ""` hack
            // (which logs "No symbol named ''" warnings every render).
            Picker("Role", selection: $vm.selectedRole) {
                Text("All roles").tag(String?.none)
                ForEach(["ADMIN", "STAFF", "STUDENT"], id: \.self) { role in
                    Text(role.capitalized).tag(String?.some(role))
                }
            }

            Section {
                Button {
                    vm.includeInactive.toggle()
                } label: {
                    Label(
                        vm.includeInactive ? "Hide inactive" : "Show inactive",
                        systemImage: vm.includeInactive ? "eye.slash" : "eye"
                    )
                }
                .accessibilityLabel(vm.includeInactive ? "Hide inactive users" : "Show inactive users")
            }
        } label: {
            Image(systemName: hasFilter ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                .frame(minWidth: 44, minHeight: 44)
        }
        .accessibilityLabel("Filter users")
    }
}

// MARK: - Row

private struct UserListRow: View {
    let user: AppUser

    var body: some View {
        HStack(spacing: 12) {
            UserAvatarSmall(name: user.name, avatarUrl: user.avatarUrl)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(user.name)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    if user.active == false {
                        StatusPill(label: "Inactive", tone: .gray)
                    }
                }
                Text(user.email)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let secondary = secondaryLine {
                    Text(secondary)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            StatusPill.role(user.role)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [user.name, user.role.capitalized]
        if user.active == false { parts.append("Inactive") }
        if let secondary = secondaryLine { parts.append(secondary) }
        return parts.joined(separator: ", ")
    }

    private var secondaryLine: String? {
        var parts: [String] = []
        if let title = titleOrYear { parts.append(title) }
        if let loc = user.location, !loc.isEmpty { parts.append(loc) }
        if let area = user.primaryArea, !area.isEmpty { parts.append(area.capitalized) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var titleOrYear: String? {
        if user.role == "STUDENT" {
            return Self.studentYearLabel(gradYear: user.gradYear, override: user.studentYearOverride)
        }
        if let t = user.title, !t.isEmpty { return t }
        return nil
    }

    static func studentYearLabel(gradYear: Int?, override: String?) -> String? {
        if let override, let label = labelFor(year: override) { return label }
        guard let gradYear else { return nil }
        let now = Date()
        let cal = Calendar.current
        let month = cal.component(.month, from: now)
        let year = cal.component(.year, from: now)
        let acadYearEnd = month >= 8 ? year + 1 : year
        let yearsRemaining = gradYear - acadYearEnd
        switch yearsRemaining {
        case ...(-1): return "Grad"
        case 0: return "Senior"
        case 1: return "Junior"
        case 2: return "Sophomore"
        case 3...: return "Freshman"
        default: return nil
        }
    }

    private static func labelFor(year: String) -> String? {
        switch year {
        case "FRESHMAN": return "Freshman"
        case "SOPHOMORE": return "Sophomore"
        case "JUNIOR": return "Junior"
        case "SENIOR": return "Senior"
        case "GRAD": return "Grad"
        default: return nil
        }
    }
}

private struct UserAvatarSmall: View {
    let name: String
    let avatarUrl: String?
    var size: CGFloat = 36

    var body: some View {
        let initials = Self.initials(from: name)
        if let urlString = avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    initialsCircle(initials)
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        } else {
            initialsCircle(initials)
        }
    }

    @ViewBuilder
    private func initialsCircle(_ initials: String) -> some View {
        ZStack {
            Circle()
                .fill(Color.accentColor.opacity(0.12))
                .frame(width: size, height: size)
            Text(initials.isEmpty ? "?" : initials)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tint)
        }
    }

    private static func initials(from name: String) -> String {
        name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

private struct UserRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.secondary.opacity(0.15))
                .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.secondary.opacity(0.15))
                    .frame(width: 140, height: 11)
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.secondary.opacity(0.10))
                    .frame(width: 200, height: 9)
            }
            Spacer()
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.secondary.opacity(0.12))
                .frame(width: 50, height: 16)
        }
        .padding(.vertical, 4)
        .redacted(reason: .placeholder)
    }
}
