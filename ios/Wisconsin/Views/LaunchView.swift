import SwiftUI

/// Branded launch splash shown while the session is being restored and the app
/// doesn't yet know whether it's headed to Login or the tab shell. It reuses
/// LoginView's brand gradient and wordmark verbatim, so the hand-off into
/// LoginView is a seamless cross-dissolve (steady background, the sign-in card
/// simply fades in) rather than a blank-screen flash. This is the main-app
/// counterpart to the kiosk's `KioskResumeSplash`.
struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsProgress = false

    var body: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: .brandSplashTop, location: 0),
                    .init(color: .brandSplashMid, location: 0.4),
                    .init(color: .brandPrimary, location: 1),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                Image("Badgers")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 52, height: 52)
                    .accessibilityHidden(true)

                Text("Wisconsin Creative")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)

                // Only reveal the spinner if restore takes a beat, so a fast
                // launch never flashes it.
                ProgressView()
                    .tint(.white)
                    .padding(.top, 8)
                    .opacity(showsProgress ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeIn(duration: 0.2), value: showsProgress)
            }
        }
        .preferredColorScheme(.dark)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Loading Wisconsin Creative")
        .task {
            try? await Task.sleep(for: .milliseconds(500))
            showsProgress = true
        }
    }
}
