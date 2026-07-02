import SwiftUI

// MARK: - Sleep overlay
//
// Near-black burn-in-safe standby overlay. The whole cluster pixel-shifts on
// a 30-second cadence so nothing crisp sits in one place on the always-on
// panel. Extracted verbatim from KioskIdleView.swift (2026-07-02 rework
// Slice 5a).

struct KioskSleepModeView: View {
    let deviceName: String
    let reason: String
    let onWake: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { context in
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(alignment: .leading, spacing: 8) {
                    Text(context.date.kioskClockParts().time)
                        .font(.gothamBlack(size: 58))
                        .foregroundStyle(Color.white.opacity(0.42))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text(sleepLabel)
                        .font(.gothamBold(size: 15))
                        .tracking(1.2)
                        .foregroundStyle(Color.white.opacity(0.64))
                        .textCase(.uppercase)
                    Text(deviceName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.white.opacity(0.42))
                    HStack(spacing: 6) {
                        Image(systemName: "hand.tap.fill")
                            .font(.caption2)
                        Text("Tap anywhere to wake")
                            .font(.caption2.weight(.semibold))
                    }
                    .foregroundStyle(Color.white.opacity(0.5))
                    .padding(.top, 6)
                }
                .offset(pixelShiftOffset(for: context.date))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Kiosk sleep mode. Tap to wake.")
            }
            .contentShape(Rectangle())
            .onTapGesture { onWake() }
        }
    }

    private var sleepLabel: String {
        if reason == "debug_night_mode" { return "Debug night mode" }
        return reason == "night_hours" ? "Night sleep mode" : "Idle sleep mode"
    }

    private func pixelShiftOffset(for date: Date) -> CGSize {
        let components = Calendar.current.dateComponents([.minute, .second], from: date)
        let minute = components.minute ?? 0
        let second = components.second ?? 0
        let slot = (minute * 2) + (second >= 30 ? 1 : 0)
        let x = CGFloat((slot % 9) - 4) * 38
        let y = CGFloat(((slot / 9) % 7) - 3) * 28
        return CGSize(width: x, height: y)
    }
}
