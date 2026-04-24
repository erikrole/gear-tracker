import SwiftUI

struct KioskSuccessView: View {
    @Environment(KioskStore.self) private var store
    let message: String
    @State private var countdown = 5

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 96))
                .foregroundStyle(.green)

            Text(message)
                .font(.title2.bold())
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 48)

            Text("Returning to home in \(countdown)s...")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            for i in stride(from: 4, through: 0, by: -1) {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                countdown = i
            }
            store.screen = .idle
            store.resetInactivity()
        }
    }
}
