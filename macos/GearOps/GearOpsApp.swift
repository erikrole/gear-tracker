import SwiftUI

@main
struct GearOpsApp: App {
    @NSApplicationDelegateAdaptor(GearOpsAppDelegate.self) private var appDelegate
    @State private var model = GearOpsModel()

    var body: some Scene {
        MenuBarExtra {
            MenuBarContentView(model: model)
        } label: {
            HStack(spacing: 4) {
                Image(systemName: model.menuBarSymbol)
                if let count = model.snapshot?.stats.checkedOut {
                    Text(count, format: .number)
                        .monospacedDigit()
                }
            }
            .accessibilityLabel(model.menuBarAccessibilityLabel)
        }
        .menuBarExtraStyle(.window)
    }
}
