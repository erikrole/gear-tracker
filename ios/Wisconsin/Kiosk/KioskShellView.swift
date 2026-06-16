import SwiftUI
import UIKit

struct KioskShellView: View {
    @Environment(KioskStore.self) private var store

    var body: some View {
        ZStack {
            KioskSurface.base.ignoresSafeArea()

            Group {
                if store.isResuming {
                    KioskResumeSplash()
                } else {
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
                    case .success(let info):
                        KioskSuccessView(info: info)
                    }
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
        // Restore an activated kiosk on cold launch without needing the
        // deeplink — a dedicated iPad always returns to kiosk mode.
        .task { store.resumeIfNeeded() }
        // Kiosk iPads live plugged in on a counter — never let the screen
        // sleep while the kiosk shell is up; restore normal behavior on exit.
        .onAppear { UIApplication.shared.isIdleTimerDisabled = true }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
        .simultaneousGesture(TapGesture().onEnded { store.resetInactivity() })
        .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in store.resetInactivity() })
        .animation(.easeInOut(duration: 0.2), value: store.inactivityWarningVisible)
    }
}

/// Brief splash shown while a cold-launch session restore is in flight, so the
/// kiosk never flashes the activation numpad to a returning device.
private struct KioskResumeSplash: View {
    var body: some View {
        VStack(spacing: 18) {
            ProgressView()
                .controlSize(.large)
                .tint(KioskText.primary)
            Text("Resuming kiosk…")
                .font(.headline)
                .foregroundStyle(KioskText.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Resuming kiosk")
    }
}

private struct InactivityWarningOverlay: View {
    let onStay: () -> Void

    var body: some View {
        ZStack {
            KioskScrim.modal.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "clock.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(Color.kioskRed)
                Text("Still here?")
                    .font(.title2.bold())
                    .foregroundStyle(KioskText.primary)
                Text("Tap to keep your scans. Otherwise this will reset to the home screen in 30 seconds.")
                    .font(.subheadline)
                    .foregroundStyle(KioskText.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
                Button {
                    onStay()
                } label: {
                    Text("Stay")
                        .font(.headline)
                        .foregroundStyle(KioskText.primary)
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
