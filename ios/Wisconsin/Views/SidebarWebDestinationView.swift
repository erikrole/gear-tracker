import SwiftUI

struct SidebarWebDestinationView: View {
    let title: String
    let systemImage: String
    let description: String
    let destination: URL
    var wrapsInNavigationStack = true

    var body: some View {
        if wrapsInNavigationStack {
            NavigationStack {
                content
            }
        } else {
            content
        }
    }

    private var content: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(description)
        } actions: {
            Link("Open on web", destination: destination)
                .buttonStyle(.borderedProminent)
        }
        .navigationTitle(title)
    }
}
