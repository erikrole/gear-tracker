import SwiftUI

@MainActor
@Observable
final class TradeBoardViewModel {
    var trades: [ShiftTrade] = []
    var total = 0
    var isLoading = false
    var error: String?
    var currentUserId: String = ""
    private let pageSize = 30

    var openTrades: [ShiftTrade] { trades.filter { $0.status == .open && $0.postedBy.id != currentUserId } }
    var myTrades: [ShiftTrade] { trades.filter { $0.postedBy.id == currentUserId && ($0.status == .open || $0.status == .claimed) } }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let resp = try await APIClient.shared.shiftTrades(limit: pageSize)
            trades = resp.data
            total = resp.total
        } catch {
            self.error = error.localizedDescription
        }
    }

    func claim(id: String) async throws {
        let updated = try await APIClient.shared.claimShiftTrade(id: id)
        if let idx = trades.firstIndex(where: { $0.id == id }) {
            trades[idx] = updated
        }
    }

    func cancel(id: String) async throws {
        try await APIClient.shared.cancelShiftTrade(id: id)
        trades.removeAll { $0.id == id }
    }
}

struct TradeBoardSheet: View {
    let myShifts: [MyShift]
    let currentUserId: String

    @State private var vm = TradeBoardViewModel()
    @State private var showPostSheet = false
    @State private var tradeToConfirm: ShiftTrade?
    @State private var actionError: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.trades.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = vm.error, vm.trades.isEmpty {
                    ContentUnavailableView {
                        Label("Error", systemImage: "exclamationmark.triangle")
                    } description: { Text(error) } actions: {
                        Button("Retry") { Task { await vm.load() } }
                            .buttonStyle(.borderedProminent)
                    }
                } else {
                    tradeList
                }
            }
            .navigationTitle("Trade Board")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showPostSheet = true
                    } label: {
                        Label("Post Shift", systemImage: "plus")
                    }
                }
            }
            .task {
            vm.currentUserId = currentUserId
            await vm.load()
        }
            .refreshable { await vm.load() }
            .sheet(isPresented: $showPostSheet) {
                PostTradeSheet(myShifts: myShifts) {
                    Task { await vm.load() }
                }
            }
            .confirmationDialog(
                claimDialogTitle,
                isPresented: Binding(
                    get: { tradeToConfirm != nil },
                    set: { if !$0 { tradeToConfirm = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Claim Shift") {
                    guard let trade = tradeToConfirm else { return }
                    Task {
                        do {
                            try await vm.claim(id: trade.id)
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        } catch {
                            actionError = error.localizedDescription
                        }
                        tradeToConfirm = nil
                    }
                }
                Button("Cancel", role: .cancel) { tradeToConfirm = nil }
            }
            .alert("Error", isPresented: Binding(get: { actionError != nil }, set: { if !$0 { actionError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(actionError ?? "")
            }
        }
    }

    private var claimDialogTitle: String {
        guard let trade = tradeToConfirm else { return "Claim Shift?" }
        return "Claim \(trade.shiftAssignment.shift.area) shift from \(trade.postedBy.name)?"
    }

    private var tradeList: some View {
        List {
            if vm.openTrades.isEmpty && vm.myTrades.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No open trades",
                        systemImage: "arrow.triangle.2.circlepath",
                        description: Text("Post a shift to start a trade.")
                    )
                }
                .listRowBackground(Color.clear)
            }

            if !vm.openTrades.isEmpty {
                Section("Open Trades") {
                    ForEach(vm.openTrades) { trade in
                        TradeRow(trade: trade) {
                            tradeToConfirm = trade
                        }
                    }
                }
            }

            if !vm.myTrades.isEmpty {
                Section("My Active Posts") {
                    ForEach(vm.myTrades) { trade in
                        TradeRow(trade: trade, claimAction: nil)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task {
                                        do { try await vm.cancel(id: trade.id) }
                                        catch { actionError = error.localizedDescription }
                                    }
                                } label: {
                                    Label("Cancel Trade", systemImage: "xmark")
                                }
                            }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Trade Row

private struct TradeRow: View {
    let trade: ShiftTrade
    let claimAction: (() -> Void)?

    private var shift: ShiftTradeShift { trade.shiftAssignment.shift }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(shift.area)
                        .font(.subheadline.weight(.semibold))
                    if let summary = shift.shiftGroup?.event?.summary {
                        Text(summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                TradeStatusChip(status: trade.status)
            }

            HStack(spacing: 4) {
                Image(systemName: "clock")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text("\(shift.startsAt.formatted(date: .abbreviated, time: .shortened)) – \(shift.endsAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 4) {
                Image(systemName: "person")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text("Posted by \(trade.postedBy.name)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let notes = trade.notes, !notes.isEmpty {
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Text("\"\(notes)\"")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .italic()
                }
            }

            if let claimAction {
                Button(action: claimAction) {
                    Text("Claim Shift")
                        .font(.subheadline.weight(.medium))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.accentColor)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct TradeStatusChip: View {
    let status: ShiftTradeStatus

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(statusColor)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(statusColor.opacity(0.12), in: Capsule())
    }

    private var statusColor: Color {
        switch status {
        case .open: .green
        case .claimed: .orange
        case .completed: .secondary
        case .cancelled, .expired: .gray
        case .unknown: .gray
        }
    }
}
