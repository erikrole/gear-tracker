import SwiftUI
import UIKit

struct KioskSuccessView: View {
    @Environment(KioskStore.self) private var store
    let info: KioskSuccessInfo
    @State private var countdown = 5

    private var accent: Color {
        switch info.kind {
        case .checkout: return Color.kioskRed
        case .returned: return Color.statusText(.green)
        case .pickup:   return Color.statusText(.orange)
        }
    }

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            ZStack(alignment: .bottomTrailing) {
                Image(systemName: info.kind.icon)
                    .font(.system(size: 96))
                    .foregroundStyle(accent)

                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 34))
                    .foregroundStyle(Color.statusText(.green))
                    .background(KioskSurface.base, in: Circle())
                    .offset(x: 8, y: 8)
            }
            .accessibilityHidden(true)

            Text(info.kind.label.uppercased())
                .font(.headline.weight(.bold))
                .tracking(2)
                .foregroundStyle(accent)

            Text(info.message)
                .font(.kioskSuccessTitle())
                .foregroundStyle(KioskText.primary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)

            Text("Returning to home in \(countdown)s...")
                .font(.subheadline)
                .foregroundStyle(KioskText.secondary)
                .monospacedDigit()
                .accessibilityHidden(true)

            Button {
                skip()
            } label: {
                Text("Done")
                    .font(.headline)
                    .foregroundStyle(KioskText.primary)
                    .padding(.horizontal, 36)
                    .padding(.vertical, 14)
                    .background(Color.kioskRed, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Done — return to home now")

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture { skip() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(info.kind.label): \(info.message)")
        .accessibilityAddTraits(.isHeader)
        .task {
            Haptics.success()
            UIAccessibility.post(notification: .announcement, argument: "\(info.kind.label). \(info.message)")
            for i in stride(from: 4, through: 0, by: -1) {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                countdown = i
            }
            store.screen = .idle
            store.resetInactivity()
        }
    }

    /// Tap "Done" or anywhere on the screen to short-circuit the 5 s countdown
    /// and return to idle immediately.
    private func skip() {
        store.screen = .idle
        store.resetInactivity()
    }
}
