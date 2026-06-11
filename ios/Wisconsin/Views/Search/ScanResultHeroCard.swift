import SwiftUI

// MARK: - Single-match hero cards

/// Rich card shown in the scan result sheet when a scan resolves to exactly
/// one match. Multi-match scans keep the compact row list; this card is the
/// "scanned a sticker, got the thing" payoff: hero image, status badge,
/// prominent unit/tag number, availability, and custody info.

struct ScanAssetHeroCard: View {
    let asset: Asset
    var onViewItem: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ScanHeroImage(imageUrl: asset.imageUrl, placeholderIcon: "bag")

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(asset.name ?? asset.displayName)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2)
                    Spacer()
                    AssetStatusBadge(status: asset.computedStatus)
                }
                Text(metaLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            if let tag = asset.assetTag {
                ScanHeroIdentifier(label: "Asset tag", value: tag)
            }

            if let booking = asset.activeBooking {
                ScanHeroCustodyRow(
                    holder: booking.requesterName,
                    bookingTitle: booking.title,
                    dueAt: booking.endsAt,
                    isOverdue: booking.isOverdue
                )
            }

            Button(action: onViewItem) {
                Label("View item", systemImage: "arrow.right.circle.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(20)
    }

    private var metaLine: String {
        var parts: [String] = []
        if let cat = asset.category { parts.append(cat.name) }
        parts.append(asset.location.name)
        return parts.joined(separator: " · ")
    }
}

struct ScanFamilyHeroCard: View {
    let family: AssetFamilySearchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ScanHeroImage(imageUrl: family.imageUrl, placeholderIcon: "shippingbox")

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(family.name)
                        .font(.title3.weight(.semibold))
                        .lineLimit(2)
                    Spacer()
                    if let status = unitStatus {
                        AssetStatusBadge(status: status)
                    }
                }
                Text("\(family.category) · \(family.locationName)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            if let unitNumber = family.matchedUnitNumber {
                ScanHeroIdentifier(label: "Scanned unit", value: "#\(unitNumber)")
            }

            ScanHeroStatsRow(family: family)

            if let holder = family.matchedUnitHolder {
                ScanHeroCustodyRow(
                    holder: holder,
                    bookingTitle: family.matchedUnitBookingTitle,
                    dueAt: family.matchedUnitDueAt,
                    isOverdue: family.matchedUnitDueAt.map { $0 < .now } ?? false
                )
            }
        }
        .padding(20)
    }

    /// Unit statuses come over the wire as the same raw strings as asset
    /// computed statuses (AVAILABLE, CHECKED_OUT, ...), so the asset badge
    /// taxonomy applies directly.
    private var unitStatus: AssetComputedStatus? {
        family.matchedUnitStatus.map { AssetComputedStatus(rawValue: $0) ?? .unknown }
    }
}

// MARK: - Hero image

private struct ScanHeroImage: View {
    let imageUrl: String?
    let placeholderIcon: String

    var body: some View {
        ZStack {
            Color(.secondarySystemBackground)
            if let imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(height: 180)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 1)
        )
        .accessibilityHidden(true)
    }

    private var placeholder: some View {
        Image(systemName: placeholderIcon)
            .font(.system(size: 44))
            .foregroundStyle(Color(.systemGray3))
    }
}

// MARK: - Identifier (big unit/tag number)

private struct ScanHeroIdentifier: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(.title, design: .rounded).weight(.bold))
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Availability stats

private struct ScanHeroStatsRow: View {
    let family: AssetFamilySearchResult

    var body: some View {
        HStack(spacing: 10) {
            ScanHeroStatTile(
                value: family.availableQuantity,
                label: "Available",
                tone: .green
            )
            ScanHeroStatTile(
                value: family.checkedOutQuantity,
                label: "Checked out",
                tone: .blue
            )
            ScanHeroStatTile(
                value: family.onHandQuantity,
                label: family.trackByNumber ? "Units total" : "On hand",
                tone: nil
            )
        }
    }
}

private struct ScanHeroStatTile: View {
    let value: Int
    let label: String
    let tone: StatusTone?

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(.title2, design: .rounded).weight(.bold))
                .foregroundStyle(tone.map { Color.statusText($0) } ?? .primary)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(
            tone.map { Color.statusBackground($0) } ?? Color(.secondarySystemBackground),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(value) \(label.lowercased())")
    }
}

// MARK: - Custody (holder + due date)

private struct ScanHeroCustodyRow: View {
    let holder: String
    let bookingTitle: String?
    let dueAt: Date?
    let isOverdue: Bool

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.statusBackground(isOverdue ? .red : .blue))
                    .frame(width: 40, height: 40)
                Image(systemName: "person.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.statusText(isOverdue ? .red : .blue))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(holder)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                if let bookingTitle {
                    Text(bookingTitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            if let dueAt {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(isOverdue ? "Overdue" : "Due")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(isOverdue ? Color.statusText(.red) : .secondary)
                    Text(dueAt.formatted(.dateTime.month(.abbreviated).day().hour().minute()))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(isOverdue ? Color.statusText(.red) : .primary)
                }
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityElement(children: .combine)
    }
}
