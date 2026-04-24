import SwiftUI

// MARK: - Asset row

struct AssetResultRow: View {
    let asset: Asset

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.accentColor.opacity(0.1))
                    .frame(width: 40, height: 40)
                Image(systemName: "camera.aperture")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.accentColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(asset.displayName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    if let tag = asset.assetTag {
                        Text(tag)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if asset.assetTag != nil {
                        Text("·").font(.caption).foregroundStyle(.tertiary)
                    }
                    Text(asset.location.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            StatusBadge(label: asset.computedStatus.label, color: asset.computedStatus.badgeColor)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Booking row

struct BookingResultRow: View {
    let booking: Booking

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(booking.kind == .checkout ? Color.green.opacity(0.1) : Color.blue.opacity(0.1))
                    .frame(width: 40, height: 40)
                Image(systemName: booking.kind == .checkout ? "arrow.up.circle" : "calendar")
                    .font(.system(size: 16))
                    .foregroundStyle(booking.kind == .checkout ? Color.green : Color.blue)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(booking.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(booking.requester.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            StatusBadge(label: booking.status.label, color: booking.status.badgeColor)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - User row

struct UserResultRow: View {
    let user: AppUser

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.purple.opacity(0.1))
                    .frame(width: 40, height: 40)
                Text(user.name.initials)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.purple)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(user.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(user.email)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(user.role.lowercased().capitalized)
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.quaternary, in: Capsule())
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Shared badge

private struct StatusBadge: View {
    let label: String
    let color: Color

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
    }
}

// MARK: - Extensions

private extension AssetComputedStatus {
    var badgeColor: Color {
        switch self {
        case .available: .green
        case .checkedOut: .orange
        case .reserved: .blue
        case .maintenance: .yellow
        case .retired: .gray
        case .unknown: .gray
        }
    }
}

private extension BookingStatus {
    var badgeColor: Color {
        switch self {
        case .open: .green
        case .booked: .blue
        case .pendingPickup: .orange
        case .draft: .gray
        case .completed: .secondary
        case .cancelled: .red
        case .unknown: .gray
        }
    }
}

private extension String {
    var initials: String {
        let parts = self.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased()
        }
        return String(self.prefix(2)).uppercased()
    }
}
