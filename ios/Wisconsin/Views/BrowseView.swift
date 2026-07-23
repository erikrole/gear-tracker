import SwiftUI

struct BrowseView: View {
    @State private var navigationPath = NavigationPath()
    @Environment(AppState.self) private var appState
    @Environment(SessionStore.self) private var session

    private var destinations: [BrowseDestination] {
        guard session.currentUser?.role == "COLLABORATOR" else {
            return [.items, .guides, .licenses, .users]
        }
        let capabilities = Set(session.currentUser?.capabilities ?? [])
        return [
            capabilities.contains("GEAR_CATALOG_VIEW") ? .items : nil,
            capabilities.contains("PEOPLE_DIRECTORY_VIEW") ? .users : nil,
        ].compactMap { $0 }
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            List {
                Section {
                    ForEach(destinations) { destination in
                        NavigationLink(value: destination) {
                            SettingsMenuRow(
                                title: destination.title,
                                subtitle: destination.subtitle,
                                systemImage: destination.systemImage,
                                tint: destination.tint
                            ) {
                                EmptyView()
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Browse")
            .navigationDestination(for: BrowseDestination.self) { destination in
                destinationView(for: destination)
            }
            .onChange(of: appState.tabResetToken) { _, _ in
                guard appState.resetTab == 2 else { return }
                navigationPath = NavigationPath()
            }
            .onChange(of: appState.pendingBrowseDestination, initial: true) { _, _ in
                consumePendingBrowseDestination()
            }
        }
    }

    /// Lands a push that only carried an `href` (license expiry, firmware
    /// release) on the matching Browse row. Only follows destinations this user
    /// actually has, so the deep link can never outrun the visible menu.
    private func consumePendingBrowseDestination() {
        guard let pending = appState.pendingBrowseDestination else { return }
        let destination: BrowseDestination = switch pending {
        case .items: .items
        case .licenses: .licenses
        }
        guard destinations.contains(destination) else {
            appState.pendingBrowseDestination = nil
            return
        }
        appState.pendingBrowseDestination = nil
        navigationPath.append(destination)
    }

    @ViewBuilder
    private func destinationView(for destination: BrowseDestination) -> some View {
        switch destination {
        case .items:
            ItemsView(wrapsInNavigationStack: false)
        case .guides:
            GuidesView(wrapsInNavigationStack: false)
        case .licenses:
            LicensesView(wrapsInNavigationStack: false)
        case .users:
            UsersView(wrapsInNavigationStack: false)
        }
    }
}

private enum BrowseDestination: String, CaseIterable, Hashable, Identifiable {
    case items
    case guides
    case licenses
    case users

    var id: String { rawValue }

    var title: String {
        switch self {
        case .items: "Items"
        case .guides: "Guides"
        case .licenses: "Licenses"
        case .users: "Users"
        }
    }

    var subtitle: String {
        switch self {
        case .items:
            "Find gear, item families, status, and availability."
        case .guides:
            "Read team reference docs, contacts, venue notes, and workflows."
        case .licenses:
            "Claim, copy, or return a Photo Mechanic license."
        case .users:
            "Find teammates, roles, titles, and work areas."
        }
    }

    var systemImage: String {
        switch self {
        case .items: "archivebox"
        case .guides: "book.closed"
        case .licenses: "key"
        case .users: "person.2"
        }
    }

    var tint: Color {
        switch self {
        case .items: Color.statusText(.blue)
        case .guides: Color.statusText(.purple)
        case .licenses: Color.statusText(.orange)
        case .users: Color.statusText(.green)
        }
    }
}
