import SwiftUI

@MainActor
@Observable
final class GuidesViewModel {
    var guides: [GuideListItem] = []
    var isLoading = false
    var error: String?

    private var lastLoadedAt: Date?
    private static let freshnessWindow: TimeInterval = 60

    func load(forceRefresh: Bool = false) async {
        if !forceRefresh,
           let lastLoadedAt,
           Date().timeIntervalSince(lastLoadedAt) < Self.freshnessWindow,
           !guides.isEmpty {
            return
        }
        guard !isLoading else { return }

        isLoading = true
        if forceRefresh { error = nil }

        do {
            guides = try await APIClient.shared.guides()
            error = nil
            lastLoadedAt = Date()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}

struct GuidesView: View {
    var wrapsInNavigationStack = true

    @Environment(SessionStore.self) private var session
    @State private var vm = GuidesViewModel()
    @State private var searchText = ""
    @State private var focus: GuideFocus = .all
    @State private var sort: GuideSort = .recommended

    private var filteredGuides: [GuideListItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let currentRole = session.currentUser?.role ?? ""
        let visible = vm.guides.filter { guide in
            focus.includes(guide, currentRole: currentRole) &&
                (query.isEmpty || guide.searchText.contains(query))
        }

        switch sort {
        case .recommended:
            return visible
        case .recent:
            return visible.sorted { guideDate($0.updatedAt) > guideDate($1.updatedAt) }
        case .title:
            return visible.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }
    }

    var body: some View {
        if wrapsInNavigationStack {
            NavigationStack { configuredContent }
        } else {
            configuredContent
        }
    }

    private var configuredContent: some View {
        content
            .navigationTitle("Guides")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $searchText,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: Text("Search guides")
            )
            .refreshable { await vm.load(forceRefresh: true) }
            .task { await vm.load() }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Picker("Focus", selection: $focus) {
                            ForEach(GuideFocus.allCases) { focus in
                                Label(focus.label, systemImage: focus.systemImage).tag(focus)
                            }
                        }
                    } label: {
                        Label("Focus", systemImage: "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityLabel("Guide focus")

                    Menu {
                        Picker("Sort", selection: $sort) {
                            ForEach(GuideSort.allCases) { sort in
                                Text(sort.label).tag(sort)
                            }
                        }
                    } label: {
                        Label("Sort", systemImage: "arrow.up.arrow.down")
                    }
                    .accessibilityLabel("Sort guides")
                }
            }
    }

    @ViewBuilder
    private var content: some View {
        if vm.guides.isEmpty && vm.isLoading {
            guidePlaceholderList
        } else if let error = vm.error, vm.guides.isEmpty {
            ContentUnavailableView {
                Label("Couldn't load guides", systemImage: "exclamationmark.triangle")
            } description: {
                Text(error)
            } actions: {
                Button("Retry") { Task { await vm.load(forceRefresh: true) } }
                    .buttonStyle(.borderedProminent)
            }
        } else if vm.guides.isEmpty {
            ContentUnavailableView(
                "No guides",
                systemImage: "book.closed",
                description: Text("Published guides will appear here.")
            )
        } else {
            guideList
        }
    }

    private var guidePlaceholderList: some View {
        List {
            Section {
                ForEach(GuideListItem.placeholders) { guide in
                    GuideRow(guide: guide)
                        .redacted(reason: .placeholder)
                }
            }
        }
        .listStyle(.insetGrouped)
        .disabled(true)
    }

    private var guideList: some View {
        List {
            if let error = vm.error {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Retry") { Task { await vm.load(forceRefresh: true) } }
                            .buttonStyle(.bordered)
                    }
                    .padding(.vertical, 2)
                }
            }

            Section {
                ForEach(filteredGuides) { guide in
                    NavigationLink {
                        GuideReaderView(guide: guide)
                    } label: {
                        GuideRow(guide: guide)
                    }
                }
            } header: {
                Text(listHeader)
            }

            if filteredGuides.isEmpty {
                Section {
                    ContentUnavailableView(
                        "No guides match",
                        systemImage: "magnifyingglass",
                        description: Text("Try a different search or focus.")
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var listHeader: String {
        let count = filteredGuides.count
        let total = vm.guides.count
        if searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && focus == .all {
            return total == 1 ? "1 guide" : "\(total) guides"
        }
        return "\(count) of \(total)"
    }
}

private struct GuideRow: View {
    let guide: GuideListItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.statusBackground(guide.type.tone))
                Image(systemName: guide.type.systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.statusText(guide.type.tone))
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(guide.title)
                        .font(.headline)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                    if !guide.published {
                        StatusPill(label: "Draft", tone: .gray)
                    }
                }

                if !guide.summary.isEmpty {
                    Text(guide.summary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                HStack(spacing: 8) {
                    StatusPill(label: guide.type.label, tone: guide.type.tone)
                    Text(guide.updatedSummary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

private struct GuideReaderView: View {
    let guide: GuideListItem

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(guide.title)
                        .font(.gothamBold(size: 30))
                        .lineLimit(4)
                        .minimumScaleFactor(0.78)

                    HStack(spacing: 8) {
                        StatusPill(label: guide.type.label, tone: guide.type.tone)
                        if !guide.category.isEmpty && guide.category != guide.type.label {
                            StatusPill(label: guide.category, tone: .gray)
                        }
                        if !guide.published {
                            StatusPill(label: "Draft", tone: .gray)
                        }
                    }

                    Text("Updated \(guide.updatedSummary) by \(guide.author.name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                NativeMarkdownArticle(markdown: guide.markdown)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 22)
            .frame(maxWidth: 820, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Guide")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeMarkdownArticle: View {
    let markdown: String

    private var blocks: [MarkdownBlock] {
        MarkdownBlock.parse(markdown.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if blocks.isEmpty {
                Text("No content yet.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(blocks) { block in
                    blockView(block)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cardSurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.hairline, lineWidth: 0.5)
        }
    }

    @ViewBuilder
    private func blockView(_ block: MarkdownBlock) -> some View {
        switch block.kind {
        case .heading(let level, let text):
            Text(text)
                .font(headingFont(level))
                .foregroundStyle(.primary)
                .padding(.top, level == 1 ? 4 : 10)
        case .paragraph(let text):
            inlineText(text)
                .font(.body)
                .lineSpacing(4)
                .textSelection(.enabled)
        case .bullet(let text):
            HStack(alignment: .firstTextBaseline, spacing: 9) {
                Text("•").foregroundStyle(.secondary)
                inlineText(text).font(.body).lineSpacing(4)
            }
            .textSelection(.enabled)
        case .numbered(let text):
            HStack(alignment: .firstTextBaseline, spacing: 9) {
                Text("1.").foregroundStyle(.secondary)
                inlineText(text).font(.body).lineSpacing(4)
            }
            .textSelection(.enabled)
        case .quote(let text):
            HStack(alignment: .top, spacing: 10) {
                Rectangle()
                    .fill(Color.brandPrimary.opacity(0.55))
                    .frame(width: 3)
                inlineText(text)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)
            }
            .textSelection(.enabled)
        case .code(let text), .table(let text):
            ScrollView(.horizontal, showsIndicators: false) {
                Text(text)
                    .font(.system(.footnote, design: .monospaced))
                    .textSelection(.enabled)
                    .padding(12)
                    .background(Color.cardSurfaceRaised, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        case .image(let alt, let url):
            if let url = URL(string: url) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    case .failure:
                        imageFallback(alt)
                    case .empty:
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.cardSurfaceRaised)
                            .frame(minHeight: 180)
                            .overlay { ProgressView() }
                    @unknown default:
                        imageFallback(alt)
                    }
                }
            } else {
                imageFallback(alt)
            }
        case .rule:
            Divider().padding(.vertical, 4)
        }
    }

    private func inlineText(_ markdown: String) -> Text {
        if let attributed = try? AttributedString(markdown: markdown, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            return Text(attributed)
        }
        return Text(markdown)
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: .title2.weight(.bold)
        case 2: .title3.weight(.semibold)
        default: .headline
        }
    }

    private func imageFallback(_ alt: String) -> some View {
        Label(alt.isEmpty ? "Image unavailable" : alt, systemImage: "photo")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 140)
            .background(Color.cardSurfaceRaised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct MarkdownBlock: Identifiable {
    enum Kind {
        case heading(level: Int, text: String)
        case paragraph(String)
        case bullet(String)
        case numbered(String)
        case quote(String)
        case code(String)
        case table(String)
        case image(alt: String, url: String)
        case rule
    }

    let id = UUID()
    let kind: Kind

    static func parse(_ markdown: String) -> [MarkdownBlock] {
        guard !markdown.isEmpty else { return [] }
        var blocks: [MarkdownBlock] = []
        var paragraph: [String] = []
        var codeLines: [String] = []
        var inCodeFence = false

        func flushParagraph() {
            let text = paragraph.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { blocks.append(MarkdownBlock(kind: .paragraph(text))) }
            paragraph.removeAll()
        }

        for rawLine in markdown.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)

            if line.hasPrefix("```") {
                if inCodeFence {
                    blocks.append(MarkdownBlock(kind: .code(codeLines.joined(separator: "\n"))))
                    codeLines.removeAll()
                    inCodeFence = false
                } else {
                    flushParagraph()
                    inCodeFence = true
                }
                continue
            }

            if inCodeFence {
                codeLines.append(rawLine)
                continue
            }

            if line.isEmpty {
                flushParagraph()
                continue
            }

            if line == "---" || line == "***" {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .rule))
                continue
            }

            if let image = parseImage(line) {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .image(alt: image.alt, url: image.url)))
                continue
            }

            if line.hasPrefix("|") && line.hasSuffix("|") {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .table(line)))
                continue
            }

            if let heading = parseHeading(line) {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .heading(level: heading.level, text: heading.text)))
                continue
            }

            if line.hasPrefix("- ") || line.hasPrefix("* ") {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .bullet(String(line.dropFirst(2)))))
                continue
            }

            if let numbered = parseNumbered(line) {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .numbered(numbered)))
                continue
            }

            if line.hasPrefix(">") {
                flushParagraph()
                blocks.append(MarkdownBlock(kind: .quote(String(line.dropFirst()).trimmingCharacters(in: .whitespaces))))
                continue
            }

            paragraph.append(line)
        }

        if inCodeFence {
            blocks.append(MarkdownBlock(kind: .code(codeLines.joined(separator: "\n"))))
        }
        flushParagraph()
        return blocks
    }

    private static func parseHeading(_ line: String) -> (level: Int, text: String)? {
        let markerCount = line.prefix(while: { $0 == "#" }).count
        guard markerCount > 0, markerCount <= 6 else { return nil }
        let text = line.dropFirst(markerCount).trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }
        return (markerCount, text)
    }

    private static func parseNumbered(_ line: String) -> String? {
        guard let dot = line.firstIndex(of: ".") else { return nil }
        let prefix = line[..<dot]
        guard !prefix.isEmpty, prefix.allSatisfy(\.isNumber) else { return nil }
        let text = line[line.index(after: dot)...].trimmingCharacters(in: .whitespaces)
        return text.isEmpty ? nil : text
    }

    private static func parseImage(_ line: String) -> (alt: String, url: String)? {
        guard line.hasPrefix("!["), let closeAlt = line.firstIndex(of: "]") else { return nil }
        let afterAlt = line[line.index(after: closeAlt)...]
        guard afterAlt.hasPrefix("("), afterAlt.hasSuffix(")") else { return nil }
        let alt = String(line[line.index(line.startIndex, offsetBy: 2)..<closeAlt])
        let url = String(afterAlt.dropFirst().dropLast())
        return url.isEmpty ? nil : (alt, url)
    }
}

private enum GuideFocus: String, CaseIterable, Identifiable {
    case all
    case recent
    case myArea
    case contacts
    case buildingNumbers
    case mediaDrive
    case serverPaths
    case sop
    case howTo
    case troubleshooting
    case accountNote
    case eventOps
    case general

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All guides"
        case .recent: "Recently updated"
        case .myArea: "My area"
        case .contacts: ResourceType.contacts.label
        case .buildingNumbers: ResourceType.buildingNumbers.label
        case .mediaDrive: ResourceType.mediaDrive.label
        case .serverPaths: ResourceType.serverPaths.label
        case .sop: ResourceType.sop.label
        case .howTo: ResourceType.howTo.label
        case .troubleshooting: ResourceType.troubleshooting.label
        case .accountNote: ResourceType.accountNote.label
        case .eventOps: ResourceType.eventOps.label
        case .general: ResourceType.general.label
        }
    }

    var systemImage: String {
        switch self {
        case .all: "book.closed"
        case .recent: "clock"
        case .myArea: "person.crop.circle"
        case .contacts: ResourceType.contacts.systemImage
        case .buildingNumbers: ResourceType.buildingNumbers.systemImage
        case .mediaDrive: ResourceType.mediaDrive.systemImage
        case .serverPaths: ResourceType.serverPaths.systemImage
        case .sop: ResourceType.sop.systemImage
        case .howTo: ResourceType.howTo.systemImage
        case .troubleshooting: ResourceType.troubleshooting.systemImage
        case .accountNote: ResourceType.accountNote.systemImage
        case .eventOps: ResourceType.eventOps.systemImage
        case .general: ResourceType.general.systemImage
        }
    }

    func includes(_ guide: GuideListItem, currentRole: String) -> Bool {
        switch self {
        case .all:
            true
        case .recent:
            Date().timeIntervalSince(guideDate(guide.updatedAt)) <= 60 * 60 * 24 * 30
        case .myArea:
            guide.personalizationReason != "General" || guide.targetRoles.contains(currentRole)
        case .contacts:
            guide.type == .contacts
        case .buildingNumbers:
            guide.type == .buildingNumbers
        case .mediaDrive:
            guide.type == .mediaDrive
        case .serverPaths:
            guide.type == .serverPaths
        case .sop:
            guide.type == .sop
        case .howTo:
            guide.type == .howTo
        case .troubleshooting:
            guide.type == .troubleshooting
        case .accountNote:
            guide.type == .accountNote
        case .eventOps:
            guide.type == .eventOps
        case .general:
            guide.type == .general || guide.type == .unknown
        }
    }
}

private enum GuideSort: String, CaseIterable, Identifiable {
    case recommended
    case recent
    case title

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recommended: "Recommended"
        case .recent: "Recently updated"
        case .title: "Title A-Z"
        }
    }
}

private extension GuideListItem {
    var updatedSummary: String {
        let date = guideDate(updatedAt)
        guard date != .distantPast else { return "Updated" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    var searchText: String {
        [
            title,
            category,
            type.label,
            author.name,
            summary,
            markdown,
            targetRoles.joined(separator: " "),
            targetAreas.joined(separator: " "),
        ].joined(separator: " ").lowercased()
    }

    static var placeholders: [GuideListItem] {
        (0..<5).map { index in
            GuideListItem.placeholder(index: index)
        }
    }

    private static func placeholder(index: Int) -> GuideListItem {
        let json = """
        {
          "id": "placeholder-\(index)",
          "title": "Guide placeholder",
          "slug": "placeholder-\(index)",
          "type": "GENERAL",
          "category": "General Info",
          "summary": "Guide preview placeholder",
          "markdown": "Guide content",
          "author": { "id": "placeholder-author", "name": "Creative" }
        }
        """.data(using: .utf8)!
        return (try? JSONDecoder().decode(GuideListItem.self, from: json))!
    }
}

private func guideDate(_ raw: String?) -> Date {
    guard let raw, !raw.isEmpty else { return .distantPast }
    return GuideDateFormatters.fractional.date(from: raw)
        ?? GuideDateFormatters.standard.date(from: raw)
        ?? .distantPast
}

private enum GuideDateFormatters {
    static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
