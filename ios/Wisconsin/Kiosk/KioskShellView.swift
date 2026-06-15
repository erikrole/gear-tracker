import SwiftUI
import UIKit

struct KioskShellView: View {
    @Environment(KioskStore.self) private var store

    var body: some View {
        ZStack {
            KioskSurface.base.ignoresSafeArea()

            Group {
                switch store.screen {
                case .activation:
                    KioskActivationView()
                case .idle:
                    KioskIdleView()
                case .studentHub(let user):
                    KioskStudentHubView(user: user)
                case .checkout(let user):
                    KioskCheckoutView(user: user)
                case .pickup(let bookingId, let userId):
                    KioskPickupView(bookingId: bookingId, userId: userId)
                case .return(let bookingId, let userId):
                    KioskReturnView(bookingId: bookingId, userId: userId)
                case .success(let message):
                    KioskSuccessView(message: message)
                }
            }

            if store.inactivityWarningVisible {
                InactivityWarningOverlay {
                    store.dismissInactivityWarning()
                }
                .transition(.opacity)
            }
        }
        .preferredColorScheme(.dark)
        .persistentSystemOverlays(.hidden)
        .statusBarHidden()
        // Kiosk iPads live plugged in on a counter — never let the screen
        // sleep while the kiosk shell is up; restore normal behavior on exit.
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .simultaneousGesture(TapGesture().onEnded { store.resetInactivity() })
        .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in store.resetInactivity() })
        .animation(.easeInOut(duration: 0.2), value: store.inactivityWarningVisible)
    }
}

private struct InactivityWarningOverlay: View {
    let onStay: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "clock.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(Color.kioskRed)
                Text("Still here?")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text("Tap to keep your scans. Otherwise this will reset to the home screen in 30 seconds.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
                Button {
                    onStay()
                } label: {
                    Text("Stay")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: 220)
                        .padding(.vertical, 14)
                        .background(Color.kioskRed, in: RoundedRectangle(cornerRadius: KioskRadius.lg))
                }
                .buttonStyle(.plain)
            }
            .padding(40)
            .background(KioskSurface.modal, in: RoundedRectangle(cornerRadius: KioskRadius.modal))
            .shadow(radius: 30)
        }
    }
}
