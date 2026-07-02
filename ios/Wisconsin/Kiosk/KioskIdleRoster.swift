import SwiftUI

// MARK: - Idle roster pieces
//
// The tappable roster tile and the roster-label disambiguation helper.
// Extracted verbatim from KioskIdleView.swift (2026-07-02 rework Slice 5a).

/// First name when unique in the visible roster, "First L." when another
/// user shares the same first name. Prevents misclick attribution.
func disambiguatedLabels(for users: [KioskUser]) -> [String: String] {
    var firstNameCounts: [String: Int] = [:]
    for user in users {
        let first = user.name.components(separatedBy: " ").first ?? user.name
        firstNameCounts[first.lowercased(), default: 0] += 1
    }
    var result: [String: String] = [:]
    for user in users {
        let parts = user.name.components(separatedBy: " ").filter { !$0.isEmpty }
        let first = parts.first ?? user.name
        if firstNameCounts[first.lowercased(), default: 0] > 1, let last = parts.dropFirst().last,
           let lastInitial = last.first {
            result[user.id] = "\(first) \(lastInitial)."
        } else {
            result[user.id] = first
        }
    }
    return result
}

struct UserTile: View {
    let user: KioskUser
    let displayName: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 7) {
                avatar
                Text(displayName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(KioskText.primary)
                    .lineLimit(1)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.74)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 92)
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .kioskCard(KioskSurface.cardRaised, radius: KioskRadius.md, stroke: KioskStroke.strong)
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(user.name)
        .accessibilityHint("Tap to start checkout for \(user.name)")
    }

    private var avatar: some View {
        KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 48)
    }
}
