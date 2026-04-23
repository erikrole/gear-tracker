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
                VStack(spacing: 24) {
                    VStack(spacing: 6) {
                        Text("Wisconsin")
                            .font(.largeTitle.bold())
                        Text("Gear Management")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 48)

                    VStack(spacing: 12) {
                        TextField("Email", text: $email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .autocorrectionDisabled()
                            .focused($focused, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { focused = .password }
                            .padding()
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))

                        SecureField("Password", text: $password)
                            .focused($focused, equals: .password)
                            .submitLabel(.go)
                            .onSubmit {
                                guard !email.isEmpty && !password.isEmpty else { return }
                                Task { await session.login(email: email, password: password) }
                            }
                            .padding()
                            .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
                    }

                    if let error = session.error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
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
                        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                        .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
                    }
                    .disabled(email.isEmpty || password.isEmpty || session.isLoading)
                }
                .padding(.horizontal, 32)
                .frame(minHeight: geo.size.height)
                .frame(maxWidth: 440)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }
}
