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
                    Label("Couldn't load profile", systemImage: "exclamationmark.triangle")
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
        let tone = StatusTone.forRole(detail.role)
        return FormCard {
            HStack(alignment: .top, spacing: 16) {
                profileAvatar(detail, tone: tone)
                VStack(alignment: .leading, spacing: 4) {
                    Text(detail.name)
                        .font(.headline)
                    Text(detail.email)
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                    if let phone = detail.phone, !phone.isEmpty {
                        // Tap to call — `tel:` dispatches to the system dialer.
                        // Sanitized to digits + leading + only.
                        let sanitized = phone.filter { $0.isNumber || $0 == "+" }
                        if let url = URL(string: "tel:\(sanitized)") {
                            Link(destination: url) {
                                HStack(spacing: 4) {
                                    Image(systemName: "phone.fill")
                                        .font(.caption2)
                                        .accessibilityHidden(true)
                                    Text(phone)
                                        .font(.system(.caption, design: .monospaced))
                                }
                                .foregroundStyle(Color.statusText(.blue))
                            }
                            .accessibilityLabel("Call \(detail.name)")
                        } else {
                            Text(phone)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                    }
                    HStack(spacing: 6) {
                        StatusPill.role(detail.role)
                        if let loc = detail.location {
                            Text(loc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer()
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel(profileAccessibilityLabel(detail))
        }
    }

    @ViewBuilder
    private func profileAvatar(_ detail: AppUserDetail, tone: StatusTone) -> some View {
        let placeholder = ZStack {
            Circle()
                .fill(Color.statusBackground(tone))
                .frame(width: 56, height: 56)
            Text(detail.name.searchInitials)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.statusText(tone))
        }

        if let urlString = detail.avatarUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    placeholder
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(Circle())
        } else {
            placeholder
        }
    }

    private func profileAccessibilityLabel(_ detail: AppUserDetail) -> String {
        var parts: [String] = [detail.name, detail.role.capitalized]
        if let loc = detail.location, !loc.isEmpty { parts.append(loc) }
        return parts.joined(separator: ", ")
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

