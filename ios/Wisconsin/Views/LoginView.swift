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

    private static let forgotPasswordURL = URL(string: "https://gear.erikrole.com/forgot-password")!

    var body: some View {
        ZStack {
            LinearGradient(
                stops: [
                    .init(color: Color(red: 0.102, green: 0.063, blue: 0.090), location: 0),
                    .init(color: Color(red: 0.176, green: 0.039, blue: 0.055), location: 0.4),
                    .init(color: Color.brandPrimary, location: 1),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            GeometryReader { geo in
                ScrollView {
                    VStack {
                        Spacer(minLength: 0)

                        card
                            .padding(.horizontal, 24)

                        Spacer(minLength: 0)
                    }
                    .frame(minHeight: geo.size.height)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    private var card: some View {
        VStack(spacing: 0) {
            // Brand header
            VStack(spacing: 8) {
                Image("Badgers")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 52, height: 52)

                Text("Wisconsin Creative")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.primary)

                Text("Sign in to your account")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 32)
            .padding(.bottom, 28)

            // Form
            VStack(spacing: 16) {
                // Email
                VStack(alignment: .leading, spacing: 6) {
                    Text("Email")
                        .font(.subheadline.weight(.medium))
                    TextField("you@example.com", text: $email)
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
                        .background(Color(.systemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
                        )
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
                                TextField("Enter your password", text: $password)
                            } else {
                                SecureField("Enter your password", text: $password)
                            }
                        }
                        .textContentType(.password)
                        .focused($focused, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { submit() }
                        .onChange(of: password) { session.clearError() }
                        .padding(.horizontal, 14)
                        .padding(.trailing, 42)
                        .padding(.vertical, 12)
                        .background(Color(.systemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(Color(.separator).opacity(0.5), lineWidth: 0.5)
                        )

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Error
                if let error = session.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }

                // Sign In
                Button {
                    submit()
                } label: {
                    ZStack {
                        if session.isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Sign in").fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(
                        canSubmit ? Color(.label) : Color(.label).opacity(0.35),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .foregroundStyle(Color(.systemBackground).opacity(canSubmit ? 1 : 0.5))
                }
                .buttonStyle(ScalePressStyle())
                .disabled(!canSubmit)
            }
            .padding(.horizontal, 24)

            Divider()
                .padding(.vertical, 20)
                .padding(.horizontal, 24)

            Text("Access is by invitation only.\nContact an administrator to request access.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
                .padding(.bottom, 28)
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.25), radius: 24, y: 12)
    }
}
