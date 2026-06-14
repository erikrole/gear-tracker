import SwiftUI
import UIKit

struct KioskSuccessView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let message: String
    @State private var countdown = 5

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 96))
                .foregroundStyle(Color.statusText(.green))
                .symbolEffect(.bounce, options: reduceMotion ? .nonRepeating.speed(0) : .nonRepeating)
                .accessibilityHidden(true)

            Text(message)
                .font(.kioskSuccessTitle())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)

            Text("Returning to home in \(countdown)s...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .monospacedDigit()
                .accessibilityHidden(true)

            Button {
                skip()
            } label: {
                Text("Done")
                    .font(.headline)
                    .foregroundStyle(.white)
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
        .accessibilityLabel("Success: \(message)")
        .accessibilityAddTraits(.isHeader)
        .task {
            Haptics.success()
            UIAccessibility.post(notification: .announcement, argument: "Success. \(message)")
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
