import SwiftUI
import UIKit

struct AccountSecuritySettingsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let manageAccountURL: URL

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var revokeOtherSessions = true
    @State private var showPasswords = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var successMessage: String?
    @State private var showDeleteAccount = false
    @FocusState private var focusedField: Field?

    private enum Field {
        case currentPassword
        case newPassword
        case confirmPassword
    }

    var body: some View {
        List {
            Section("Account") {
                accountIdentity
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
                    // Swapping SecureField <-> TextField changes view identity and
                    // drops keyboard focus; restore it on the next runloop pass.
                    let focus = focusedField
                    showPasswords.toggle()
                    if let focus {
                        DispatchQueue.main.async { focusedField = focus }
                    }
                } label: {
                    Label(showPasswords ? "Hide passwords" : "Show passwords", systemImage: showPasswords ? "eye.slash" : "eye")
                }
                .accessibilityValue(showPasswords ? "Passwords visible" : "Passwords hidden")
                .disabled(isSaving)

                Toggle("Sign out other devices", isOn: $revokeOtherSessions)
                    .tint(Color.statusText(.green))
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
                .tint(Color.brandPrimary)
                .disabled(!canSubmit)
            } header: {
                Text("Password")
            } footer: {
                Text("New passwords must be at least 8 characters and different from the current password.")
            }

            Section {
                Button("Delete Account", role: .destructive) {
                    showDeleteAccount = true
                }
            } header: {
                Text("Account Access")
            } footer: {
                Text("Deleting your account removes access and signs out every device. Historical custody and audit records may be retained.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Account & Security")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isSaving)
        .sheet(isPresented: $showDeleteAccount) {
            DeleteAccountView()
        }
        .onChange(of: error) { _, error in
            if let error {
                AccessibilityNotification.Announcement(error).post()
            }
        }
        .onChange(of: successMessage) { _, successMessage in
            if let successMessage {
                AccessibilityNotification.Announcement(successMessage).post()
            }
        }
    }

    @ViewBuilder
    private var accountIdentity: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 12) {
                    AccountAvatar(size: 48)
                    StatusPill.role(session.currentUser?.role ?? "")
                }
                Text(session.currentUser?.name ?? "Account")
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)
                Text(session.currentUser?.email ?? "")
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        } else {
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
        }
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
        withAnimation {
            error = nil
            successMessage = nil
        }

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
            withAnimation {
                successMessage = revokeOtherSessions
                    ? "Password changed. Other devices were signed out."
                    : "Password changed."
            }
            Haptics.success()
        } catch {
            withAnimation {
                self.error = error.localizedDescription
            }
            Haptics.warning()
        }

        isSaving = false
    }
}

private struct DeleteAccountView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var currentPassword = ""
    @State private var isDeleting = false
    @State private var error: String?
    @State private var showFinalConfirmation = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("This immediately removes your access, cancels future reservations, and signs out every device. You must return any checked-out gear first.")
                    Text("Historical custody, scheduling, and audit records may be retained for operational and legal accountability.")
                }

                Section("Confirm Your Identity") {
                    SecureField("Current password", text: $currentPassword)
                        .textContentType(.password)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .disabled(isDeleting)

                    if let error {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(Color.statusText(.red))
                    }
                }

                Section {
                    Button("Delete Account", role: .destructive) {
                        showFinalConfirmation = true
                    }
                    .frame(maxWidth: .infinity)
                    .disabled(currentPassword.isEmpty || isDeleting)
                }
            }
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isDeleting)
                }
            }
            .interactiveDismissDisabled(isDeleting)
            .confirmationDialog("Permanently delete this account?", isPresented: $showFinalConfirmation, titleVisibility: .visible) {
                Button("Delete Account", role: .destructive) {
                    Task { await deleteAccount() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This cannot be undone from the app.")
            }
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        error = nil
        do {
            try await APIClient.shared.deleteAccount(currentPassword: currentPassword)
            Haptics.success()
            await session.clearDeletedAccountLocally()
        } catch {
            self.error = error.localizedDescription
            Haptics.warning()
            isDeleting = false
        }
    }
}
