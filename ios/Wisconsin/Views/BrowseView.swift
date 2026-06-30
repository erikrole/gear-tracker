import SwiftUI

struct BrowseView: View {
    private let destinations: [BrowseDestination] = [
        .items,
        .guides,
        .licenses,
        .users,
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(destinations) { destination in
                        NavigationLink {
                            destinationView(for: destination)
                        } label: {
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
                } header: {
                    Text("Browse")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Browse")
        }
    }

    @ViewBuilder
    private func destinationView(for destination: BrowseDestination) -> some View {
        switch destination {
        case .items:
            ItemsView()
        case .guides:
            GuidesView(wrapsInNavigationStack: false)
        case .licenses:
            LicensesView(wrapsInNavigationStack: false)
        case .users:
            UsersView()
        }
    }
}

private enum BrowseDestination: String, CaseIterable, Identifiable {
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
            "Browse gear, item families, status, and availability."
        case .guides:
            "Read team reference docs, contacts, venue notes, and workflows."
        case .licenses:
            "Claim, copy, or return a Photo Mechanic license."
        case .users:
            "Find people, roles, contact details, and active status."
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
