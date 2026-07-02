import SwiftUI

struct BookingStepHeader: View {
    let icon: String
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(Color.statusText(.purple))
                    .frame(width: 42, height: 42)
                    .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text(eyebrow)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text(title)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                }
            }

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct EventLinkingCard: View {
    let events: [ScheduleEvent]
    let selectedEvents: [ScheduleEvent]
    let isLoading: Bool
    let error: String?
    let onRetry: () -> Void
    let onToggle: (ScheduleEvent) -> Void
    let onRemove: (ScheduleEvent) -> Void

    /// Inline cap keeps the card compact; the rest live behind "All events".
    private static let inlineLimit = 4

    private var visibleEvents: [ScheduleEvent] {
        Array(events.prefix(Self.inlineLimit))
    }

    var body: some View {
        FormCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Image(systemName: "calendar")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.statusText(.purple))
                        .frame(width: 30, height: 30)
                        .background(Color.statusBackground(.purple), in: RoundedRectangle(cornerRadius: 8))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Link events")
                            .font(.headline)
                        Text("Up to 3 upcoming events")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if !selectedEvents.isEmpty {
                        Text("\(selectedEvents.count)/3")
                            .font(.caption.weight(.semibold).monospacedDigit())
                            .foregroundStyle(Color.statusText(.purple))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.statusBackground(.purple), in: Capsule())
                    }
                }

                if !selectedEvents.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(selectedEvents) { event in
                                EventChip(event: event) { onRemove(event) }
                            }
                        }
                        .padding(.vertical, 1)
                    }
                    .accessibilityLabel("Selected linked events")
                }

                if isLoading {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Loading upcoming events…")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                } else if let error {
                    HStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark")
                            .foregroundStyle(Color.statusText(.orange))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Couldn't load events")
                                .font(.subheadline.weight(.medium))
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Spacer()
                        Button("Retry", action: onRetry)
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                    }
                } else if visibleEvents.isEmpty {
                    Text("No upcoming events. You can still create an ad hoc reservation.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(visibleEvents.enumerated()), id: \.element.id) { index, event in
                            if index > 0 { Divider().padding(.leading, 42) }
                            EventPickRow(
                                event: event,
                                isSelected: selectedEvents.contains(where: { $0.id == event.id }),
                                isDisabled: selectedEvents.count >= 3 && !selectedEvents.contains(where: { $0.id == event.id })
                            ) {
                                onToggle(event)
                            }
                        }
                        if events.count > Self.inlineLimit {
                            Divider().padding(.leading, 42)
                            NavigationLink {
                                AllEventsPickerView(
                                    events: events,
                                    selectedEvents: selectedEvents,
                                    onToggle: onToggle
                                )
                            } label: {
                                HStack {
                                    Text("All events")
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(Color.statusText(.purple))
                                    Spacer()
                                    Text("\(events.count)")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .monospacedDigit()
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(.tertiary)
                                }
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("All events, \(events.count) upcoming")
                        }
                    }
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }
}

/// Full upcoming-events list behind the "All events" row: searchable, same
/// toggle semantics and 3-event cap as the inline card.
struct AllEventsPickerView: View {
    let events: [ScheduleEvent]
    let selectedEvents: [ScheduleEvent]
    let onToggle: (ScheduleEvent) -> Void

    @State private var search = ""

    private var filtered: [ScheduleEvent] {
        guard !search.trimmingCharacters(in: .whitespaces).isEmpty else { return events }
        return events.filter { event in
            event.shortBookingEventTitle.localizedCaseInsensitiveContains(search)
                || event.bookingEventSubtitle.localizedCaseInsensitiveContains(search)
        }
    }

    var body: some View {
        List {
            ForEach(filtered) { event in
                EventPickRow(
                    event: event,
                    isSelected: selectedEvents.contains(where: { $0.id == event.id }),
                    isDisabled: selectedEvents.count >= 3 && !selectedEvents.contains(where: { $0.id == event.id })
                ) {
                    onToggle(event)
                }
            }
            if filtered.isEmpty && !search.isEmpty {
                ContentUnavailableView.search(text: search)
                    .listRowBackground(Color.clear)
            }
        }
        .searchable(text: $search, prompt: "Search events")
        .navigationTitle("Events")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct EventPickRow: View {
    let event: ScheduleEvent
    let isSelected: Bool
    let isDisabled: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.statusText(.purple) : Color(.systemGray3))
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 3) {
                    Text(event.shortBookingEventTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(event.bookingEventSubtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                if let label = sportLabel(event.sportCode) {
                    Text(label)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(minHeight: 52)
            .contentShape(Rectangle())
            .opacity(isDisabled ? 0.45 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var accessibilityLabel: String {
        let selected = isSelected ? "Selected" : "Not selected"
        return "\(event.shortBookingEventTitle), \(event.bookingEventSubtitle), \(selected)"
    }
}

struct EventChip: View {
    let event: ScheduleEvent
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(event.shortBookingEventTitle)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(event.shortBookingEventTitle)")
        }
        .foregroundStyle(Color.statusText(.purple))
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color.statusBackground(.purple), in: Capsule())
    }
}
