import SwiftUI

struct UserDetailView: View {
    let userId: String

    @State private var detail: AppUserDetail?
    @State private var reservations: [Booking] = []
    @State private var checkouts: [Booking] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading && detail == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, detail == nil {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if let detail {
                ScrollView {
                    VStack(spacing: 16) {
                        profileHeader(detail)

                        if !checkouts.isEmpty {
                            FormCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Active Checkouts")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .textCase(.uppercase)
                                        .tracking(0.3)
                                    ForEach(checkouts) { booking in
                                        NavigationLink(value: booking.id) {
                                            BookingResultRow(booking: booking)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }

                        if !reservations.isEmpty {
                            FormCard {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Recent Reservations")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                        .textCase(.uppercase)
                                        .tracking(0.3)
                                    ForEach(reservations) { booking in
                                        NavigationLink(value: booking.id) {
                                            BookingResultRow(booking: booking)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }

                        if checkouts.isEmpty && reservations.isEmpty && !isLoading {
                            Text("No recent bookings")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .padding()
                        }
                    }
                    .padding()
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .navigationTitle(detail?.name ?? "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .navigationDestination(for: String.self) { bookingId in
            BookingDetailView(bookingId: bookingId)
        }
    }

    private func profileHeader(_ detail: AppUserDetail) -> some View {
        FormCard {
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color.purple.opacity(0.12))
                        .frame(width: 56, height: 56)
                    Text(detail.name.initials)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.purple)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(detail.name)
                        .font(.headline)
                    Text(detail.email)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        Text(detail.role.lowercased().capitalized)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.purple)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.purple.opacity(0.1), in: Capsule())
                        if let loc = detail.location {
                            Text(loc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer()
            }
        }
    }

    private func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let detailTask = APIClient.shared.user(id: userId)
            async let checkoutsTask = APIClient.shared.checkoutsByUser(userId: userId, limit: 5)
            async let reservationsTask = APIClient.shared.reservationsByUser(userId: userId, limit: 5)
            let (d, c, r) = try await (detailTask, checkoutsTask, reservationsTask)
            detail = d
            checkouts = c.data
            reservations = r.data
        } catch {
            self.error = error.localizedDescription
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
