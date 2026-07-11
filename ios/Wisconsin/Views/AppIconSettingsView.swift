import SwiftUI
import UIKit

struct AppIconSettingsView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedIcon = AppIconChoice.primary
    @State private var changingIcon: AppIconChoice?
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                ForEach(AppIconChoice.allCases) { choice in
                    Button {
                        changeIcon(to: choice)
                    } label: {
                        AppIconChoiceRow(
                            choice: choice,
                            isSelected: selectedIcon == choice,
                            isChanging: changingIcon == choice
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(changingIcon != nil || selectedIcon == choice)
                    .accessibilityHint(selectedIcon == choice ? "Current app icon" : "Changes the Home Screen app icon")
                }
            } footer: {
                Text("iOS confirms icon changes. The selected icon appears on the Home Screen, in Spotlight, and in system settings.")
            }

            if !UIApplication.shared.supportsAlternateIcons {
                Section {
                    Label("Alternate icons are unavailable on this device.", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("App Icon")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: refreshSelection)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                refreshSelection()
            }
        }
        .alert("Couldn’t Change Icon", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "Try again.")
        }
    }

    private func refreshSelection() {
        selectedIcon = AppIconChoice(alternateName: UIApplication.shared.alternateIconName)
    }

    private func changeIcon(to choice: AppIconChoice) {
        guard UIApplication.shared.supportsAlternateIcons else {
            errorMessage = "Alternate icons aren’t available on this device."
            return
        }

        changingIcon = choice
        Task { @MainActor in
            do {
                try await UIApplication.shared.setAlternateIconName(choice.alternateName)
                selectedIcon = choice
            } catch {
                errorMessage = error.localizedDescription
                refreshSelection()
            }
            changingIcon = nil
        }
    }
}

private enum AppIconChoice: String, CaseIterable, Identifiable {
    case primary
    case heritage
    case bucky
    case helmet
    case metallic

    var id: String { rawValue }

    init(alternateName: String?) {
        self = Self.allCases.first(where: { $0.alternateName == alternateName }) ?? .primary
    }

    var alternateName: String? {
        switch self {
        case .primary: nil
        case .heritage: "AppIconHeritage"
        case .bucky: "AppIconBucky"
        case .helmet: "AppIconHelmet"
        case .metallic: "AppIconMetallic"
        }
    }

    var title: String {
        switch self {
        case .primary: "Motion W"
        case .heritage: "Heritage"
        case .bucky: "Bucky"
        case .helmet: "Helmet"
        case .metallic: "Metallic W"
        }
    }

    var previewImageName: String {
        switch self {
        case .primary: "AppIconPreview"
        case .heritage: "AppIconHeritagePreview"
        case .bucky: "AppIconBuckyPreview"
        case .helmet: "AppIconHelmetPreview"
        case .metallic: "AppIconMetallicPreview"
        }
    }
}

private struct AppIconChoiceRow: View {
    let choice: AppIconChoice
    let isSelected: Bool
    let isChanging: Bool

    var body: some View {
        HStack(spacing: 14) {
            Image(choice.previewImageName)
                .resizable()
                .scaledToFill()
                .frame(width: 54, height: 54)
                .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(.white.opacity(0.18), lineWidth: 1)
                }
                .accessibilityHidden(true)

            Text(choice.title)
                .font(.body.weight(.medium))
                .foregroundStyle(.primary)

            Spacer(minLength: 12)

            if isChanging {
                ProgressView()
                    .controlSize(.small)
            } else if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.primary)
                    .accessibilityLabel("Selected")
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}
