import SwiftUI
import UIKit

@MainActor
@Observable
final class LicensesViewModel {
    var codes: [LicenseCode] = []
    var activeClaim: ActiveLicenseClaim?
    var isLoading = false
    var error: String?
    var notice: String?
    var pendingActionId: String?

    private var lastLoadedAt: Date?
    private static let freshnessWindow: TimeInterval = 60

    func load(forceRefresh: Bool = false) async {
        if !forceRefresh,
           let lastLoadedAt,
           Date().timeIntervalSince(lastLoadedAt) < Self.freshnessWindow,
           !codes.isEmpty || activeClaim != nil {
            return
        }
        guard !isLoading else { return }
        isLoading = true
        if forceRefresh { error = nil }

        do {
            let fetchedCodes = try await APIClient.shared.licenses()
            let fetchedClaim = try await APIClient.shared.myLicense()
            codes = fetchedCodes
            activeClaim = fetchedClaim
            error = nil
            lastLoadedAt = Date()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func claim(_ code: LicenseCode) async {
        guard pendingActionId == nil else { return }
        pendingActionId = code.id
        notice = nil
        error = nil
        do {
            let result = try await APIClient.shared.claimLicense(id: code.id)
            UIPasteboard.general.string = result.code
            await load(forceRefresh: true)
            notice = "License claimed and copied."
        } catch {
            self.error = error.localizedDescription
        }
        pendingActionId = nil
    }

    func releaseActiveClaim() async {
        guard let activeClaim, pendingActionId == nil else { return }
        pendingActionId = activeClaim.id
        notice = nil
        error = nil
        do {
            try await APIClient.shared.releaseLicense(id: activeClaim.id)
            await load(forceRefresh: true)
            notice = "License returned."
        } catch {
            self.error = error.localizedDescription
        }
        pendingActionId = nil
    }

    func copyActiveCode() {
        guard let activeClaim else { return }
        UIPasteboard.general.string = activeClaim.code
        notice = "Code copied."
    }
}

struct LicensesView: View {
    var wrapsInNavigationStack = true

    @Environment(SessionStore.self) private var session
    @State private var vm = LicensesViewModel()
    @State private var claimCandidate: LicenseCode?
    @State private var showReturnConfirm = false

    private static let webManagementURL = AppEnvironment.url(path: "/licenses")

    private var isStaffOrAdmin: Bool {
        let role = session.currentUser?.role ?? ""
        return role == "STAFF" || role == "ADMIN"
    }

    private var openSlotCount: Int {
        vm.codes.reduce(into: 0) { total, code in
            guard code.status != .retired else { return }
            let activeClaims = code.claims.filter { $0.releasedAt == nil }.count
            total += max(0, 2 - min(activeClaims, 2))
        }
    }

    var body: some View {
        if wrapsInNavigationStack {
            NavigationStack { configuredContent }
        } else {
            configuredContent
        }
    }

    private var configuredContent: some View {
        content
            .navigationTitle("Licenses")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await vm.load(forceRefresh: true) }
            .task { await vm.load() }
            .confirmationDialog(
                "Claim Photo Mechanic license?",
                isPresented: claimConfirmBinding,
                titleVisibility: .visible
            ) {
                if let claimCandidate {
                    Button("Claim License") {
                        let code = claimCandidate
                        self.claimCandidate = nil
                        Task { await vm.claim(code) }
                    }
                    .tint(Color.statusText(.green))
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                if let claimCandidate {
                    Text("This fills one slot on \(licenseTitle(claimCandidate)).")
                }
            }
            .confirmationDialog(
                "Return Photo Mechanic license?",
                isPresented: $showReturnConfirm,
                titleVisibility: .visible
            ) {
                Button("Return License", role: .destructive) {
                    Task { await vm.releaseActiveClaim() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The slot becomes available for someone else.")
            }
    }

    private var claimConfirmBinding: Binding<Bool> {
        Binding(
            get: { claimCandidate != nil },
            set: { isPresented in
                if !isPresented { claimCandidate = nil }
            }
        )
    }

    @ViewBuilder
    private var content: some View {
        if vm.codes.isEmpty && vm.activeClaim == nil && vm.isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = vm.error, vm.codes.isEmpty && vm.activeClaim == nil {
            ContentUnavailableView {
                Label("Couldn't load licenses", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Retry") { Task { await vm.load(forceRefresh: true) } }
                    .buttonStyle(.borderedProminent)
            }
        } else if vm.codes.isEmpty {
            ContentUnavailableView(
                "No licenses",
                systemImage: "key",
                description: Text("No Photo Mechanic license codes are available.")
            )
        } else {
            licenseList
        }
    }

    private var licenseList: some View {
        List {
            Section {
                LicensePoolOverview(
                    hasActiveLicense: vm.activeClaim != nil,
                    openSlotCount: openSlotCount,
                    codeCount: vm.codes.filter { $0.status != .retired }.count
                )
            }
            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
            .listRowBackground(Color.clear)

            if let notice = vm.notice {
                Section {
                    Label(notice, systemImage: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.statusText(.green))
                }
            }

            if let error = vm.error {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Retry") { Task { await vm.load(forceRefresh: true) } }
                            .buttonStyle(.bordered)
                    }
                    .padding(.vertical, 2)
                }
            }

            activeLicenseSection
            licensePoolSection

            if isStaffOrAdmin {
                Section {
                    Link(destination: Self.webManagementURL) {
                        SettingsMenuRow(
                            title: "Manage on web",
                            subtitle: "Create, renew, retire, export, and audit license codes.",
                            systemImage: "arrow.up.right.square",
                            tint: Color.statusText(.blue)
                        ) {
                            EmptyView()
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var activeLicenseSection: some View {
        Section("My License") {
            if let activeClaim = vm.activeClaim {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center, spacing: 12) {
                        Image(systemName: "key.fill")
                            .font(.headline)
                            .foregroundStyle(Color.statusText(.blue))
                            .frame(width: 40, height: 40)
                            .background(Color.statusBackground(.blue), in: Circle())

                        VStack(alignment: .leading, spacing: 3) {
                            Text(activeClaim.label?.isEmpty == false ? activeClaim.label! : "Photo Mechanic")
                                .font(.headline)
                            Text(claimedSummary(activeClaim.claimedAt))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer(minLength: 8)

                        StatusPill(label: "Yours", tone: .blue)
                    }

                    Text(activeClaim.code)
                        .font(.system(.body, design: .monospaced).weight(.medium))
                        .textSelection(.enabled)
                        .lineLimit(2)
                        .minimumScaleFactor(0.82)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.cardSurfaceRaised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Label(expirySummary(activeClaim.expiresAt), systemImage: "calendar")
                        .font(.caption)
                        .foregroundStyle(expiryTone(activeClaim.expiresAt))

                    Divider()

                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 10) {
                            activeLicenseButtons(activeClaim)
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            activeLicenseButtons(activeClaim)
                        }
                    }
                }
                .padding(.vertical, 6)
                .listRowBackground(Color.statusBackground(.blue))
            } else {
                HStack(spacing: 12) {
                    Image(systemName: "key.slash")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                        .frame(width: 40, height: 40)
                        .background(Color.cardSurfaceRaised, in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text("No active license")
                            .font(.headline)
                        Text(openSlotCount > 0 ? "Choose an open slot below when you need one." : "Every shared slot is currently in use.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func activeLicenseButtons(_ activeClaim: ActiveLicenseClaim) -> some View {
        Group {
            Button("Copy Code") {
                vm.copyActiveCode()
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .frame(minHeight: 44)
            .tint(Color.statusText(.blue))

            Button("Return License", role: .destructive) {
                showReturnConfirm = true
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .frame(minHeight: 44)
            .disabled(vm.pendingActionId != nil)
        }
    }

    private var licensePoolSection: some View {
        Section("License Pool") {
            ForEach(vm.codes) { code in
                LicensePoolRow(
                    code: code,
                    currentUserId: session.currentUser?.id,
                    activeClaimId: vm.activeClaim?.id,
                    canRevealUnclaimedCodes: isStaffOrAdmin,
                    isPending: vm.pendingActionId == code.id
                ) {
                    claimCandidate = code
                }
            }
        }
    }
}

private struct LicensePoolOverview: View {
    let hasActiveLicense: Bool
    let openSlotCount: Int
    let codeCount: Int

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: hasActiveLicense ? "checkmark.seal.fill" : "key.horizontal.fill")
                .font(.title2)
                .foregroundStyle(Color.statusText(hasActiveLicense ? .blue : availabilityTone))
                .frame(width: 48, height: 48)
                .background(Color.statusBackground(hasActiveLicense ? .blue : availabilityTone), in: RoundedRectangle(cornerRadius: 14, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(hasActiveLicense ? "Your license is ready" : availabilityTitle)
                    .font(.headline)
                Text(summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)
        }
        .padding(16)
        .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.hairline, lineWidth: 0.5)
        }
        .accessibilityElement(children: .combine)
    }

    private var availabilityTitle: String {
        openSlotCount == 0 ? "All licenses are in use" : "Licenses are available"
    }

    private var summary: String {
        let codeLabel = codeCount == 1 ? "code" : "codes"
        let slotLabel = openSlotCount == 1 ? "slot" : "slots"
        if hasActiveLicense {
            return "Copy your code below. \(openSlotCount) open \(slotLabel) remain across \(codeCount) \(codeLabel)."
        }
        return "\(openSlotCount) open \(slotLabel) across \(codeCount) shared \(codeLabel)."
    }

    private var availabilityTone: StatusTone {
        openSlotCount > 0 ? .green : .gray
    }
}

private struct LicensePoolRow: View {
    let code: LicenseCode
    let currentUserId: String?
    let activeClaimId: String?
    let canRevealUnclaimedCodes: Bool
    let isPending: Bool
    let onClaim: () -> Void

    private var activeClaims: [LicenseCodeClaim] {
        code.claims.filter { $0.releasedAt == nil }
    }

    private var slotCount: Int {
        min(activeClaims.count, 2)
    }

    private var isCurrentHolder: Bool {
        code.id == activeClaimId || activeClaims.contains { claim in
            guard let currentUserId else { return false }
            return claim.userId == currentUserId
        }
    }

    private var canClaim: Bool {
        activeClaimId == nil && (code.status == .available || code.status == .partial) && slotCount < 2
    }

    private var canRevealCode: Bool {
        canRevealUnclaimedCodes || isCurrentHolder
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: statusSystemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.statusText(statusTone))
                    .frame(width: 36, height: 36)
                    .background(Color.statusBackground(statusTone), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

                VStack(alignment: .leading, spacing: 3) {
                    Text(licenseTitle(code))
                        .font(.headline)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)

                    Text(codeDisplay)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundStyle(code.code.isEmpty ? .secondary : .primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }

                Spacer(minLength: 8)

                StatusPill(label: availabilityLabel, tone: statusTone)
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Label(slotSummary, systemImage: "person.2")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer(minLength: 8)

                if isCurrentHolder {
                    StatusPill(label: "Yours", tone: .blue)
                } else if canClaim {
                    Button("Claim") {
                        onClaim()
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .controlSize(.small)
                    .frame(minHeight: 44)
                    .tint(Color.statusText(.green))
                    .disabled(isPending)
                }
            }

            Label(expirySummary(code.expiresAt), systemImage: "calendar")
                .font(.caption)
                .foregroundStyle(expiryTone(code.expiresAt))
        }
        .padding(.vertical, 6)
        .listRowBackground(rowBackground)
    }

    private var codeDisplay: String {
        canRevealCode && !code.code.isEmpty ? code.code : "Code hidden until claimed"
    }

    private var slotSummary: String {
        if activeClaims.isEmpty { return "No one is using this code" }
        guard canRevealUnclaimedCodes else {
            return slotCount == 1 ? "1 of 2 slots in use" : "Both slots in use"
        }
        let names = activeClaims.map { claim -> String in
            if let name = claim.user?.name, !name.isEmpty { return name }
            if let label = claim.occupantLabel, !label.isEmpty { return label }
            return "Unknown occupant"
        }
        return "\(slotCount)/2 filled: \(names.joined(separator: ", "))"
    }

    private var statusTone: StatusTone {
        switch code.status {
        case .available: StatusTone.green
        case .partial: StatusTone.blue
        case .claimed: StatusTone.blue
        case .retired: StatusTone.gray
        case .unknown: StatusTone.gray
        }
    }

    private var availabilityLabel: String {
        switch code.status {
        case .available: "2 open"
        case .partial: "1 open"
        case .claimed: "Full"
        case .retired: "Retired"
        case .unknown: "Unknown"
        }
    }

    private var statusSystemImage: String {
        switch code.status {
        case .available: "checkmark"
        case .partial: "person.badge.plus"
        case .claimed: "person.2.fill"
        case .retired: "archivebox.fill"
        case .unknown: "questionmark"
        }
    }

    private var rowBackground: Color {
        switch code.status {
        case .available: Color.statusBackground(.green)
        case .partial, .claimed: Color.statusBackground(.blue)
        case .retired, .unknown: Color.cardSurface
        }
    }

}

private func licenseTitle(_ code: LicenseCode) -> String {
    if let label = code.label?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty {
        return label
    }
    return "Photo Mechanic"
}

@MainActor
private func claimedSummary(_ raw: String?) -> String {
    guard let date = parseLicenseDate(raw) else { return "Claimed" }
    return "Claimed \(date.formatted(date: .abbreviated, time: .omitted))"
}

@MainActor
private func expirySummary(_ raw: String?) -> String {
    guard let raw, !raw.isEmpty else { return "No expiry date" }
    guard let date = parseLicenseDate(raw) else { return "Expiry on file" }
    let formatted = date.formatted(date: .abbreviated, time: .omitted)
    if date < Calendar.current.startOfDay(for: Date()) {
        return "Expired \(formatted)"
    }
    return "Expires \(formatted)"
}

@MainActor
private func expiryTone(_ raw: String?) -> Color {
    guard let date = parseLicenseDate(raw) else { return .secondary }
    if date < Calendar.current.startOfDay(for: Date()) {
        return Color.statusText(.red)
    }
    let soon = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    if date <= soon {
        return Color.statusText(.orange)
    }
    return .secondary
}

@MainActor
private func parseLicenseDate(_ raw: String?) -> Date? {
    guard let raw, !raw.isEmpty else { return nil }
    return LicenseDateFormatters.fractional.date(from: raw) ?? LicenseDateFormatters.standard.date(from: raw)
}

@MainActor
private enum LicenseDateFormatters {
    static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
