import SwiftUI

/// Circular user avatar with an initials fallback while the image loads
/// or when no photo is set. Shared by user lists, pickers, and form rows.
struct UserAvatarView: View {
    let name: String
    let avatarUrl: String?
    var size: CGFloat = 36

    var body: some View {
        if let urlString = avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    initialsCircle
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Color.primary.opacity(0.1), lineWidth: 0.5))
        } else {
            initialsCircle
        }
    }

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(Color.accentColor.opacity(0.12))
                .frame(width: size, height: size)
            Text(initials.isEmpty ? "?" : initials)
                .font(.system(size: max(size * 0.36, 9), weight: .semibold))
                .foregroundStyle(.tint)
        }
    }

    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}
