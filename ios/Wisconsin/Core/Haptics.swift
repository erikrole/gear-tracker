import SwiftUI
import UIKit

/// Single source of truth for haptic feedback across the app.
/// Use over raw `UINotificationFeedbackGenerator` / `.sensoryFeedback` in new code.
enum Haptics {
    /// Confirmation of a successful mutation (booking created, trade claimed, etc.).
    @MainActor static func success() {
        let gen = UINotificationFeedbackGenerator()
        gen.notificationOccurred(.success)
    }

    /// Surfaced error or warning.
    @MainActor static func error() {
        let gen = UINotificationFeedbackGenerator()
        gen.notificationOccurred(.error)
    }

    /// Warning / non-blocking notice.
    @MainActor static func warning() {
        let gen = UINotificationFeedbackGenerator()
        gen.notificationOccurred(.warning)
    }

    /// Selection change — toggles, segmented controls, picker rows.
    @MainActor static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    /// Lightweight tap — primary action presses.
    @MainActor static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
