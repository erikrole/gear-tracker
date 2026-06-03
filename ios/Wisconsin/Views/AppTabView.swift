import SwiftUI
import UserNotifications

struct AppTabView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(NetworkMonitor.self) private var network
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var gearTabLabel: String {
        isStaffOrAdmin ? "Bookings" : "My Gear"
    }

    var body: some View {
        TabView(selection: Binding(
            get: { appState.selectedTab },
            set: { appState.selectTab($0) }
        )) {
            Tab("Home", systemImage: "house", value: 0) {
                HomeView()
            }

            Tab(gearTabLabel, systemImage: "calendar.badge.checkmark", value: 1) {
                BookingsView()
            }
            .badge(appState.overdueCount)
            .accessibilityLabel(appState.overdueCount > 0 ? "\(gearTabLabel), \(appState.overdueCount) overdue" : gearTabLabel)

            Tab("Items", systemImage: "archivebox", value: 2) {
                ItemsView()
            }

            Tab("Scan", systemImage: "barcode.viewfinder", value: 3, role: .search) {
                ScanView()
            }

            Tab("Schedule", systemImage: "calendar", value: 4) {
                ScheduleView()
            }
            .badge(appState.myShiftCount)
            .accessibilityLabel(appState.myShiftCount > 0 ? "Schedule, \(appState.myShiftCount) upcoming shifts" : "Schedule")

            if isStaffOrAdmin {
                Tab("Users", systemImage: "person.2", value: 5) {
                    UsersView()
                }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .safeAreaInset(edge: .top, spacing: 0) {
            if !network.isConnected {
                BannerView(
                    severity: .warning,
                    message: "No connection — some actions may fail",
                    systemImage: "wifi.slash"
                )
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .easeInOut, value: network.isConnected)
    }
}

// MARK: - Profile

struct ProfileView: View {
    @Environment(SessionStore.self) private var session
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSignOutConfirm = false
    @State private var showLinkStickerWizard = false
    @State private var showPushPrompt = false
    @State private var prefsVM = NotificationPrefsViewModel()
    @State private var pushAuth: UNAuthorizationStatus = .notDetermined
    @AppStorage("WisconsinThemeChoice") private var themeChoice: ThemeChoice = .system

    private static let manageAccountURL = URL(string: "https://gear.erikrole.com")!
    private static let iosSettingsURL = URL(string: UIApplication.openSettingsURLString)!

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    private var isStudent: Bool {
        (session.currentUser?.role ?? "") == "STUDENT"
    }

    var body: some View {
        NavigationStack {
            List {
                headerSection
                accountSection
                notificationsSection
                appearanceSection
                statsSection
                if isStudent { availabilitySection }
                if isStaffOrAdmin { toolsSection }
                appSection
                Section {
                    Button("Sign Out", role: .destructive) {
                        showSignOutConfirm = true
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showLinkStickerWizard) {
                LinkStickerWizard()
            }
            .sheet(isPresented: $showPushPrompt) {
                PushPrePromptView()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .navigationDestination(for: ProfileDestination.self) { dest in
                ProfileDestinationView(destination: dest)
            }
            .confirmationDialog(
                "Sign out?",
                isPresented: $showSignOutConfirm,
                titleVisibility: .visible
            ) {
                Button("Sign Out", role: .destructive) {
                    Task { await session.logout() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to sign in again to come back.")
            }
        }
        .task { await prefsVM.load() }
        .task { await refreshPushAuth() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await refreshPushAuth() }
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var headerSection: some View {
        Section {
            HStack(spacing: 14) {
                AccountAvatar(size: 52)
                VStack(alignment: .leading, spacing: 3) {
                    Text(session.currentUser?.name ?? "")
                        .font(.headline)
                    Text(session.currentUser?.email ?? "")
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private var accountSection: some View {
        Section("Account") {
            LabeledContent("Role", value: (session.currentUser?.role ?? "").capitalized)
            Link(destination: Self.manageAccountURL) {
                HStack {
                    Text("Manage account on web")
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    @ViewBuilder
    private var notificationsSection: some View {
        Section {
            // OS push permission state — always present so the user can see the truth.
            pushPermissionRow

            if prefsVM.loading && prefsVM.prefs == nil {
                HStack {
                    ProgressView().controlSize(.small)
                    Text("Loading preferences…")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                }
            } else if let prefs = prefsVM.prefs {
                if let until = prefsVM.pausedUntilDate {
                    pausedRow(until: until)
                } else {
                    pauseChipsRow
                }

                channelToggle(
                    title: "Email",
                    icon: "envelope",
                    description: "Send notifications to \(session.currentUser?.email ?? "your email").",
                    isOn: prefs.channels.email,
                    onChange: { v in Task { await prefsVM.setChannel(.email, value: v) } }
                )

                channelToggle(
                    title: "Push",
                    icon: "iphone.radiowaves.left.and.right",
                    description: "Send push notifications to this device.",
                    isOn: prefs.channels.push,
                    onChange: { v in Task { await prefsVM.setChannel(.push, value: v) } }
                )
            } else if let err = prefsVM.error {
                HStack {
                    Text(err)
                        .font(.subheadline)
                        .foregroundStyle(Color.statusText(.red))
                    Spacer()
                    Button("Retry") {
                        Task { await prefsVM.load() }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        } header: {
            Text("Notifications")
        } footer: {
            Text("In-app notifications always show in your inbox, regardless of these settings.")
        }
    }

    @ViewBuilder
    private var pushPermissionRow: some View {
        switch pushAuth {
        case .denied:
            Link(destination: Self.iosSettingsURL) {
                HStack(spacing: 12) {
                    Image(systemName: "bell.slash.fill")
                        .foregroundStyle(Color.statusText(.orange))
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Push disabled in iOS Settings")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                        Text("Tap to open Settings and re-enable.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(.tertiary)
                }
            }
            .accessibilityLabel("Push disabled in iOS Settings. Tap to open Settings.")
        case .notDetermined:
            Button {
                showPushPrompt = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "bell.badge")
                        .foregroundStyle(Color.brandPrimary)
                        .frame(width: 22)
                    Text("Turn on notifications")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                }
            }
        default:
            EmptyView()
        }
    }

    @ViewBuilder
    private var pauseChipsRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: "bell.slash")
                    .foregroundStyle(.secondary)
                Text("Quiet hours")
                    .font(.subheadline.weight(.medium))
            }
            HStack(spacing: 8) {
                pauseChip(label: "1 hour",  seconds: 3600)
                pauseChip(label: "1 day",   seconds: 86_400)
                pauseChip(label: "1 week",  seconds: 604_800)
            }
        }
        .padding(.vertical, 2)
    }

    private func pauseChip(label: String, seconds: TimeInterval) -> some View {
        Button {
            Task {
                await prefsVM.pause(for: seconds)
            }
        } label: {
            Text("Pause \(label)")
                .font(.footnote.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
        .disabled(prefsVM.saving)
    }

    @ViewBuilder
    private func pausedRow(until: Date) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "moon.zzz.fill")
                    .foregroundStyle(Color.statusText(.purple))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Paused")
                        .font(.subheadline.weight(.semibold))
                    Text("Until \(until.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                Spacer()
                Button("Resume") {
                    Task { await prefsVM.resume() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(prefsVM.saving)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Notifications paused until \(until.formatted(date: .abbreviated, time: .shortened)). Double-tap Resume to turn back on.")
    }

    @ViewBuilder
    private func channelToggle(
        title: String,
        icon: String,
        description: String,
        isOn: Bool,
        onChange: @escaping (Bool) -> Void
    ) -> some View {
        let binding = Binding(
            get: { isOn },
            set: { onChange($0) }
        )
        Toggle(isOn: binding) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.medium))
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .disabled(prefsVM.saving || prefsVM.isPaused)
    }

    @ViewBuilder
    private var appearanceSection: some View {
        Section {
            Picker(selection: $themeChoice) {
                ForEach(ThemeChoice.allCases) { choice in
                    Label(choice.label, systemImage: choice.systemImage)
                        .tag(choice)
                }
            } label: {
                Label("Theme", systemImage: "paintpalette")
            }
            .pickerStyle(.menu)
        } header: {
            Text("Appearance")
        } footer: {
            Text("Saved on this device only — set it again on your other devices.")
        }
    }

    @ViewBuilder
    private var statsSection: some View {
        Section("Stats") {
            NavigationLink(value: ProfileDestination.upcomingShifts) {
                LabeledContent("Upcoming Shifts") {
                    Text("\(appState.myShiftCount)")
                        .foregroundStyle(appState.myShiftCount > 0 ? .primary : .secondary)
                        .monospacedDigit()
                }
            }
            NavigationLink(value: ProfileDestination.overdueBookings) {
                LabeledContent("Overdue Bookings") {
                    Text("\(appState.overdueCount)")
                        .foregroundStyle(appState.overdueCount > 0 ? Color.statusText(.red) : .secondary)
                        .monospacedDigit()
                }
            }
        }
    }

    @ViewBuilder
    private var availabilitySection: some View {
        Section {
            NavigationLink(value: ProfileDestination.availability) {
                Label("My Availability", systemImage: "calendar.badge.clock")
            }
        } header: {
            Text("Schedule")
        } footer: {
            Text("Add the times you have class so staff don't schedule you then.")
        }
    }

    @ViewBuilder
    private var toolsSection: some View {
        Section("Tools") {
            Button {
                showLinkStickerWizard = true
            } label: {
                Label("Link Sticker Codes", systemImage: "qrcode.viewfinder")
            }
        }
    }

    @ViewBuilder
    private var appSection: some View {
        Section("App") {
            LabeledContent("Version", value: appVersion)
            Link(destination: Self.iosSettingsURL) {
                HStack {
                    Text("Open iOS Settings")
                    Spacer()
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(version) (\(build))"
    }

    private func refreshPushAuth() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushAuth = settings.authorizationStatus
    }
}

// MARK: - Profile destinations

enum ProfileDestination: Hashable {
    case upcomingShifts
    case overdueBookings
    case availability
}

private struct ProfileDestinationView: View {
    @Environment(SessionStore.self) private var session
    let destination: ProfileDestination

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "ADMIN" || role == "STAFF"
    }

    var body: some View {
        Group {
            if destination == .overdueBookings && isStaffOrAdmin {
                OverdueReportView()
            } else if destination == .availability {
                AvailabilityView(userId: session.currentUser?.id ?? "")
            } else {
                placeholder
            }
        }
    }

    private var placeholder: some View {
        VStack(spacing: 12) {
            Image(systemName: destination == .upcomingShifts ? "calendar" : "calendar.badge.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(destination == .upcomingShifts
                ? "Open the Schedule tab to see your shifts."
                : "Open the Bookings tab to see overdue items.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(destination == .upcomingShifts ? "My Shifts" : "Overdue")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Reusable avatar

struct AccountAvatar: View {
    @Environment(SessionStore.self) private var session
    let size: CGFloat

    var body: some View {
        let name = session.currentUser?.name ?? ""
        let parts = name.split(separator: " ")
        let initials = parts.prefix(2).compactMap { $0.first }.map { String($0) }.joined()
        let avatarUrl = session.currentUser?.avatarUrl.flatMap { URL(string: $0) }

        Group {
            if let url = avatarUrl {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        initialsCircle(initials)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                initialsCircle(initials)
            }
        }
    }

    @ViewBuilder
    private func initialsCircle(_ initials: String) -> some View {
        ZStack {
            Circle()
                .fill(.tint.opacity(0.15))
                .frame(width: size, height: size)
            Text(initials.isEmpty ? "?" : initials)
                .font(size > 40 ? .title3.weight(.semibold) : .footnote.weight(.semibold))
                .foregroundStyle(.tint)
        }
    }
}

// MARK: - Availability editor

private let availabilityDayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

/// Student self-service editor for recurring class-conflict blocks. Mirrors the
/// web profile Availability tab; these blocks drive the assign-picker conflict
/// warnings (see `AssignStudentSheet`).
struct AvailabilityView: View {
    let userId: String

    @State private var blocks: [AvailabilityBlock] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var showAdd = false

    private var grouped: [(day: Int, blocks: [AvailabilityBlock])] {
        Dictionary(grouping: blocks, by: \.dayOfWeek)
            .sorted { $0.key < $1.key }
            .map { (day: $0.key, blocks: $0.value.sorted { $0.startsAt < $1.startsAt }) }
    }

    var body: some View {
        Group {
            if isLoading && blocks.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error, blocks.isEmpty {
                ContentUnavailableView {
                    Label("Couldn't load availability", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderedProminent)
                }
            } else if blocks.isEmpty {
                ContentUnavailableView {
                    Label("No class conflicts added", systemImage: "calendar.badge.clock")
                } description: {
                    Text("Add the times you have class so staff don't schedule you then.")
                } actions: {
                    Button { showAdd = true } label: {
                        Label("Add a block", systemImage: "plus")
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                List {
                    ForEach(grouped, id: \.day) { group in
                        Section(availabilityDayNames[group.day]) {
                            ForEach(group.blocks) { block in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(block.startsAt)–\(block.endsAt)")
                                            .font(.body.monospacedDigit())
                                        if let label = block.label, !label.isEmpty {
                                            Text(label)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await delete(block) }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .accessibilityElement(children: .combine)
                                .accessibilityLabel(rowLabel(day: group.day, block: block))
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("My Availability")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add availability block")
            }
        }
        .task { await load() }
        .sheet(isPresented: $showAdd) {
            AddAvailabilitySheet(userId: userId) { Task { await load() } }
        }
    }

    private func rowLabel(day: Int, block: AvailabilityBlock) -> String {
        var parts = ["\(availabilityDayNames[day]) \(block.startsAt) to \(block.endsAt)"]
        if let label = block.label, !label.isEmpty { parts.append(label) }
        return parts.joined(separator: ", ")
    }

    private func load() async {
        isLoading = true
        error = nil
        do {
            blocks = try await APIClient.shared.availabilityBlocks(userId: userId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func delete(_ block: AvailabilityBlock) async {
        do {
            try await APIClient.shared.deleteAvailabilityBlock(userId: userId, blockId: block.id)
            blocks.removeAll { $0.id == block.id }
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
    }
}

private struct AddAvailabilitySheet: View {
    let userId: String
    let onAdded: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var dayOfWeek = 1
    @State private var start: Date
    @State private var end: Date
    @State private var label = ""
    @State private var isSaving = false
    @State private var error: String?

    init(userId: String, onAdded: @escaping () -> Void) {
        self.userId = userId
        self.onAdded = onAdded
        let cal = Calendar.current
        _start = State(initialValue: cal.date(bySettingHour: 9, minute: 0, second: 0, of: .now) ?? .now)
        _end = State(initialValue: cal.date(bySettingHour: 10, minute: 0, second: 0, of: .now) ?? .now)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Day") {
                    Picker("Day", selection: $dayOfWeek) {
                        ForEach(0..<7, id: \.self) { Text(availabilityDayNames[$0]).tag($0) }
                    }
                }
                Section("Time") {
                    DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute)
                    DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute)
                }
                Section {
                    TextField("Label (optional) — e.g. CHEM 101", text: $label)
                } footer: {
                    Text("Recurs every week. Staff see a conflict warning if a shift overlaps this.")
                }
                if let error {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(Color.statusText(.red))
                    }
                }
            }
            .navigationTitle("Add Availability")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Add").fontWeight(.semibold)
                        }
                    }
                    .disabled(isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func save() async {
        let startStr = Self.hhmm(start)
        let endStr = Self.hhmm(end)
        guard startStr < endStr else {
            error = "Start time must be before end time"
            Haptics.warning()
            return
        }
        isSaving = true
        error = nil
        let trimmed = label.trimmingCharacters(in: .whitespaces)
        do {
            _ = try await APIClient.shared.createAvailabilityBlock(
                userId: userId,
                dayOfWeek: dayOfWeek,
                startsAt: startStr,
                endsAt: endStr,
                label: trimmed.isEmpty ? nil : trimmed
            )
            Haptics.success()
            onAdded()
            dismiss()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }
        isSaving = false
    }

    private static func hhmm(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
}
