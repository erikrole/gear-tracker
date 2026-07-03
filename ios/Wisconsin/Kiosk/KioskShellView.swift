import SwiftUI
import UIKit

struct KioskShellView: View {
    @Environment(KioskStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// One transition unit per logical screen. Keying by case (plus the
    /// identifying payload) means in-screen state changes never re-trigger the
    /// transition, while every real navigation cross-fades.
    private var screenKey: String {
        if store.isResuming { return "resuming" }
        switch store.screen {
        case .activation: return "activation"
        case .idle: return "idle"
        case .studentHub(let user): return "hub-\(user.id)"
        case .checkout(let user): return "checkout-\(user.id)"
        case .pickup(let bookingId, _): return "pickup-\(bookingId)"
        case .return(let bookingId, _): return "return-\(bookingId)"
        case .success: return "success"
        }
    }

    /// Subliminal fade + 1.5% settle-in. Deliberately not a slide: opacity is
    /// cheap on old iPads and doesn't change when views mount/unmount relative
    /// to the bare switch, so HID scanner field semantics are untouched.
    private var screenTransition: AnyTransition {
        reduceMotion
            ? .opacity
            : .asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 0.985)),
                removal: .opacity
            )
    }

    var body: some View {
        ZStack {
            KioskBackdrop()

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
            .id(screenKey)
            .transition(screenTransition)

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
        .background(KioskActivityMonitor { store.resetInactivity() })
        .animation(.easeInOut(duration: 0.2), value: store.inactivityWarningVisible)
        .animation(
            reduceMotion ? .easeInOut(duration: 0.15) : .easeOut(duration: 0.28),
            value: screenKey
        )
    }
}

/// Tracks kiosk activity without adding SwiftUI gestures to the screen tree.
/// The recognizers are non-cancelling and allow simultaneous recognition, so
/// UIKit controls such as calendars, wheels, text fields, and menus keep their
/// own touch handling.
private struct KioskActivityMonitor: UIViewRepresentable {
    let onActivity: () -> Void

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: UIView, context: Context) {
        context.coordinator.onActivity = onActivity
        DispatchQueue.main.async {
            context.coordinator.install(on: view.window)
        }
    }

    static func dismantleUIView(_ uiView: UIView, coordinator: Coordinator) {
        coordinator.uninstall()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onActivity: onActivity)
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onActivity: () -> Void
        private weak var window: UIWindow?
        private var lastActivityAt = Date.distantPast

        private lazy var tapRecognizer: UITapGestureRecognizer = {
            let recognizer = UITapGestureRecognizer(target: self, action: #selector(tapActivity(_:)))
            configure(recognizer)
            return recognizer
        }()

        private lazy var panRecognizer: UIPanGestureRecognizer = {
            let recognizer = UIPanGestureRecognizer(target: self, action: #selector(panActivity(_:)))
            configure(recognizer)
            return recognizer
        }()

        init(onActivity: @escaping () -> Void) {
            self.onActivity = onActivity
        }

        func install(on window: UIWindow?) {
            guard let window, self.window !== window else { return }
            uninstall()
            window.addGestureRecognizer(tapRecognizer)
            window.addGestureRecognizer(panRecognizer)
            self.window = window
        }

        func uninstall() {
            window?.removeGestureRecognizer(tapRecognizer)
            window?.removeGestureRecognizer(panRecognizer)
            window = nil
        }

        private func configure(_ recognizer: UIGestureRecognizer) {
            recognizer.cancelsTouchesInView = false
            recognizer.delaysTouchesBegan = false
            recognizer.delaysTouchesEnded = false
            recognizer.delegate = self
        }

        @objc private func tapActivity(_ recognizer: UITapGestureRecognizer) {
            guard recognizer.state == .ended else { return }
            recordActivity()
        }

        @objc private func panActivity(_ recognizer: UIPanGestureRecognizer) {
            guard recognizer.state == .began else { return }
            recordActivity()
        }

        private func recordActivity() {
            let now = Date()
            guard now.timeIntervalSince(lastActivityAt) > 0.5 else { return }
            lastActivityAt = now
            onActivity()
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            KioskScrim.modal.ignoresSafeArea()
            VStack(spacing: 20) {
                ZStack {
                    Circle()
                        .fill(Color.kioskRed.opacity(0.14))
                        .frame(width: 64, height: 64)
                    Image(systemName: "clock.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(Color.kioskRed)
                }
                .accessibilityHidden(true)
                Text("Still here?")
                    .font(.title2.bold())
                    .foregroundStyle(KioskText.primary)
                Text("Tap to keep your scans. Otherwise this will reset to the home screen in 30 seconds.")
                    .font(.subheadline)
                    .foregroundStyle(KioskText.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 30)
                InactivityCountdown(reduceMotion: reduceMotion)
                    .padding(.horizontal, 30)
                Button {
                    onStay()
                } label: {
                    Text("Stay")
                        .font(.headline)
                        .foregroundStyle(KioskText.primary)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(
                            LinearGradient(
                                colors: [Color.kioskRed, Color.kioskRed.opacity(0.85)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            in: RoundedRectangle(cornerRadius: KioskRadius.lg)
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 30)
            }
            .padding(40)
            .frame(maxWidth: 460)
            .kioskCard(KioskSurface.modal, radius: KioskRadius.modal, stroke: KioskStroke.strong)
            .shadow(radius: 30)
        }
    }
}

/// The 30 seconds the warning stays up before the kiosk resets, made visible:
/// a draining brand-red capsule, or a plain numeric countdown under Reduce
/// Motion. Purely decorative — the copy above already states the timeout, so
/// this is hidden from accessibility.
private struct InactivityCountdown: View {
    let reduceMotion: Bool
    @State private var appeared = Date()

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = max(0, 30 - Int(context.date.timeIntervalSince(appeared).rounded()))
            if reduceMotion {
                Text("\(remaining)s")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(KioskText.secondary)
                    .contentTransition(.numericText())
            } else {
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(KioskStroke.divider)
                    GeometryReader { geo in
                        Capsule()
                            .fill(Color.kioskRed)
                            .frame(width: geo.size.width * CGFloat(remaining) / 30)
                            .animation(.linear(duration: 1), value: remaining)
                    }
                }
                .frame(height: 4)
            }
        }
        .accessibilityHidden(true)
    }
}
