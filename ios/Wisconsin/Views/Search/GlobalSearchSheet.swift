import SwiftUI

// Navigation destination enum for the search sheet
enum SearchDestination: Hashable {
    case asset(String)
    case booking(String)
    case user(String)
}

struct GlobalSearchSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results = SearchResults()
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var showScanner = false
    @State private var debounceTask: Task<Void, Never>?
    @State private var navigationPath = NavigationPath()
    @FocusState private var fieldFocused: Bool

    @State private var recentSearches: [String] = {
        (UserDefaults.standard.stringArray(forKey: "recentSearches") ?? [])
    }()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            VStack(spacing: 0) {
                searchBar
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)

                Divider()

                Group {
                    if query.isEmpty {
                        recentsView
                    } else if isSearching && results.isEmpty {
                        searchingView
                    } else if !results.isEmpty {
                        resultsList
                    } else if !isSearching {
                        noResultsView
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .navigationDestination(for: SearchDestination.self) { destination in
                switch destination {
                case .asset(let id):
                    ItemDetailView(assetId: id)
                case .booking(let id):
                    BookingDetailView(bookingId: id)
                case .user(let id):
                    UserDetailView(userId: id)
                }
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                fieldFocused = true
            }
        }
        .fullScreenCover(isPresented: $showScanner) {
            QRScannerSheet { assetId in
                showScanner = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    navigationPath.append(SearchDestination.asset(assetId))
                }
            }
        }
        .onChange(of: query) { _, newValue in
            scheduleSearch(query: newValue)
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
                .frame(width: 20)

            TextField("Search items, bookings, people…", text: $query)
                .focused($fieldFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)
                .onSubmit { commitSearch() }

            if !query.isEmpty {
                Button {
                    query = ""
                    results = SearchResults()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }

            Button {
                fieldFocused = false
                showScanner = true
            } label: {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color.accentColor)
            }
        }
        .padding(10)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - States

    private var recentsView: some View {
        Group {
            if recentSearches.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 40))
                        .foregroundStyle(.quaternary)
                    Text("Search gear, bookings, people")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 60)
            } else {
                List {
                    Section("Recent") {
                        ForEach(recentSearches, id: \.self) { term in
                            Button {
                                query = term
                            } label: {
                                Label(term, systemImage: "clock")
                                    .foregroundStyle(.primary)
                            }
                        }
                        Button("Clear Recents") {
                            recentSearches = []
                            UserDefaults.standard.removeObject(forKey: "recentSearches")
                        }
                        .foregroundStyle(.red)
                        .font(.subheadline)
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    private var searchingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Searching…")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private var noResultsView: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 40))
                .foregroundStyle(.quaternary)
            Text("No results for \"\(query)\"")
                .foregroundStyle(.secondary)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private var resultsList: some View {
        List {
            if !results.items.isEmpty {
                Section(header: sectionHeader("Items", count: results.items.count)) {
                    ForEach(results.items) { asset in
                        Button {
                            navigationPath.append(SearchDestination.asset(asset.id))
                        } label: {
                            AssetResultRow(asset: asset)
                        }
                        .buttonStyle(.plain)
                    }
                    if results.items.count >= 10 {
                        viewAllButton(label: "View all items")
                    }
                }
            }

            if !results.reservations.isEmpty {
                Section(header: sectionHeader("Reservations", count: results.reservations.count)) {
                    ForEach(results.reservations) { booking in
                        Button {
                            navigationPath.append(SearchDestination.booking(booking.id))
                        } label: {
                            BookingResultRow(booking: booking)
                        }
                        .buttonStyle(.plain)
                    }
                    if results.reservations.count >= 10 {
                        viewAllButton(label: "View all reservations")
                    }
                }
            }

            if !results.checkouts.isEmpty {
                Section(header: sectionHeader("Checkouts", count: results.checkouts.count)) {
                    ForEach(results.checkouts) { booking in
                        Button {
                            navigationPath.append(SearchDestination.booking(booking.id))
                        } label: {
                            BookingResultRow(booking: booking)
                        }
                        .buttonStyle(.plain)
                    }
                    if results.checkouts.count >= 10 {
                        viewAllButton(label: "View all checkouts")
                    }
                }
            }

            if !results.users.isEmpty {
                Section(header: sectionHeader("People", count: results.users.count)) {
                    ForEach(results.users) { user in
                        Button {
                            navigationPath.append(SearchDestination.user(user.id))
                        } label: {
                            UserResultRow(user: user)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .tracking(0.3)
    }

    private func viewAllButton(label: String) -> some View {
        Button {
            // dismiss and let caller handle deep link if needed
        } label: {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(Color.accentColor)
        }
    }

    // MARK: - Search logic

    private func scheduleSearch(query: String) {
        debounceTask?.cancel()
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else {
            results = SearchResults()
            searchError = nil
            return
        }
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await performSearch(query: q)
        }
    }

    private func commitSearch() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        debounceTask?.cancel()
        Task { await performSearch(query: q) }
        addToRecents(q)
    }

    @MainActor
    private func performSearch(query: String) async {
        isSearching = true
        searchError = nil
        defer { isSearching = false }
        do {
            results = try await SearchService.shared.search(query: query)
        } catch {
            searchError = error.localizedDescription
        }
    }

    private func addToRecents(_ term: String) {
        var recents = recentSearches.filter { $0 != term }
        recents.insert(term, at: 0)
        recentSearches = Array(recents.prefix(10))
        UserDefaults.standard.set(recentSearches, forKey: "recentSearches")
    }
}
