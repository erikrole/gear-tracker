import SwiftUI
import UIKit

struct EarnedBadgeReward: Codable, Equatable, Identifiable, Hashable {
    let id: String
    let definitionId: String
    let key: String
    let name: String
    let description: String
    let icon: String
    let category: String
    let rarity: String
    let awardedAt: String

    var symbolName: String {
        switch icon {
        case "AlarmClockCheck", "Clock3": "clock.badge.checkmark.fill"
        case "Aperture": "camera.aperture"
        case "AudioLines": "waveform"
        case "BadgeCheck", "ShieldCheck": "checkmark.seal.fill"
        case "BatteryCharging": "battery.100percent.bolt"
        case "BatteryLow": "battery.25"
        case "Truck": "truck.box.fill"
        case "ArrowLeftRight": "arrow.left.arrow.right"
        case "Timer": "timer"
        case "AlarmClock": "alarm.fill"
        case "Clapperboard": "clapperboard.fill"
        case "Gift": "gift.fill"
        case "Binoculars": "binoculars.fill"
        case "Boxes": "shippingbox.and.arrow.backward.fill"
        case "BusFront": "bus.fill"
        case "Cable": "cable.connector"
        case "Camera": "camera.fill"
        case "CalendarCheck2": "calendar.badge.checkmark"
        case "CalendarClock": "calendar.badge.clock"
        case "CalendarDays", "CalendarRange": "calendar"
        case "Flame": "flame.fill"
        case "Focus": "viewfinder"
        case "HardDrive": "externaldrive.fill"
        case "CloudRain": "cloud.rain.fill"
        case "Combine": "arrow.triangle.merge"
        case "Dumbbell": "dumbbell.fill"
        case "Handshake": "person.2.fill"
        case "LayoutGrid": "square.grid.3x3.fill"
        case "Lightbulb": "lightbulb.fill"
        case "PackageCheck": "shippingbox.fill"
        case "PackageOpen": "shippingbox"
        case "LifeBuoy": "lifepreserver.fill"
        case "MoonStar": "moon.stars.fill"
        case "QrCode", "ScanLine", "ScanSearch": "qrcode.viewfinder"
        case "Repeat2": "arrow.triangle.2.circlepath"
        case "ShoppingCart": "cart.fill"
        case "Sunrise": "sunrise.fill"
        case "Sunset": "sunset.fill"
        case "Shuffle": "shuffle"
        case "Ticket": "ticket.fill"
        case "Trophy": "trophy.fill"
        case "UserCheck": "person.crop.circle.badge.checkmark"
        case "Warehouse": "building.2.fill"
        default: "trophy.fill"
        }
    }
}

struct RecentBadgeRewards: Decodable {
    let awards: [EarnedBadgeReward]
    let nextCursor: String
}

extension Array where Element == EarnedBadgeReward {
    mutating func appendUnique(contentsOf rewards: [EarnedBadgeReward]) {
        let existing = Set(map(\.id))
        append(contentsOf: rewards.filter { !existing.contains($0.id) })
    }
}

struct BadgeEarnedCelebrationView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let reward: EarnedBadgeReward
    let remaining: Int
    let onDismiss: () -> Void
    @State private var appeared = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.58)
                .ignoresSafeArea()
                .onTapGesture(perform: onDismiss)

            VStack(spacing: 0) {
                VStack(spacing: 18) {
                    Text("BADGE EARNED")
                        .font(.caption.weight(.heavy))
                        .tracking(2.2)
                        .foregroundStyle(.secondary)

                    ZStack {
                        Circle()
                            .fill(reward.accentColor.opacity(0.16))
                            .frame(width: 138, height: 138)
                            .blur(radius: appeared && !reduceMotion ? 12 : 4)
                        Circle()
                            .fill(reward.accentColor.gradient)
                            .frame(width: 104, height: 104)
                            .shadow(color: reward.accentColor.opacity(0.35), radius: 22, y: 10)
                        Image(systemName: reward.symbolName)
                            .font(.system(size: 43, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .scaleEffect(appeared || reduceMotion ? 1 : 0.66)

                    VStack(spacing: 9) {
                        Text(reward.name)
                            .font(.largeTitle.weight(.bold))
                            .multilineTextAlignment(.center)
                        Text(reward.description)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    HStack(spacing: 8) {
                        rewardChip(reward.rarity)
                        rewardChip(reward.category.replacingOccurrences(of: "_", with: " ").capitalized)
                    }
                }
                .padding(.horizontal, 30)
                .padding(.top, 34)
                .padding(.bottom, 28)

                Divider()

                Button(action: onDismiss) {
                    Text(remaining > 0 ? "Next badge (\(remaining))" : "Nice")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(reward.accentColor)
                .padding(18)
            }
            .frame(maxWidth: 430)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .stroke(.white.opacity(0.16), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.34), radius: 36, y: 18)
            .padding(24)
            .opacity(appeared || reduceMotion ? 1 : 0)
            .offset(y: appeared || reduceMotion ? 0 : 18)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Badge earned. \(reward.name). \(reward.description)")
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.78)) {
                    appeared = true
                }
            }
            UIAccessibility.post(
                notification: .announcement,
                argument: "Badge earned. \(reward.name). \(reward.description)"
            )
        }
        .sensoryFeedback(.success, trigger: appeared)
    }

    private func rewardChip(_ title: String) -> some View {
        Text(title)
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.thinMaterial, in: Capsule())
    }
}

private extension EarnedBadgeReward {
    var accentColor: Color {
        switch rarity.lowercased() {
        case "legendary": .purple
        case "rare": .orange
        case "uncommon": .blue
        default: Color(red: 0.78, green: 0.05, blue: 0.12)
        }
    }
}
