import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focused: Field?

    enum Field { case email, password }

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
                    .autocorrectionDisabled()
                    .focused($focused, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focused = .password }
                    .padding()
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .shadow(color: .black.opacity(0.05), radius: 3, x: 0, y: 1)

                SecureField("Password", text: $password)
                    .focused($focused, equals: .password)
                    .submitLabel(.go)
                    .onSubmit {
                        guard !email.isEmpty && !password.isEmpty else { return }
                        Task { await session.login(email: email, password: password) }
                    }
                    .padding()
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .shadow(color: .black.opacity(0.05), radius: 3, x: 0, y: 1)
            }

            if let error = session.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }

            Button {
                focused = nil
                Task { await session.login(email: email, password: password) }
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
                    (email.isEmpty || password.isEmpty)
                        ? Color(red: 0.18, green: 0.18, blue: 0.18)
                        : Color(red: 0.11, green: 0.11, blue: 0.11),
                    in: RoundedRectangle(cornerRadius: 12)
                )
                .foregroundStyle(.white.opacity(email.isEmpty || password.isEmpty ? 0.35 : 1))
            }
            .buttonStyle(ScalePressStyle())
            .disabled(email.isEmpty || password.isEmpty || session.isLoading)
        }
    }
}
