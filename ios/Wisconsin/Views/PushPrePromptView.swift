import SwiftUI
import UserNotifications

/// Soft pre-prompt shown the first time a user lands inside the app.
/// Apple only lets you ask for push permission once per install, so we frame
/// the value before the system alert appears — this materially improves opt-in.
struct PushPrePromptView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var isRequesting = false

    var body: some View {
        VStack(spacing: 28) {
            VStack(spacing: 14) {
                Image(systemName: "bell.badge.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Color.accentColor)
                    .symbolEffect(.bounce, options: .nonRepeating)

                Text("Stay in the loop")
                    .font(.title2.weight(.bold))

                Text("We'll only ping you for things you care about — gear that's due back, shifts coming up, and trades opening on the board.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
            }

            VStack(spacing: 10) {
                bullet("calendar.badge.clock", "Reminders before your gear is due")
                bullet("person.fill.checkmark", "Your shift is tomorrow")
                bullet("arrow.triangle.2.circlepath", "Trade-board posts you can claim")
            }
            .padding(.horizontal, 24)

            VStack(spacing: 10) {
                Button {
                    Task { await requestSystemPermission() }
                } label: {
                    Text("Turn on notifications")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isRequesting)

                Button("Not now") { dismiss() }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .disabled(isRequesting)
            }
            .padding(.horizontal, 24)

            Spacer(minLength: 0)
        }
        .padding(.top, 36)
        .padding(.bottom, 16)
    }

    private func bullet(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(Color.accentColor)
                .frame(width: 28)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.primary)
            Spacer()
        }
    }

    @MainActor
    private func requestSystemPermission() async {
        isRequesting = true
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        if granted {
            UIApplication.shared.registerForRemoteNotifications()
        }
        isRequesting = false
        dismiss()
    }
}
