import SwiftUI

@MainActor
@Observable
final class NotificationsViewModel {
    var notifications: [AppNotification] = []
    var unreadCount = 0
    var total = 0
    var isLoading = false
    var error: String?
    private let pageSize = 20

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let resp = try await APIClient.shared.notifications(limit: pageSize, offset: 0)
            notifications = resp.data
            total = resp.total
            unreadCount = resp.unreadCount
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMore() async {
        guard !isLoading, notifications.count < total else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let resp = try await APIClient.shared.notifications(limit: pageSize, offset: notifications.count)
            notifications.append(contentsOf: resp.data)
        } catch {}
    }

    func markRead(id: String) async {
        guard let idx = notifications.firstIndex(where: { $0.id == id }),
              notifications[idx].isUnread else { return }
        notifications[idx] = notifications[idx].asRead
        if unreadCount > 0 { unreadCount -= 1 }
        try? await APIClient.shared.markNotificationRead(id: id)
    }

    func markAllRead() async {
        notifications = notifications.map { $0.asRead }
        unreadCount = 0
        try? await APIClient.shared.markAllNotificationsRead()
    }
}

private extension AppNotification {
    var asRead: AppNotification {
        AppNotification(id: id, type: type, title: title, body: body,
                        readAt: readAt ?? Date(), createdAt: createdAt, payload: payload)
    }
}

struct NotificationsSheet: View {
    @State private var vm = NotificationsViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.notifications.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = vm.error, vm.notifications.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else if vm.notifications.isEmpty {
                    ContentUnavailableView(
                        "All caught up",
                        systemImage: "bell.slash",
                        description: Text("No notifications to show.")
                    )
                } else {
                    notificationList
                }
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if vm.unreadCount > 0 {
                        Button("Mark All Read") {
                            Task { await vm.markAllRead() }
                        }
                        .font(.subheadline)
                    }
                }
            }
        }
        .task { await vm.load() }
    }

    private var notificationList: some View {
        List {
            ForEach(groupedSections, id: \.0) { section, items in
                Section(section) {
                    ForEach(items) { notif in
                        NotificationRow(notification: notif)
                            .swipeActions(edge: .leading) {
                                if notif.isUnread {
                                    Button {
                                        Task { await vm.markRead(id: notif.id) }
                                    } label: {
                                        Label("Mark Read", systemImage: "checkmark")
                                    }
                                    .tint(.accentColor)
                                }
                            }
                    }
                }
            }
            if vm.notifications.count < vm.total {
                Section {
                    Button("Load More") {
                        Task { await vm.loadMore() }
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .foregroundStyle(Color.accentColor)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await vm.load() }
    }

    private var groupedSections: [(String, [AppNotification])] {
        let cal = Calendar.current
        let now = Date()
        var today: [AppNotification] = []
        var yesterday: [AppNotification] = []
        var thisWeek: [AppNotification] = []
        var older: [AppNotification] = []

        for n in vm.notifications {
            if cal.isDateInToday(n.createdAt) {
                today.append(n)
            } else if cal.isDateInYesterday(n.createdAt) {
                yesterday.append(n)
            } else if let daysAgo = cal.dateComponents([.day], from: n.createdAt, to: now).day, daysAgo < 7 {
                thisWeek.append(n)
            } else {
                older.append(n)
            }
        }

        return [
            ("Today", today),
            ("Yesterday", yesterday),
            ("This Week", thisWeek),
            ("Older", older),
        ].filter { !$0.1.isEmpty }
    }
}

private struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(notification.isUnread ? Color.accentColor.opacity(0.12) : Color(.systemGray6))
                    .frame(width: 36, height: 36)
                Image(systemName: notification.type.notifIcon)
                    .font(.system(size: 15))
                    .foregroundStyle(notification.isUnread ? Color.accentColor : .secondary)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(notification.title)
                    .font(.subheadline.weight(notification.isUnread ? .semibold : .regular))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                if let body = notification.body {
                    Text(body)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Text(notification.createdAt.relativeLabel)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            if notification.isUnread {
                Spacer()
                Circle()
                    .fill(Color.accentColor)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
            }
        }
        .padding(.vertical, 2)
    }
}

private extension String {
    var notifIcon: String {
        if hasPrefix("checkout_due") || hasPrefix("checkout_overdue") { return "clock.badge.exclamationmark" }
        if hasPrefix("checkin_item_damaged") { return "exclamationmark.triangle" }
        if hasPrefix("checkin_item_lost") { return "questionmark.circle" }
        if hasPrefix("trade_") { return "arrow.triangle.2.circlepath" }
        if hasPrefix("shift_gear_up") { return "bag.badge.plus" }
        if hasPrefix("low_stock") { return "cube.box" }
        return "bell"
    }
}

private extension Date {
    var relativeLabel: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}
