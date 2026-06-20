import SwiftUI
import UIKit

struct AccountSecuritySettingsView: View {
    @Environment(SessionStore.self) private var session
    let manageAccountURL: URL

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var revokeOtherSessions = true
    @State private var showPasswords = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var successMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field {
        case currentPassword
        case newPassword
        case confirmPassword
    }

    var body: some View {
        List {
            Section("Account") {
                HStack(spacing: 14) {
                    AccountAvatar(size: 48)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(session.currentUser?.name ?? "Account")
                            .font(.headline)
                        Text(session.currentUser?.email ?? "")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 12)
                    StatusPill.role(session.currentUser?.role ?? "")
                }
                .padding(.vertical, 4)

                Link(destination: manageAccountURL) {
                    SettingsMenuRow(
                        title: "Manage profile on web",
                        subtitle: "Edit profile fields and review active sessions.",
                        systemImage: "globe",
                        tint: Color.statusText(.blue)
                    ) {
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Section {
                passwordField(
                    title: "Current password",
                    text: $currentPassword,
                    contentType: .password,
                    focus: .currentPassword,
                    submitLabel: .next
                ) {
                    focusedField = .newPassword
                }

                passwordField(
                    title: "New password",
                    text: $newPassword,
                    contentType: .newPassword,
                    focus: .newPassword,
                    submitLabel: .next
                ) {
                    focusedField = .confirmPassword
                }

                passwordField(
                    title: "Confirm new password",
                    text: $confirmPassword,
                    contentType: .newPassword,
                    focus: .confirmPassword,
                    submitLabel: .go
                ) {
                    Task { await savePassword() }
                }

                Button {
                    showPasswords.toggle()
                } label: {
                    Label(showPasswords ? "Hide passwords" : "Show passwords", systemImage: showPasswords ? "eye.slash" : "eye")
                }
                .accessibilityValue(showPasswords ? "Passwords visible" : "Passwords hidden")
                .disabled(isSaving)

                Toggle("Sign out other devices", isOn: $revokeOtherSessions)
                    .disabled(isSaving)

                if let validationMessage {
                    Text(validationMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.orange))
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.red))
                }

                if let successMessage {
                    Text(successMessage)
                        .font(.footnote)
                        .foregroundStyle(Color.statusText(.green))
                }

                Button {
                    Task { await savePassword() }
                } label: {
                    HStack {
                        if isSaving {
                            ProgressView().controlSize(.small)
                        }
                        Text(isSaving ? "Saving…" : "Change Password")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit)
            } header: {
                Text("Password")
            } footer: {
                Text("New passwords must be at least 8 characters and different from the current password.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Account & Security")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isSaving)
    }

    @ViewBuilder
    private func passwordField(
        title: String,
        text: Binding<String>,
        contentType: UITextContentType,
        focus: Field,
        submitLabel: SubmitLabel,
        onSubmit: @escaping () -> Void
    ) -> some View {
        Group {
            if showPasswords {
                TextField(title, text: text)
            } else {
                SecureField(title, text: text)
            }
        }
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .textContentType(contentType)
        .submitLabel(submitLabel)
        .focused($focusedField, equals: focus)
        .disabled(isSaving)
        .onSubmit(onSubmit)
    }

    private var validationMessage: String? {
        if currentPassword.isEmpty && newPassword.isEmpty && confirmPassword.isEmpty { return nil }
        if currentPassword.isEmpty { return "Current password is required." }
        if newPassword.count < 8 { return "Use at least 8 characters." }
        if !confirmPassword.isEmpty && newPassword != confirmPassword { return "Passwords do not match." }
        if !newPassword.isEmpty && currentPassword == newPassword { return "Choose a password that is different from your current password." }
        return nil
    }

    private var canSubmit: Bool {
        !currentPassword.isEmpty &&
        newPassword.count >= 8 &&
        newPassword == confirmPassword &&
        currentPassword != newPassword &&
        !isSaving
    }

    private func savePassword() async {
        guard canSubmit else {
            Haptics.warning()
            return
        }

        isSaving = true
        error = nil
        successMessage = nil

        do {
            try await APIClient.shared.changePassword(
                currentPassword: currentPassword,
                newPassword: newPassword,
                revokeOtherSessions: revokeOtherSessions
            )
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
            focusedField = nil
            successMessage = revokeOtherSessions
                ? "Password changed. Other devices were signed out."
                : "Password changed."
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
        }

        isSaving = false
    }
}
