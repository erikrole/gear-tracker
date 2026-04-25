import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
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
    private static let registerURL = URL(string: "https://gear.erikrole.com/register")!

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    brandHeader
                        .frame(height: max(200, geo.size.height * 0.36))

                    formSection
                        .padding(.horizontal, 28)
                        .padding(.top, 32)
                        .padding(.bottom, 40)
                }
                .frame(minHeight: geo.size.height)
                .frame(maxWidth: 440)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Color(.systemGroupedBackground).ignoresSafeArea())
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    private var brandHeader: some View {
        ZStack {
            Color(red: 0.11, green: 0.11, blue: 0.11)
                .ignoresSafeArea(edges: .top)

            VStack(spacing: 10) {
                Text("W")
                    .font(.system(size: 56, weight: .heavy))
                    .foregroundStyle(Color(red: 0.627, green: 0, blue: 0))
                VStack(spacing: 2) {
                    Text("Gear Tracker")
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.white)
                    Text("University of Wisconsin–Madison")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.45))
                }
            }
        }
    }

    private var formSection: some View {
        VStack(spacing: 16) {
            VStack(spacing: 10) {
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textContentType(.username)
                    .autocorrectionDisabled()
                    .focused($focused, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focused = .password }
                    .onChange(of: email) { session.clearError() }
                    .padding()
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color(.separator).opacity(0.6), lineWidth: 0.5)
                    )

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .focused($focused, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { submit() }
                    .onChange(of: password) { session.clearError() }
                    .padding()
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Color(.separator).opacity(0.6), lineWidth: 0.5)
                    )
            }

            if let error = session.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }

            Button {
                submit()
            } label: {
                ZStack {
                    if session.isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("Sign In").fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(
                    canSubmit
                        ? Color(red: 0.11, green: 0.11, blue: 0.11)
                        : Color(red: 0.18, green: 0.18, blue: 0.18),
                    in: RoundedRectangle(cornerRadius: 12)
                )
                .foregroundStyle(.white.opacity(canSubmit ? 1 : 0.35))
            }
            .buttonStyle(ScalePressStyle())
            .disabled(!canSubmit)

            HStack(spacing: 18) {
                Link("Forgot password?", destination: Self.forgotPasswordURL)
                Link("Need an account?", destination: Self.registerURL)
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
        }
    }
}
