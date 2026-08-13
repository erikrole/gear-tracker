import SwiftUI

struct GearOpsLoginView: View {
    let model: GearOpsModel

    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
        case password
    }

    private var canSubmit: Bool {
        email.contains("@") && !password.isEmpty && !model.isSigningIn && !model.isSigningOut
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    WisconsinCreativeIcon(size: 28)
                    Text("Wisconsin Creative")
                        .font(.title2.weight(.semibold))
                }
                Text("Live custody and kiosk health from Gear Tracker.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 10) {
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .password)
                    .onSubmit { submit() }
            }

            if let message = model.statusMessage {
                Label(message, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button(action: submit) {
                HStack {
                    Spacer()
                    if model.isSigningIn || model.isSigningOut {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(model.isSigningOut ? "Signing out…" : model.isSigningIn ? "Signing in…" : "Sign in")
                    Spacer()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSubmit)

            HStack {
                Button("Open Gear Tracker") { model.openDashboard() }
                    .buttonStyle(.link)
                Spacer()
                Button("Quit") { model.quit() }
                    .buttonStyle(.link)
            }
            .font(.footnote)
        }
        .padding(20)
        .frame(width: 360)
        .onAppear { focusedField = .email }
    }

    private func submit() {
        guard canSubmit else { return }
        focusedField = nil
        let submittedEmail = email
        let submittedPassword = password
        password = ""
        Task {
            await model.signIn(email: submittedEmail, password: submittedPassword)
        }
    }
}
