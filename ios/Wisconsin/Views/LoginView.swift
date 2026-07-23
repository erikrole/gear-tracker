import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focused: Field?

    enum Field { case email, password }

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var canSubmit: Bool {
        !trimmedEmail.isEmpty && !password.isEmpty && !session.isLoading
    }

    private func submit() {
        guard canSubmit else { return }
        focused = nil
        Task { await session.login(email: trimmedEmail, password: password) }
    }

    private static let forgotPasswordURL = AppEnvironment.url(path: "/forgot-password")
    private static let registerURL = AppEnvironment.url(path: "/register")

    /// Crimson accent for focused field edges — matches the web login's
    /// `#c41230` focus ring rather than the adaptive `brandPrimary`, because
    /// the card subtree is pinned light.
    private static let focusAccent = Color(red: 0.769, green: 0.071, blue: 0.188)

    var body: some View {
        ZStack {
            BrandSplashScene()

            GeometryReader { geo in
                ScrollView {
                    VStack(spacing: 0) {
                        Spacer(minLength: 24)

                        // Lockup lives on the scene, not the card — the card's
                        // only job is the form. Mirrors the web login.
                        BrandSplashLockup(subtitle: "Sign in to your account")
                            .padding(.bottom, 28)

                        card
                            .padding(.horizontal, 24)

                        footer
                            .padding(.top, 24)
                            .padding(.horizontal, 24)

                        Spacer(minLength: 24)
                    }
                    .frame(maxWidth: 468)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: geo.size.height)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .preferredColorScheme(.dark)
        .onChange(of: session.error) { _, error in
            if let error {
                AccessibilityNotification.Announcement(error).post()
            }
        }
    }

    // The card is a fixed-light frosted material over the dark scene — same
    // treatment as the web login card, which pins light tokens regardless of
    // the user's theme. The `.light` environment makes materials and
    // system colors inside resolve light even though the screen is dark.
    private var card: some View {
        VStack(spacing: 16) {
            // Email
            VStack(alignment: .leading, spacing: 6) {
                Text("Email")
                    .font(.subheadline.weight(.medium))
                TextField(text: $email, prompt: Text("you@example.com").foregroundStyle(.secondary)) { Text("Email") }
                    .accessibilityLabel("Email")
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textContentType(.username)
                    .autocorrectionDisabled()
                    .focused($focused, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focused = .password }
                    .onChange(of: email) { session.clearError() }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(fieldFill(for: .email))
            }

            // Password
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Password")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Link("Forgot password?", destination: Self.forgotPasswordURL)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                ZStack(alignment: .trailing) {
                    Group {
                        if showPassword {
                            TextField(text: $password, prompt: Text("Enter your password").foregroundStyle(.secondary)) { Text("Password") }
                        } else {
                            SecureField(text: $password, prompt: Text("Enter your password").foregroundStyle(.secondary)) { Text("Password") }
                        }
                    }
                    .accessibilityLabel("Password")
                    .textContentType(.password)
                    .focused($focused, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { submit() }
                    .onChange(of: password) { session.clearError() }
                    .padding(.horizontal, 14)
                    .padding(.trailing, 42)
                    .padding(.vertical, 12)
                    .background(fieldFill(for: .password))

                    Button {
                        showPassword.toggle()
                    } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .foregroundStyle(.secondary)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showPassword ? "Hide password" : "Show password")
                    .accessibilityValue(showPassword ? "Password visible" : "Password hidden")
                }
            }

            // Error
            if let error = session.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.statusText(.red))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }

            // Sign In — the page's one saturated moment, in native glass.
            Button {
                submit()
            } label: {
                ZStack {
                    if session.isLoading {
                        ProgressView()
                    } else {
                        Text("Sign in")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            .tint(.brandPrimary)
            .disabled(!canSubmit)
        }
        .padding(24)
        .background(
            // Frosted material plus a white wash so the card reads as a light
            // surface (web: rgba(255,255,255,0.88) + blur), not a pink one —
            // the material alone soaks up too much of the red scene.
            RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous)
                .fill(.regularMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous)
                        .fill(Color.white.opacity(0.72))
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [.white.opacity(0.55), .white.opacity(0.15)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
        )
        .environment(\.colorScheme, .light)
        .shadow(color: Color(.sRGBLinear, white: 0, opacity: 0.4), radius: 24, y: 12)
    }

    // Solid white input wells with a defined resting border and a crimson
    // focused edge — same treatment as the web login's `.login-field`.
    private func fieldFill(for field: Field) -> some View {
        RoundedRectangle(cornerRadius: Brand.Radius.sm, style: .continuous)
            .fill(Color.white)
            .strokeBorder(
                focused == field ? Self.focusAccent : Color.black.opacity(0.14),
                lineWidth: focused == field ? 1.5 : 1
            )
            .animation(.easeOut(duration: 0.15), value: focused)
    }

    // Quiet scene-level footer below the card, mirroring the web login.
    private var footer: some View {
        VStack(spacing: 8) {
            Text("Access is by invitation only.\nContact an administrator to request access.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.55))

            Link("Need an account?", destination: Self.registerURL)
                .font(.footnote.weight(.medium))
                .foregroundStyle(.white.opacity(0.8))
        }
        .font(.footnote)
    }
}
