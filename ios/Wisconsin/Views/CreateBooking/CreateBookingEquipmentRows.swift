import SwiftUI

struct BookingAssetThumbnail: View {
    let imageUrl: String?
    var size: CGFloat = 44
    var cornerRadius: CGFloat = 8

    var body: some View {
        Group {
            if let urlString = imageUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    assetPlaceholder
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                .overlay(RoundedRectangle(cornerRadius: cornerRadius).strokeBorder(Color(.separator), lineWidth: 1))
            } else {
                assetPlaceholder
                    .frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
    }

    private var assetPlaceholder: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color(.systemGray5))
            .overlay(
                Image(systemName: "bag")
                    .foregroundStyle(Color(.systemGray2))
            )
    }
}

struct BookingBulkThumbnail: View {
    let imageUrl: String?
    var size: CGFloat = 44
    var cornerRadius: CGFloat = 10

    var body: some View {
        Group {
            if let urlString = imageUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    bulkPlaceholder
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                .overlay(RoundedRectangle(cornerRadius: cornerRadius).strokeBorder(Color(.separator), lineWidth: 1))
            } else {
                bulkPlaceholder
                    .frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
    }

    private var bulkPlaceholder: some View {
        Image(systemName: "shippingbox")
            .foregroundStyle(.secondary)
            .frame(width: size, height: size)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: cornerRadius))
    }
}

struct SelectedEquipmentRow: View {
    let asset: Asset
    let isConflicted: Bool
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            BookingAssetThumbnail(imageUrl: asset.imageUrl, size: 40, cornerRadius: 8)

            VStack(alignment: .leading, spacing: 3) {
                Text(asset.itemListPrimaryTitle)
                    .font(.gothamBold(size: 16))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let subtitle = asset.itemListSecondaryTitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Text(asset.location.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if isConflicted {
                    Label("Scheduling conflict", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2)
                        .foregroundStyle(Color.statusText(.orange))
                        .accessibilityLabel("Scheduling conflict")
                }
            }
            Spacer()
            Button {
                onRemove()
            } label: {
                Label("Remove", systemImage: "xmark.circle.fill")
                    .labelStyle(.titleAndIcon)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts: [String] = ["Selected", asset.itemListPrimaryTitle]
        if let subtitle = asset.itemListSecondaryTitle { parts.append(subtitle) }
        parts.append(asset.location.name)
        if isConflicted { parts.append("Scheduling conflict") }
        parts.append("Remove button")
        return parts.joined(separator: ", ")
    }
}

struct BulkQuantityRow: View {
    let sku: FormBulkSku
    let quantity: Int
    let onDecrement: () -> Void
    let onIncrement: () -> Void

    private var canIncrement: Bool { quantity < sku.availableQuantity }
    private var unitLabel: String {
        sku.unit?.isEmpty == false ? " \(sku.unit!)" : ""
    }
    private var subtitle: String {
        let pickup = sku.trackByNumber ? " · units scan at pickup" : ""
        return "\(sku.availableQuantity) available\(unitLabel)\(pickup)"
    }

    var body: some View {
        HStack(spacing: 12) {
            BookingBulkThumbnail(imageUrl: sku.imageUrl)

            VStack(alignment: .leading, spacing: 3) {
                Text(sku.name)
                    .font(.gothamBold(size: 16))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            HStack(spacing: 8) {
                Button(action: onDecrement) {
                    Image(systemName: "minus")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.bordered)
                .disabled(quantity == 0)
                .accessibilityLabel("Remove one \(sku.name)")

                Text("\(quantity)")
                    .font(.body.monospacedDigit())
                    .frame(minWidth: 24)
                    .accessibilityLabel("\(quantity) selected")

                Button(action: onIncrement) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.bordered)
                .disabled(!canIncrement)
                .accessibilityLabel("Add one \(sku.name)")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(sku.name), \(subtitle), \(quantity) selected")
    }

}

struct AssetPickerRow: View {
    let asset: Asset
    let isSelected: Bool
    var isConflicted: Bool = false
    let onTap: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                BookingAssetThumbnail(imageUrl: asset.imageUrl)

                VStack(alignment: .leading, spacing: 3) {
                    Text(asset.itemListPrimaryTitle)
                        .font(.gothamBold(size: 16))
                        .foregroundStyle(.primary)
                    HStack(spacing: 6) {
                        if let subtitle = asset.itemListSecondaryTitle {
                            Text(subtitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Text(asset.location.name)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if isConflicted {
                        Label("Scheduling conflict", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption2)
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityLabel("Scheduling conflict")
                    }
                }

                Spacer()

                // Plus (not an empty radio) because tapping adds to the cart;
                // tapping an added row removes it.
                Image(systemName: isSelected ? "checkmark.circle.fill" : "plus.circle")
                    .font(.title3)
                    .foregroundStyle(
                        isConflicted ? Color.statusText(.orange)
                            : (isSelected ? Color.statusText(.blue) : Color(.systemGray2))
                    )
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: isSelected)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(ScalePressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var rowAccessibilityLabel: String {
        var parts: [String] = [asset.itemListPrimaryTitle]
        if let subtitle = asset.itemListSecondaryTitle { parts.append(subtitle) }
        parts.append(asset.location.name)
        if isConflicted { parts.append("Scheduling conflict") }
        parts.append(isSelected ? "Selected" : "Not selected")
        return parts.joined(separator: ", ")
    }

}
