import SwiftUI

struct KioskIdentityView: View {
    @Environment(KioskStore.self) private var store
    @State private var users: [KioskUser] = []
    @State private var query = ""
    @State private var message: String?
    @State private var loading = true
    @FocusState private var searchFocused: Bool

    private var intent: KioskFlowIntent? { store.pendingIntent }
    private var visibleUsers: [KioskUser] {
        let roster = intent?.expectedRequester.map { [$0] } ?? users
        guard !query.isEmpty else { return roster }
        return roster.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Button("Cancel") { store.clearIntent(reason: .cancel); store.screen = .idle }
                        .buttonStyle(.bordered)
                    Spacer()
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(intent?.heroTitle ?? "Who are you?")
                        .font(.gothamBlack(size: 36)).foregroundStyle(KioskText.primary)
                    Text(intent?.expectedRequester.map { "Confirm \($0.name) to continue. Scan their Wiscard or tap their name." }
                         ?? "Scan your Wiscard or choose your name.")
                        .font(.title3).foregroundStyle(KioskText.secondary)
                }
                TextField("Search roster", text: $query)
                    .textFieldStyle(.plain).font(.title3)
                    .padding(16).background(KioskSurface.cardRaised, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
                    .focused($searchFocused)
                if let message { Text(message).foregroundStyle(Color.statusText(.orange)).font(.headline) }
                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 210), spacing: 14)], spacing: 14) {
                        ForEach(visibleUsers) { user in
                            Button { choose(user) } label: {
                                HStack(spacing: 12) {
                                    KioskAvatar(url: user.avatarUrl, initials: user.initials, size: 52)
                                    Text(user.name).font(.headline).foregroundStyle(KioskText.primary)
                                    Spacer(); Image(systemName: "chevron.right").foregroundStyle(KioskText.muted)
                                }.padding(16).kioskCard(KioskSurface.cardRaised, radius: KioskRadius.lg, stroke: KioskStroke.standard)
                            }.buttonStyle(KioskPressStyle())
                        }
                    }
                }
                if loading { ProgressView().tint(KioskText.primary) }
            }
            .padding(36)

            if !searchFocused {
                HIDScannerField { store.scanner.receive($0) }.frame(width: 1, height: 1).opacity(0)
            }
        }
        .task {
            store.scanner.claim(.identity) { scan in identify(scan) }
            do { users = try await KioskAPI.shared.kioskUsers() } catch { message = "Could not load the roster." }
            loading = false
        }
        .onChange(of: searchFocused) { _, focused in store.scanner.setEditing(focused) }
        .onDisappear { store.scanner.setEditing(false); store.scanner.release(.identity) }
    }

    private func identify(_ scan: String) {
        Task {
            do {
                let result = try await KioskAPI.shared.kioskResolveScan(scanValue: scan)
                guard result.kind == "identity", let user = result.user else {
                    message = result.message ?? "Scan a Wiscard to confirm your name."; Haptics.warning(); return
                }
                choose(user)
            } catch { message = (error as? APIError)?.errorDescription ?? "Could not read that Wiscard."; Haptics.error() }
        }
    }

    private func choose(_ user: KioskUser) {
        guard var intent else { store.screen = .studentHub(user); return }
        guard KioskFlowIntentReducer.canIdentify(user, for: intent) else {
            message = "This flow requires \(intent.expectedRequester?.name ?? "the expected requester")."
            Haptics.warning(); return
        }
        intent = KioskFlowIntentReducer.identify(user, in: intent)
        store.setIntent(intent); Haptics.success()
        switch intent.action {
        case .checkout: store.screen = .checkout(user: user)
        case .pickup:
            guard let id = intent.targetBooking?.id else { message = "That reservation is no longer available."; return }
            store.screen = .pickup(bookingId: id, userId: user.id)
        case .return:
            guard let id = intent.targetBooking?.id else { message = "That checkout is no longer available."; return }
            store.screen = .return(bookingId: id, userId: user.id)
        case .manage: store.screen = .studentHub(user)
        }
    }
}

struct KioskScannerStatusPill: View {
    @Environment(KioskStore.self) private var store
    @State private var showInspector = false
    var body: some View {
        Button { showInspector = true } label: {
            Label(store.scanner.statusText, systemImage: store.scanner.statusSymbol)
                .font(.caption.weight(.bold)).foregroundStyle(KioskText.primary)
                .padding(.horizontal, 13).padding(.vertical, 9)
                .background(KioskSurface.modal, in: Capsule()).overlay(Capsule().stroke(KioskStroke.strong))
        }.buttonStyle(.plain)
        #if DEBUG
        .sheet(isPresented: $showInspector) { KioskFlowInspector() }
        #endif
    }
}

#if DEBUG
private struct KioskFlowInspector: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            Form {
                LabeledContent("Scanner owner", value: store.scanner.owner.rawValue)
                LabeledContent("Scanner state", value: store.scanner.statusText)
                LabeledContent("Intent", value: store.pendingIntent?.action.rawValue ?? "none")
                LabeledContent("Source", value: store.pendingIntent?.source.rawValue ?? "none")
                LabeledContent("Pending scans", value: "\(store.pendingIntent?.pendingScanValues.count ?? 0)")
                Text("Raw scan values are intentionally never shown or logged.")
            }.navigationTitle("Kiosk Flow Inspector").toolbar { Button("Done") { dismiss() } }
        }
    }
}
#endif
