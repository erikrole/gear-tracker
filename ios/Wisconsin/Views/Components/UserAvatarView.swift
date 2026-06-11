import SwiftUI

/// Circular user avatar with an initials fallback while the image loads
/// or when no photo is set. Shared by user lists, pickers, and form rows.
struct UserAvatarView: View {
    let name: String
    let avatarUrl: String?
    var size: CGFloat = 36
    var fallbackBackground: Color = Color.accentColor.opacity(0.12)
    var fallbackForeground: Color = Color.accentColor
    var borderColor: Color = Color.primary.opacity(0.1)
    var borderWidth: CGFloat = 0.5

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
            .overlay(Circle().strokeBorder(borderColor, lineWidth: borderWidth))
        } else {
            initialsCircle
        }
    }

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(fallbackBackground)
                .frame(width: size, height: size)
            Text(initials.isEmpty ? "?" : initials)
                .font(.system(size: max(size * 0.36, 9), weight: .semibold))
                .foregroundStyle(fallbackForeground)
        }
        .overlay(Circle().strokeBorder(borderColor, lineWidth: borderWidth))
    }

    private var initials: String {
        name.split(separator: " ").prefix(2).compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}
