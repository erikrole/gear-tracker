import SwiftUI

struct ItemDetailView: View {
    let assetId: String

    @State private var asset: AssetDetail?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && asset == nil {
                ItemDetailSkeleton()
            } else if let error, asset == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await loadAsset() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let asset {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        ItemHeroSection(asset: asset)
                        Divider()
                        ItemMetaSection(asset: asset)
                        if let booking = asset.activeBooking {
                            Divider()
                            ActiveBookingSection(booking: booking)
                        }
                        if !asset.upcomingReservations.isEmpty {
                            Divider()
                            UpcomingReservationsSection(reservations: asset.upcomingReservations)
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle(asset?.displayName ?? "Item")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadAsset() }
        .refreshable { await loadAsset() }
    }

    private func loadAsset() async {
        isLoading = true
        error = nil
        do {
            asset = try await APIClient.shared.asset(id: assetId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

private struct ItemHeroSection: View {
    let asset: AssetDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                AssetThumbnail(imageUrl: asset.imageUrl, size: 72)
                VStack(alignment: .leading, spacing: 4) {
                    Text(asset.displayName)
                        .font(.title3.bold())
                    if let tag = asset.assetTag {
                        Text(tag)
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    AssetStatusBadge(status: asset.computedStatus)
                }
                Spacer()
            }
        }
    }
}

private struct ItemMetaSection: View {
    let asset: AssetDetail

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Details")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            LabeledContent("Location", value: asset.location.name)
            if let cat = asset.category {
                LabeledContent("Category", value: cat.name)
            }
            if let dept = asset.department {
                LabeledContent("Department", value: dept.name)
            }
            if let serial = asset.serialNumber {
                LabeledContent("Serial", value: serial)
            }
            if let price = asset.purchasePrice.flatMap(Double.init) {
                LabeledContent("Purchase Price", value: price, format: .currency(code: "USD"))
            }
        }
    }
}

private struct ActiveBookingSection: View {
    let booking: AssetActiveBooking

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Currently Checked Out")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            NavigationLink(destination: BookingDetailView(bookingId: booking.id)) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(booking.title)
                            .font(.subheadline.weight(.medium))
                        Text(booking.requesterName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Due \(booking.endsAt.formatted(date: .abbreviated, time: .shortened))")
                            .font(.caption2)
                            .foregroundStyle(booking.isOverdue ? AnyShapeStyle(.red) : AnyShapeStyle(.tertiary))
                    }
                    Spacer()
                    if booking.isOverdue {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                    }
                    Image(systemName: "chevron.right")
                        .foregroundStyle(.tertiary)
                        .font(.caption)
                }
                .padding(12)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
    }
}

private struct UpcomingReservationsSection: View {
    let reservations: [UpcomingReservation]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Upcoming Reservations")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            ForEach(reservations) { res in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(res.title)
                            .font(.subheadline)
                            .lineLimit(1)
                        Text(res.requesterName)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(res.startsAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    Spacer()
                    StatusBadge(status: res.status)
                }
                .padding(10)
                .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
