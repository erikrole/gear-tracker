import SwiftUI

struct MenuBarContentView: View {
    let model: GearOpsModel

    @State private var measuredContentHeight: CGFloat = 320

    private let minimumContentHeight: CGFloat = 180
    private let maximumContentHeight: CGFloat = 500

    var body: some View {
        Group {
            if model.isRestoring, model.user == nil {
                restoringView
            } else if model.user == nil {
                GearOpsLoginView(model: model)
            } else {
                operationsView
            }
        }
    }

    private var restoringView: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Checking Gear Tracker…")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(width: 360, height: 180)
    }

    private var operationsView: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                TimelineView(.periodic(from: .now, by: 60)) { context in
                    VStack(alignment: .leading, spacing: 16) {
                        openBookingsList(at: context.date)
                        pendingPickupsList(at: context.date)
                        systemHealth(at: context.date)
                    }
                    .padding(16)
                    .onGeometryChange(for: CGFloat.self, of: { proxy in
                        ceil(proxy.size.height)
                    }) { newHeight in
                        measuredContentHeight = newHeight
                    }
                }
            }
            .frame(height: min(max(measuredContentHeight, minimumContentHeight), maximumContentHeight))
            Divider()
            footer
        }
        .frame(width: 380)
    }

    private var header: some View {
        HStack(spacing: 10) {
            WisconsinCreativeIcon(size: 30)
            VStack(alignment: .leading, spacing: 1) {
                Text("Wisconsin Creative")
                    .font(.headline)
                Text(openBookingCountLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                Task { await model.refresh(fromSource: true) }
            } label: {
                if model.isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                        .frame(width: 16, height: 16)
                } else {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderless)
            .disabled(model.isRefreshing)
            .help("Refresh Gear Tracker status")
            .accessibilityLabel("Refresh Gear Tracker status")
        }
        .padding(16)
    }

    private func openBookingsList(at now: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sectionTitle("Open bookings")
                Spacer()
                Button("View all") { model.openCheckouts() }
                    .buttonStyle(.link)
                    .font(.caption)
            }

            if model.openBookings.isEmpty {
                ContentUnavailableView(
                    "No open bookings",
                    systemImage: "checkmark.seal.fill",
                    description: Text(model.openBookingTotal == nil
                        ? "Refresh to load current checkouts."
                        : "All gear is accounted for.")
                )
                .frame(minHeight: 120)
            } else {
                if #available(macOS 26.0, *) {
                    GlassEffectContainer(spacing: 8) {
                        LazyVStack(spacing: 8) {
                            bookingRows(at: now)
                        }
                    }
                } else {
                    LazyVStack(spacing: 8) {
                        bookingRows(at: now)
                    }
                }
            }
        }
    }

    private func bookingRows(at now: Date) -> some View {
        ForEach(model.openBookings) { booking in
            OpenBookingRow(booking: booking, now: now) {
                model.openBooking(booking)
            }
        }
    }

    private var openBookingCountLabel: String {
        guard let count = model.openBookingTotal else { return model.healthLabel }
        return "\(count) open booking\(count == 1 ? "" : "s")"
    }

    @ViewBuilder
    private func pendingPickupsList(at now: Date) -> some View {
        let bookings = model.pendingPickupBookings(at: now)
        if !bookings.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    sectionTitle("Waiting for pickup")
                    Spacer()
                    Button("View all") { model.openPendingPickups() }
                        .buttonStyle(.link)
                        .font(.caption)
                }

                LazyVStack(spacing: 6) {
                    ForEach(bookings.prefix(3)) { booking in
                        PickupBookingRow(booking: booking, now: now) {
                            model.openBooking(id: booking.id)
                        }
                    }
                }

                if bookings.count > 3 {
                    Button("View \(bookings.count - 3) more") { model.openPendingPickups() }
                        .buttonStyle(.link)
                        .font(.caption)
                }
            }
        }
    }

    private func systemHealth(at now: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sectionTitle("System health")
                Spacer()
                Label(model.healthLabel, systemImage: model.healthSeverity.symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(healthColor)
            }
            HealthRow(
                title: "Companion data",
                detail: apiHealthDetail(at: now),
                severity: apiHealthSeverity
            )
            HealthRow(
                title: model.kioskAccess == .available ? "Kiosks" : "Kiosk access",
                detail: kioskAccessDetail,
                severity: kioskAccessSeverity
            )
            if let message = model.statusMessage {
                Label(message, systemImage: "info.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
            if model.kioskAccess == .available, !model.monitoredKioskDevices.isEmpty {
                Divider()
                ForEach(model.monitoredKioskDevices.prefix(4)) { device in
                    KioskRow(device: device, now: now)
                }
                if model.monitoredKioskDevices.count > 4 {
                    Button("View \(model.monitoredKioskDevices.count - 4) more kiosks") {
                        model.openKioskDevices()
                    }
                    .buttonStyle(.link)
                    .font(.caption)
                }
            }
        }
    }

    private var footer: some View {
        HStack {
            Button("Open Dashboard") { model.openDashboard() }
                .buttonStyle(.borderless)
            Spacer()
            Menu {
                if let user = model.user {
                    Text("Signed in as \(user.name)")
                }
                Button("Sign Out") {
                    Task { await model.signOut() }
                }
                Divider()
                Button("Quit Wisconsin Creative") { model.quit() }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .accessibilityLabel("Wisconsin Creative menu")
        }
        .padding(12)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
    }

    private var healthColor: Color {
        switch model.healthSeverity {
        case .healthy: .green
        case .attention: .orange
        case .critical: .red
        }
    }

    private var apiHealthSeverity: GearOpsHealthSeverity {
        if model.snapshot == nil { return .critical }
        if model.countDataIsPartial || model.statusMessage != nil { return .attention }
        return .healthy
    }

    private func apiHealthDetail(at now: Date) -> String {
        if model.countDataIsPartial { return "Fresh totals not confirmed" }
        if model.snapshot == nil { return "Unavailable" }
        return model.snapshot.map { "Last synced " + $0.freshnessLabel(at: now).replacingOccurrences(of: "Updated ", with: "") }
            ?? "Unavailable"
    }

    private var kioskAccessSeverity: GearOpsHealthSeverity {
        switch model.kioskAccess {
        case .available:
            if model.monitoredKioskDevices.contains(where: { $0.connectionState() == .offline }) { return .critical }
            if model.monitoredKioskDevices.contains(where: { $0.connectionState() == .stale }) { return .attention }
            return .healthy
        case .failed: return .attention
        case .restricted: return .attention
        case .unknown: return .healthy
        }
    }

    private var kioskAccessDetail: String {
        switch model.kioskAccess {
        case .unknown: "Not checked"
        case .restricted: "Restricted for this account"
        case .failed: "Could not refresh"
        case .available: model.kioskFleetCounts.summary
        }
    }
}

private struct PickupBookingRow: View {
    let booking: BookingActivitySnapshot
    let now: Date
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(.orange)
                    .frame(width: 3, height: 48)

                UserAvatarView(
                    name: booking.requester.name,
                    avatarUrl: booking.requester.avatarUrl
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(booking.title)
                        .font(.callout.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(pickupLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)
                    Text("\(booking.requester.name) · \(booking.location.name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .background(Color.primary.opacity(0.045), in: .rect(cornerRadius: 10))
        .accessibilityLabel("\(booking.title), waiting for pickup, \(booking.requester.name), \(booking.location.name)")
        .help("Opens this booking in Gear Tracker")
    }

    private var pickupLabel: String {
        let age = max(0, now.timeIntervalSince(booking.startsAt))
        if age < 60 { return "Waiting now" }
        if Calendar.current.isDateInToday(booking.startsAt) {
            return "Waiting since \(booking.startsAt.formatted(date: .omitted, time: .shortened))"
        }
        return "Waiting since \(booking.startsAt.formatted(.dateTime.month(.abbreviated).day().hour().minute()))"
    }
}

private struct OpenBookingRow: View {
    let booking: OpenBooking
    let now: Date
    let action: () -> Void

    @ViewBuilder
    var body: some View {
        if #available(macOS 26.0, *) {
            bookingButton
                .glassEffect(
                    booking.isOverdue(at: now)
                        ? .regular.tint(Color.red.opacity(0.12)).interactive()
                        : .regular.interactive(),
                    in: .rect(cornerRadius: 10)
                )
        } else {
            bookingButton
                .background(
                    booking.isOverdue(at: now)
                        ? Color.red.opacity(0.08)
                        : Color.primary.opacity(0.045),
                    in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(.secondary.opacity(0.25), lineWidth: 0.5)
                }
        }
    }

    private var bookingButton: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Capsule()
                    .fill(booking.isOverdue(at: now) ? Color.red : Color.blue)
                    .frame(width: 3, height: 42)
                UserAvatarView(
                    name: booking.requester.name,
                    avatarUrl: booking.requester.avatarUrl
                )
                VStack(alignment: .leading, spacing: 3) {
                    Text(booking.title)
                        .font(.headline)
                        .lineLimit(1)
                    Text(dueLabel(at: now))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(booking.isOverdue(at: now) ? .red : .blue)
                        .lineLimit(1)
                    Text(metadata)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel(at: now))
        .accessibilityHint("Opens this checkout in Gear Tracker")
    }

    private var metadata: String {
        var parts = [booking.requester.name, booking.location.name]
        if booking.itemCount > 0 {
            parts.append("\(booking.itemCount) item\(booking.itemCount == 1 ? "" : "s")")
        }
        return parts.joined(separator: " · ")
    }

    private func dueLabel(at now: Date) -> String {
        let calendar = Calendar.current
        let day: String
        if calendar.isDateInToday(booking.endsAt) {
            day = "today"
        } else if calendar.isDateInTomorrow(booking.endsAt) {
            day = "tomorrow"
        } else if calendar.isDateInYesterday(booking.endsAt) {
            day = "yesterday"
        } else {
            day = booking.endsAt.formatted(.dateTime.month(.abbreviated).day())
        }
        let time = booking.endsAt.formatted(date: .omitted, time: .shortened)
        return "Due \(day), \(time)"
    }

    private func accessibilityLabel(at now: Date) -> String {
        let prefix = booking.isOverdue(at: now) ? "Overdue, " : ""
        return "\(prefix)\(booking.title), \(booking.requester.name), \(booking.location.name), \(dueLabel(at: now))"
    }
}

private struct HealthRow: View {
    let title: String
    let detail: String
    let severity: GearOpsHealthSeverity

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: severity.symbol)
                .foregroundStyle(color)
            Text(title)
            Spacer()
            Text(detail)
                .foregroundStyle(.secondary)
        }
        .font(.callout)
        .accessibilityElement(children: .combine)
    }

    private var color: Color {
        switch severity {
        case .healthy: .green
        case .attention: .orange
        case .critical: .red
        }
    }
}

private struct KioskRow: View {
    let device: KioskDevice
    let now: Date

    private var state: KioskConnectionState { device.connectionState(at: now) }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "ipad")
                .frame(width: 22)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 1) {
                Text(device.name)
                    .lineLimit(1)
                Text(kioskDetail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(state.label)
                .font(.caption.weight(.medium))
                .foregroundStyle(stateColor)
        }
        .accessibilityElement(children: .combine)
        .help(buildHelp)
    }

    private var kioskDetail: String {
        if state == .online {
            return "\(device.location.name) · \(device.pendingPickupCount) pickup\(device.pendingPickupCount == 1 ? "" : "s") · \(device.openCheckoutCount) open"
        }
        guard let lastSeenAt = device.lastSeenAt else {
            return "\(device.location.name) · Never checked in"
        }
        return "\(device.location.name) · Last seen \(lastSeenAt.formatted(.relative(presentation: .named)))"
    }

    private var buildHelp: String {
        device.buildLabel.map { "Build \($0)" } ?? "Build unknown"
    }

    private var stateColor: Color {
        switch state {
        case .online: .green
        case .stale: .orange
        case .offline: .red
        case .inactive: .secondary
        }
    }
}
