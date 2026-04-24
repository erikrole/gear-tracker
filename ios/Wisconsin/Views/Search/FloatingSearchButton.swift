import SwiftUI

struct FloatingSearchButton: View {
    @Binding var isPresented: Bool
    @State private var hapticTrigger = false

    var body: some View {
        Button {
            hapticTrigger.toggle()
            isPresented = true
        } label: {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(
                    LinearGradient(
                        colors: [Color.accentColor, Color.accentColor.opacity(0.75)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: Circle()
                )
                .shadow(color: Color.accentColor.opacity(0.35), radius: 8, x: 0, y: 4)
                .shadow(color: .black.opacity(0.12), radius: 3, x: 0, y: 2)
        }
        .buttonStyle(FABButtonStyle())
        .accessibilityLabel("Search")
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.8), trigger: hapticTrigger)
    }
}

private struct FABButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? (reduceMotion ? 1.0 : 0.91) : 1.0)
            .animation(reduceMotion ? nil : .spring(response: 0.18, dampingFraction: 0.55), value: configuration.isPressed)
    }
}
