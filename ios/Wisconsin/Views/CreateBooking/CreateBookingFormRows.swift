import SwiftUI

// MARK: - Form Card Components

struct FormCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content()
        }
        .brandCard()
    }
}

struct FormPickerRow<Leading: View>: View {
    let label: String
    let value: String
    @ViewBuilder var leading: () -> Leading

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
            leading()
            Text(value)
                .font(.body)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .layoutPriority(1)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .frame(minHeight: 36)
        .contentShape(Rectangle())
    }
}

extension FormPickerRow where Leading == EmptyView {
    init(label: String, value: String) {
        self.init(label: label, value: value) { EmptyView() }
    }
}

extension ScheduleEvent {
    var shortBookingEventTitle: String {
        let code = sportCode?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let code, !code.isEmpty, let opponent, !opponent.isEmpty {
            let prefix = isHome == false ? "at" : "vs"
            return "\(code) \(prefix) \(opponent)"
        }
        return summary
    }

    var bookingEventSubtitle: String {
        let when = startsAt.formatted(date: .abbreviated, time: allDay ? .omitted : .shortened)
        let venue = location?.name
        let venuePrefix: String?
        if isHome == false {
            venuePrefix = "Away"
        } else if isHome == true {
            venuePrefix = "Home"
        } else {
            venuePrefix = nil
        }
        return [when, venuePrefix, venue].compactMap { $0 }.joined(separator: " · ")
    }

    var bookingEventScopeLabel: String {
        let hasOpponent = opponent?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        guard hasOpponent else { return "Non-game" }
        return switch isHome {
        case true: "Home"
        case false: "Away"
        case nil: "Neutral"
        }
    }

    var bookingEventPickerDate: String {
        let month = startsAt.formatted(.dateTime.month(.abbreviated))
        return startsAt
            .formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
            .replacingOccurrences(of: "\(month) ", with: "\(month). ")
    }

    var bookingEventPickerVenue: String? {
        let source = location?.name ?? rawLocationText
        guard var venue = source?
            .split(separator: ",")
            .last?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !venue.isEmpty else { return nil }

        venue = venue.replacingOccurrences(of: "Track/Soccer", with: "Soccer")
        return venue
    }

    var bookingEventPickerDetail: String {
        guard let venue = bookingEventPickerVenue else { return bookingEventPickerDate }
        return "\(bookingEventPickerDate), \(venue)"
    }

    var bookingEventRailColor: Color {
        venueRailColor(isHome: isHome)
    }
}
