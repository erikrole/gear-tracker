import SwiftUI

// MARK: - Reusable avatar

struct AccountAvatar: View {
    @Environment(SessionStore.self) private var session
    let size: CGFloat

    var body: some View {
        UserAvatarView(
            name: session.currentUser?.name ?? "",
            avatarUrl: session.currentUser?.avatarUrl,
            size: size,
            fallbackBackground: Color.accentColor.opacity(0.15),
            fallbackForeground: Color.accentColor,
            showsBorder: false
        )
    }
}
