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
                if user.isAffiliatedCollaborator, let badge = user.affiliationBadge {
                    Text(badge)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.kioskRed)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Color.kioskRed.opacity(0.14), in: Capsule())
                }
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 92)
            .padding(.horizontal, 8)
            .padding(.vertical, 10)
            .kioskCard(KioskSurface.cardRaised, radius: KioskRadius.md, stroke: KioskStroke.strong)
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(user.isAffiliatedCollaborator ? "\(user.name), \(user.affiliationBadge ?? "collaborator")" : user.name)
        .accessibilityHint("Tap to start checkout for \(user.name)")
    }

    private var avatar: some View {
        KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 48)
    }
}

/// Compact roster row: 40pt avatar, name, optional affiliation badge.
///
/// Replaces the 112pt photo tile grid. At roster sizes past ~20 people the
/// tiles read as a wall of colourful avatars rather than a list of names, and
/// name-finding — the whole point of this fallback — got slower as the roster
/// grew. A row puts the name first and fits roughly twice as many people on
/// screen.
struct UserRow: View {
    let user: KioskUser
    let displayName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 32)

                VStack(alignment: .leading, spacing: 1) {
                    Text(displayName)
                        .font(KioskType.rowTitle)
                        .foregroundStyle(KioskText.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    if let badge = user.affiliationBadge, !badge.isEmpty {
                        Text(badge)
                            .font(KioskType.micro)
                            .foregroundStyle(Color.kioskRedGlyph)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 4)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 48)
            .kioskCard(KioskSurface.cardRaised, radius: KioskRadius.md, stroke: KioskStroke.hairline)
        }
        .buttonStyle(KioskPressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(displayName)
    }
}
