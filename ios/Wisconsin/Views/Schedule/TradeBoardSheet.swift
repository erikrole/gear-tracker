import SwiftUI

@MainActor
@Observable
final class TradeBoardViewModel {
    var trades: [ShiftTrade] = []
    var openWork = OpenWorkResponse(openShifts: [], pickupRequests: [])
    var total = 0
    var isLoading = false
    var error: String?
    var currentUserId: String = ""
    var currentUserRole: String = ""
    private let pageSize = 30

    var isStaff: Bool { currentUserRole == "ADMIN" || currentUserRole == "STAFF" }
    var staffReviewRequests: [OpenWorkPickupRequest] { isStaff ? openWork.pickupRequests : [] }
    var staffReviewTrades: [ShiftTrade] { isStaff ? trades.filter { $0.status == .claimed } : [] }
    var availableOpenShifts: [OpenWorkShift] { openWork.openShifts.filter { $0.action == "claim" } }
    var approvalRequiredShifts: [OpenWorkShift] { openWork.openShifts.filter { $0.action == "request" } }
    var waitingOpenShifts: [OpenWorkShift] { openWork.openShifts.filter { $0.action == "none" } }
    var availableTrades: [ShiftTrade] { trades.filter { !isStaff && $0.status == .open && $0.postedBy.id != currentUserId } }
    var myTrades: [ShiftTrade] { trades.filter { $0.postedBy.id == currentUserId && ($0.status == .open || $0.status == .claimed) } }
    var resolvedTrades: [ShiftTrade] { trades.filter { $0.status == .completed || $0.status == .cancelled } }
    var postedTrades: [ShiftTrade] {
        trades.filter { trade in
            !staffReviewTrades.contains(where: { $0.id == trade.id })
            && !availableTrades.contains(where: { $0.id == trade.id })
            && !myTrades.contains(where: { $0.id == trade.id })
            && !resolvedTrades.contains(where: { $0.id == trade.id })
        }
    }
    var visibleCount: Int {
        staffReviewRequests.count
        + staffReviewTrades.count
        + availableOpenShifts.count
        + availableTrades.count
        + approvalRequiredShifts.count
        + myTrades.count
        + waitingOpenShifts.count
        + postedTrades.count
        + resolvedTrades.count
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let tradeResp = APIClient.shared.shiftTrades(limit: pageSize)
            async let openWorkResp = APIClient.shared.scheduleOpenWork()
            let (tradesResult, openWorkResult) = try await (tradeResp, openWorkResp)
            trades = tradesResult.data
            total = tradesResult.total
            openWork = openWorkResult
        } catch {
            self.error = error.localizedDescription
        }
    }

    func pickup(id: String) async throws {
        try await APIClient.shared.pickupOpenShift(id: id)
        await load()
    }

    func claim(id: String) async throws {
        let updated = try await APIClient.shared.claimShiftTrade(id: id)
        if let idx = trades.firstIndex(where: { $0.id == id }) {
            trades[idx] = updated
        }
        await load()
    }

    func approveTrade(id: String) async throws {
        let updated = try await APIClient.shared.approveShiftTrade(id: id)
        if let idx = trades.firstIndex(where: { $0.id == id }) {
            trades[idx] = updated
        }
        await load()
    }

    func declineTrade(id: String) async throws {
        let updated = try await APIClient.shared.declineShiftTrade(id: id)
        if let idx = trades.firstIndex(where: { $0.id == id }) {
            trades[idx] = updated
        }
        await load()
    }

    func approveRequest(id: String) async throws {
        try await APIClient.shared.approveShift(assignmentId: id)
        await load()
    }

    func declineRequest(id: String) async throws {
        try await APIClient.shared.declineShift(assignmentId: id)
        await load()
    }

    func cancel(id: String) async throws {
        let updated = try await APIClient.shared.cancelShiftTrade(id: id)
        if let idx = trades.firstIndex(where: { $0.id == id }) {
            trades[idx] = updated
        }
        await load()
    }
}

struct TradeBoardSheet: View {
    let myShifts: [MyShift]
    let currentUserId: String
    var currentUserRole: String = ""
    var onTradePosted: ((String) -> Void)? = nil
    var onTradeClaimed: ((String, String) -> Void)? = nil

    @State private var vm = TradeBoardViewModel()
    @State private var showPostSheet = false
    @State private var tradeToConfirm: ShiftTrade?
    @State private var tradeToCancel: ShiftTrade?
    @State private var openShiftToPickup: OpenWorkShift?
    @State private var requestToApprove: OpenWorkPickupRequest?
    @State private var tradeToApprove: ShiftTrade?
    @State private var actionError: String?
    @State private var actionErrorHaptic = 0
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.visibleCount == 0 {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = vm.error, vm.visibleCount == 0 {
                    ContentUnavailableView {
                        Label("Couldn't load Open Work", systemImage: "exclamationmark.triangle")
                    } description: { Text(error) } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    tradeList
                }
            }
            .navigationTitle("Open Work")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .top) {
                if let actionError {
                    TradeBoardActionErrorBanner(
                        message: actionError,
                        onRefresh: {
                            self.actionError = nil
                            Task { await vm.load() }
                        },
                        onDismiss: { self.actionError = nil }
                    )
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showPostSheet = true
                    } label: {
                        Label("Post trade", systemImage: "plus")
                    }
                }
            }
            .task {
                vm.currentUserId = currentUserId
                vm.currentUserRole = currentUserRole
                await vm.load()
            }
            .refreshable { await vm.load() }
            .sheet(isPresented: $showPostSheet) {
                PostTradeSheet(myShifts: myShifts) { posted in
                    onTradePosted?(posted.area)
                    Task { await vm.load() }
                }
            }
            .confirmationDialog(claimDialogTitle, isPresented: Binding(
                get: { tradeToConfirm != nil },
                set: { if !$0 { tradeToConfirm = nil } }
            ), titleVisibility: .visible) {
                Button("Claim Shift") { claimConfirmedTrade() }
                Button("Cancel", role: .cancel) { tradeToConfirm = nil }
            } message: {
                Text(tradeToConfirm?.requiresApproval == true
                    ? "Staff must approve before the assignment changes."
                    : "You will be assigned immediately.")
            }
            .confirmationDialog(pickupDialogTitle, isPresented: Binding(
                get: { openShiftToPickup != nil },
                set: { if !$0 { openShiftToPickup = nil } }
            ), titleVisibility: .visible) {
                Button(openShiftToPickup?.action == "request" ? "Request Shift" : "Claim Shift") {
                    pickupConfirmedOpenShift()
                }
                Button("Cancel", role: .cancel) { openShiftToPickup = nil }
            } message: {
                Text(openShiftToPickup?.action == "request"
                    ? "Staff must approve before this becomes your shift."
                    : "You will be assigned immediately.")
            }
            .confirmationDialog(cancelDialogTitle, isPresented: Binding(
                get: { tradeToCancel != nil },
                set: { if !$0 { tradeToCancel = nil } }
            ), titleVisibility: .visible) {
                Button("Cancel Trade", role: .destructive) { cancelConfirmedTrade() }
                Button("Keep Posted", role: .cancel) { tradeToCancel = nil }
            } message: {
                Text("Canceling removes the post; the shift stays assigned to you.")
            }
            .confirmationDialog(requestReviewTitle, isPresented: Binding(
                get: { requestToApprove != nil },
                set: { if !$0 { requestToApprove = nil } }
            ), titleVisibility: .visible) {
                Button("Approve Request") { approveConfirmedRequest() }
                Button("Decline Request", role: .destructive) { declineConfirmedRequest() }
                Button("Cancel", role: .cancel) { requestToApprove = nil }
            } message: {
                Text("Approve assigns this shift to \(requestToApprove?.user.name ?? "the requester").")
            }
            .confirmationDialog(tradeReviewTitle, isPresented: Binding(
                get: { tradeToApprove != nil },
                set: { if !$0 { tradeToApprove = nil } }
            ), titleVisibility: .visible) {
                Button("Approve Trade") { approveConfirmedTrade() }
                Button("Decline Trade", role: .destructive) { declineConfirmedTrade() }
                Button("Cancel", role: .cancel) { tradeToApprove = nil }
            } message: {
                Text("Approve assigns the shift to \(tradeToApprove?.claimedBy?.name ?? "the claimer").")
            }
            .sensoryFeedback(.error, trigger: actionErrorHaptic)
        }
    }

    private var cancelDialogTitle: String {
        guard let trade = tradeToCancel else { return "Cancel trade?" }
        return "Cancel \(trade.shiftAssignment.shift.area.shiftAreaLabel) trade?"
    }

    private var claimDialogTitle: String {
        guard let trade = tradeToConfirm else { return "Claim shift?" }
        return "Claim \(trade.shiftAssignment.shift.area.shiftAreaLabel) shift from \(trade.postedBy.name)?"
    }

    private var pickupDialogTitle: String {
        guard let item = openShiftToPickup else { return "Claim shift?" }
        return item.action == "request"
            ? "Request \(item.shift.area.shiftAreaLabel) shift?"
            : "Claim \(item.shift.area.shiftAreaLabel) shift?"
    }

    private var requestReviewTitle: String {
        guard let request = requestToApprove else { return "Review request?" }
        return "Review \(request.user.name)'s request?"
    }

    private var tradeReviewTitle: String {
        guard let trade = tradeToApprove else { return "Review trade?" }
        return "Review \(trade.claimedBy?.name ?? "claimer") for \(trade.shiftAssignment.shift.area.shiftAreaLabel)?"
    }

    private var tradeList: some View {
        List {
            if vm.visibleCount == 0 {
                Section {
                    ContentUnavailableView(
                        "No open work",
                        systemImage: "arrow.triangle.2.circlepath",
                        description: Text("Open shifts, staff requests, and trade posts will show up here.")
                    )
                }
                .listRowBackground(Color.clear)
            }

            if !vm.staffReviewRequests.isEmpty || !vm.staffReviewTrades.isEmpty {
                Section {
                    ForEach(vm.staffReviewRequests) { request in
                        PickupRequestRow(request: request) {
                            requestToApprove = request
                        }
                    }
                    ForEach(vm.staffReviewTrades) { trade in
                        TradeRow(trade: trade, context: .staffReview) {
                            tradeToApprove = trade
                        } cancelAction: {
                            if trade.postedBy.id == currentUserId { tradeToCancel = trade }
                        }
                    }
                } header: {
                    TradeSectionHeader(title: "Staff Review", subtitle: "Requests and claimed premier trades waiting for a decision.")
                }
            }

            if !vm.availableOpenShifts.isEmpty || !vm.availableTrades.isEmpty {
                Section {
                    ForEach(vm.availableOpenShifts) { item in
                        OpenWorkShiftRow(item: item, context: .availableNow) {
                            openShiftToPickup = item
                        }
                    }
                    ForEach(vm.availableTrades) { trade in
                        TradeRow(trade: trade, context: .availableNow) {
                            tradeToConfirm = trade
                        } cancelAction: {}
                    }
                } header: {
                    TradeSectionHeader(title: "Available Now", subtitle: "These shifts can be picked up without staff approval.")
                }
            }

            if !vm.approvalRequiredShifts.isEmpty {
                Section {
                    ForEach(vm.approvalRequiredShifts) { item in
                        OpenWorkShiftRow(item: item, context: .approvalRequired) {
                            openShiftToPickup = item
                        }
                    }
                } header: {
                    TradeSectionHeader(title: "Approval Required", subtitle: "Premier shifts start as requests until staff approve them.")
                }
            }

            if !vm.myTrades.isEmpty {
                Section {
                    ForEach(vm.myTrades) { trade in
                        TradeRow(trade: trade, context: .myPost) {
                        } cancelAction: {
                            tradeToCancel = trade
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                tradeToCancel = trade
                            } label: {
                                Label("Cancel Trade", systemImage: "xmark")
                            }
                            .accessibilityLabel("Cancel trade")
                        }
                    }
                } header: {
                    TradeSectionHeader(title: "My Posts", subtitle: "Canceling a post keeps the shift assigned to you.")
                }
            }

            if !vm.waitingOpenShifts.isEmpty {
                Section {
                    ForEach(vm.waitingOpenShifts) { item in
                        OpenWorkShiftRow(item: item, context: .waiting, action: nil)
                    }
                } header: {
                    TradeSectionHeader(title: "Waiting or Blocked", subtitle: "Visible for context, but not available from your current state.")
                }
            }

            if !vm.postedTrades.isEmpty {
                Section {
                    ForEach(vm.postedTrades) { trade in
                        TradeRow(trade: trade, context: .posted, action: nil, cancelAction: nil)
                    }
                } header: {
                    TradeSectionHeader(title: "Posted Trades", subtitle: "Trade posts visible for coverage context.")
                }
            }

            if !vm.resolvedTrades.isEmpty {
                Section {
                    ForEach(vm.resolvedTrades) { trade in
                        TradeRow(trade: trade, context: .resolved, action: nil, cancelAction: nil)
                    }
                } header: {
                    TradeSectionHeader(title: "Resolved", subtitle: "Completed or cancelled trade history.")
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func pickupConfirmedOpenShift() {
        guard let item = openShiftToPickup else { return }
        Task {
            do {
                try await vm.pickup(id: item.id)
                Haptics.success()
                if item.action == "claim" {
                    let when = item.shift.effectiveStartsAt.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
                    onTradeClaimed?(item.shift.area, when)
                }
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            openShiftToPickup = nil
        }
    }

    private func claimConfirmedTrade() {
        guard let trade = tradeToConfirm else { return }
        Task {
            do {
                try await vm.claim(id: trade.id)
                Haptics.success()
                let when = trade.shiftAssignment.shift.effectiveStartsAt
                    .formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
                onTradeClaimed?(trade.shiftAssignment.shift.area, when)
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            tradeToConfirm = nil
        }
    }

    private func cancelConfirmedTrade() {
        guard let trade = tradeToCancel else { return }
        Task {
            do {
                try await vm.cancel(id: trade.id)
                Haptics.success()
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            tradeToCancel = nil
        }
    }

    private func approveConfirmedRequest() {
        guard let request = requestToApprove else { return }
        Task {
            do {
                try await vm.approveRequest(id: request.id)
                Haptics.success()
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            requestToApprove = nil
        }
    }

    private func declineConfirmedRequest() {
        guard let request = requestToApprove else { return }
        Task {
            do {
                try await vm.declineRequest(id: request.id)
                Haptics.success()
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            requestToApprove = nil
        }
    }

    private func approveConfirmedTrade() {
        guard let trade = tradeToApprove else { return }
        Task {
            do {
                try await vm.approveTrade(id: trade.id)
                Haptics.success()
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            tradeToApprove = nil
        }
    }

    private func declineConfirmedTrade() {
        guard let trade = tradeToApprove else { return }
        Task {
            do {
                try await vm.declineTrade(id: trade.id)
                Haptics.success()
            } catch {
                actionError = error.localizedDescription
                actionErrorHaptic &+= 1
                Haptics.warning()
            }
            tradeToApprove = nil
        }
    }
}

private struct TradeSectionHeader: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
            Text(subtitle)
                .font(.caption)
                .fontWeight(.regular)
                .textCase(nil)
                .foregroundStyle(.secondary)
        }
    }
}

private enum OpenWorkRowContext {
    case availableNow
    case approvalRequired
    case waiting

    var badge: String {
        switch self {
        case .availableNow: "Open"
        case .approvalRequired: "Request"
        case .waiting: "Not available"
        }
    }

    var tone: StatusTone {
        switch self {
        case .availableNow:
            return StatusTone.green
        case .approvalRequired:
            return StatusTone.orange
        case .waiting:
            return StatusTone.gray
        }
    }
}

private struct OpenWorkShiftRow: View {
    let item: OpenWorkShift
    let context: OpenWorkRowContext
    var action: (() -> Void)?

    private var shift: ShiftTradeShift { item.shift }
    private var consequence: String {
        switch item.action {
        case "claim": "You will be assigned immediately."
        case "request": "Staff must approve before this becomes your shift."
        default: item.reason
        }
    }
    private var warning: String? { item.advisoryConflictNote ?? item.warnings.first?.label }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            rowHeader(title: shift.displayTitle, badge: context.badge, tone: context.tone)
            metadataRows([
                shift.timeRange,
                shift.area.shiftAreaLabel,
                consequence,
                item.score.map { "Fit score \($0)" },
            ])

            if let warning {
                Label(warning, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(Color.statusText(.orange))
            }

            if let action {
                Button(action: action) {
                    Text(item.action == "request" ? "Request shift" : "Claim shift")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(Color.brandPrimary)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

private enum TradeRowContext: Equatable {
    case availableNow
    case staffReview
    case myPost
    case posted
    case resolved

    func consequence(for trade: ShiftTrade) -> String {
        switch self {
        case .availableNow:
            return trade.requiresApproval == true
                ? "Claiming sends this to staff review."
                : "Claiming assigns this shift to you immediately."
        case .staffReview:
            return "Approve assigns the shift to \(trade.claimedBy?.name ?? "the claimer")."
        case .myPost:
            return "Canceling removes the post; the shift stays assigned to you."
        case .posted:
            return trade.status.label
        case .resolved:
            return trade.status.label
        }
    }
}

private struct TradeRow: View {
    let trade: ShiftTrade
    let context: TradeRowContext
    var action: (() -> Void)?
    var cancelAction: (() -> Void)?

    private var shift: ShiftTradeShift { trade.shiftAssignment.shift }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            rowHeader(title: shift.displayTitle, badge: trade.status.label, tone: trade.status.tone)
            metadataRows([
                shift.timeRange,
                shift.area.shiftAreaLabel,
                context.consequence(for: trade),
                "Posted by \(trade.postedBy.name)",
            ])

            if let claimedBy = trade.claimedBy {
                Text("Claimed by \(claimedBy.name)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let notes = trade.notes, !notes.isEmpty {
                Text("\"\(notes)\"")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .italic()
            }

            HStack(spacing: 8) {
                if let action {
                    Button(action: action) {
                        Text(context == .staffReview ? "Review" : "Claim this shift")
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(Color.brandPrimary)
                    .controlSize(.small)
                }

                if let cancelAction {
                    Button(role: .destructive, action: cancelAction) {
                        Text("Cancel post")
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

private struct PickupRequestRow: View {
    let request: OpenWorkPickupRequest
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            rowHeader(
                title: request.shift.displayTitle,
                badge: "Request",
                tone: request.hasConflict ? .orange : .blue
            )
            metadataRows([
                request.shift.timeRange,
                request.shift.area.shiftAreaLabel,
                "Approve assigns this shift to \(request.user.name).",
                "Requested \(request.createdAt.formatted(date: .abbreviated, time: .omitted))",
            ])

            if let conflictNote = request.conflictNote {
                Label(conflictNote, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(Color.statusText(.orange))
            }

            Button(action: action) {
                Text("Review request")
                    .font(.subheadline.weight(.medium))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(Color.brandPrimary)
            .controlSize(.small)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

private func rowHeader(title: String, badge: String, tone: StatusTone) -> some View {
    HStack(alignment: .top) {
        Text(title)
            .font(.subheadline.weight(.semibold))
            .lineLimit(2)
        Spacer(minLength: 8)
        Text(badge)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Color.statusText(tone))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.statusBackground(tone), in: Capsule())
    }
}

private func metadataRows(_ values: [String?]) -> some View {
    VStack(alignment: .leading, spacing: 4) {
        ForEach(values.compactMap { $0 }.filter { !$0.isEmpty }, id: \.self) { value in
            Text(value)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
    }
}

private struct TradeBoardActionErrorBanner: View {
    let message: String
    let onRefresh: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.footnote.weight(.semibold))
                .accessibilityHidden(true)

            Text(message)
                .font(.footnote.weight(.medium))
                .lineLimit(2)
                .multilineTextAlignment(.leading)

            Spacer(minLength: 8)

            Button("Refresh", action: onRefresh)
                .font(.footnote.weight(.semibold))

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption.weight(.semibold))
                    .frame(minWidth: 32, minHeight: 32)
            }
            .accessibilityLabel("Dismiss trade board error")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.statusBackground(.red), in: RoundedRectangle(cornerRadius: 12))
        .foregroundStyle(Color.statusText(.red))
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
    }
}

private extension ShiftTradeShift {
    var effectiveStartsAt: Date { callStartsAt ?? startsAt }
    var effectiveEndsAt: Date { callEndsAt ?? endsAt }
    var timeRange: String {
        "\(effectiveStartsAt.formatted(date: .abbreviated, time: .shortened)) - \(effectiveEndsAt.formatted(date: .omitted, time: .shortened))"
    }
    var displayTitle: String {
        let eventTitle = shiftGroup?.event?.compactTitle ?? "Shift"
        return "\(area.shiftAreaLabel): \(eventTitle)"
    }
}

private extension ShiftTradeStatus {
    var tone: StatusTone {
        switch self {
        case .open:
            return StatusTone.green
        case .claimed:
            return StatusTone.orange
        case .completed:
            return StatusTone.gray
        case .cancelled, .expired, .unknown:
            return StatusTone.gray
        }
    }
}
