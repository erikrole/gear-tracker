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
            AssetStatusBadge(status: asset.computedStatus)
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
            StatusBadge(status: booking.status)
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
                Text(user.name.searchInitials)
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

// MARK: - String helper (scoped to avoid conflicts)

extension String {
    var searchInitials: String {
        let parts = self.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased()
        }
        return String(self.prefix(2)).uppercased()
    }
}
