import SwiftUI

struct BookshelfView: View {
    var onNewReading: () -> Void
    @EnvironmentObject private var auth: AuthStore
    @State private var readings: [ReadingSummary] = []
    @State private var books: [AIBook] = []
    @State private var nextCursor: UUID?
    @State private var loaded: AccountScope?
    @State private var isLoading = false
    @State private var error: String?
    @State private var showsComposer = false
    @Environment(\.dynamicTypeSize) private var dynamicType
    private var columns: [GridItem] { Array(repeating: GridItem(.flexible(), spacing: 18), count: dynamicType.isAccessibilitySize ? 1 : 2) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                FateEditorialHero(eyebrow: "YOUR LIBRARY", title: "あなたの本棚", subtitle: "そのときの想いと、読み返したい言葉を。")
                    .padding(.top, 12)
                if auth.session == nil {
                    FLEmptyState(title: "言葉を、本棚に残す", message: "ログインすると、保存した鑑定書をいつでも読み返せます。")
                } else {
                    if isLoading && loaded == nil { FateInlineLoading(title: "本棚を開いています") }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(FateTheme.danger)
                        Button("再読み込み") { Task { await load(force: true) } }
                    }
                    if !books.isEmpty {
                        HStack { Text("相談の鑑定書").font(FateType.sectionTitle); Spacer(); Text("\(books.count)冊").font(.caption).foregroundStyle(FateTheme.muted) }
                        LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                            ForEach(books) { book in
                                NavigationLink { AIBookDetailView(initial: book) { updated in
                                    if let index = books.firstIndex(where: { $0.id == updated.id }) {
                                        books[index] = updated
                                        saveCache(owner: AccountScope(auth))
                                    }
                                } } label: {
                                    BookCover(title: book.title, subtitle: book.targetTitle, date: book.createdAt, badge: book.stateLabel, index: 10)
                                }.buttonStyle(.plain)
                            }
                        }
                        if nextCursor != nil { Button("前の鑑定書をもっと見る") { Task { await loadMore() } }.disabled(isLoading) }
                    }
                    if !readings.isEmpty {
                        HStack { Text("あなたと、ふたり").font(FateType.sectionTitle); Spacer(); Text("\(readings.count)冊").font(.caption).foregroundStyle(FateTheme.muted) }
                        LazyVGrid(columns: columns, alignment: .leading, spacing: 26) {
                            ForEach(readings) { reading in
                                NavigationLink { SavedReadingView(conversationID: reading.id, readingKind: reading.kind) } label: {
                                    BookCover(title: reading.title, subtitle: reading.isCompatibility ? "ふたりの鑑定" : "あなたの鑑定", date: reading.createdAt ?? "", badge: nil, index: reading.isCompatibility ? 10 : 0)
                                }.buttonStyle(.plain)
                            }
                        }
                    }
                    if loaded != nil && !isLoading && error == nil && books.isEmpty && readings.isEmpty {
                        FLEmptyState(title: "最初の一冊から", message: "生まれたときの情報から、あなたの鑑定書をつくれます。")
                    }
                    Label("完成した鑑定書は、いつでもここから。", systemImage: "bookmark")
                        .font(.footnote).foregroundStyle(FateTheme.muted).lineSpacing(4)
                }
            }.padding(.horizontal, 20).padding(.bottom, 36)
        }
        .background(FateTheme.canvas)
        .refreshable { await load(force: true) }
        .task(id: AccountScope(auth)) { await load(force: true) }
        .sheet(isPresented: $showsComposer, onDismiss: { Task { await load(force: true) } }) {
            NavigationStack { AIBookComposeView(readings: readings) }
        }
    }
    private func load(force: Bool = false) async {
        let owner = AccountScope(auth)
        if loaded != owner {
            readings = []; books = []; nextCursor = nil; loaded = nil
            isLoading = false
            if let cached = BookshelfMemoryCache.shared.value(for: owner) {
                readings = cached.readings; books = cached.books
                nextCursor = cached.nextCursor; loaded = owner
            }
        }
        guard owner.userID != nil, !isLoading, force || loaded != owner else { return }
        isLoading = true; error = nil
        defer { if owner.isCurrent(auth) { isLoading = false } }
        // Publish each independent result immediately; a slow/failed endpoint cannot block the other shelf.
        async let readingLoad: Void = loadReadings(owner: owner)
        async let bookLoad: Void = loadBooks(owner: owner)
        _ = await (readingLoad, bookLoad)
    }
    private func loadReadings(owner: AccountScope) async {
        do {
            let result = try await APIClient.shared.readings(auth: auth)
            try owner.check(auth)
            readings = result.filter { !$0.isChat }; loaded = owner
            saveCache(owner: owner)
        } catch is CancellationError { }
        catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
    private func loadBooks(owner: AccountScope) async {
        do {
            let page = try await APIClient.shared.bookCall(AIBookPage.self, path: "", auth: auth)
            try owner.check(auth)
            books = page.books; nextCursor = page.nextCursor; loaded = owner
            saveCache(owner: owner)
        } catch is CancellationError { }
        catch {
            guard owner.isCurrent(auth) else { return }
            if case APIError.http(status: 404, message: _) = error { return }
            self.error = userFacingErrorMessage(error)
        }
    }
    private func saveCache(owner: AccountScope) {
        guard owner.isCurrent(auth), loaded == owner else { return }
        BookshelfMemoryCache.shared.store(.init(readings: readings, books: books, nextCursor: nextCursor), for: owner)
    }
    private func loadMore() async {
        guard let nextCursor, !isLoading else { return }
        let owner = AccountScope(auth); isLoading = true
        defer { if owner.isCurrent(auth) { isLoading = false } }
        do {
            let page = try await APIClient.shared.bookCall(AIBookPage.self, path: "?before=\(nextCursor.uuidString)", auth: auth)
            try owner.check(auth)
            let existing = Set(books.map(\.id)); books += page.books.filter { !existing.contains($0.id) }
            self.nextCursor = page.nextCursor
            saveCache(owner: owner)
        } catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}

struct BookCover: View {
    let title: String
    let subtitle: String
    let date: String
    let badge: String?
    let index: Int
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .leading) {
                ReadingNatureArtwork(index: index)
                LinearGradient(colors: [.black.opacity(0.08), .black.opacity(0.65)], startPoint: .top, endPoint: .bottom)
                Rectangle().fill(.white.opacity(0.25)).frame(width: 1).padding(.leading, 9)
                VStack(alignment: .leading, spacing: 14) {
                    FateMark(size: 25, color: .white.opacity(0.85))
                    Spacer(minLength: 14)
                    Text(title).font(.system(.subheadline, weight: .semibold)).lineSpacing(5).foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(subtitle).font(.caption2).foregroundStyle(.white.opacity(0.85)).lineLimit(2)
                }.padding(20)
            }.frame(minHeight: 230).clipShape(.rect(topLeadingRadius: 3, bottomLeadingRadius: 3, bottomTrailingRadius: 12, topTrailingRadius: 12))
                .shadow(color: .black.opacity(0.07), radius: 5, x: 2, y: 4)
            VStack(alignment: .leading, spacing: 5) {
                if let badge { Text(badge).font(.caption.weight(.medium)) }
                Text(String(date.prefix(10)).replacingOccurrences(of: "-", with: "/")).font(.caption).foregroundStyle(FateTheme.muted)
            }
        }.foregroundStyle(FateTheme.ink).accessibilityElement(children: .combine)
    }
}

struct BookCreationRootView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var readings: [ReadingSummary] = []
    @State private var error: String?
    @State private var loading = false
    @State private var loadedOwner: AccountScope?
    var body: some View {
        AIBookComposeView(readings: readings, isTab: true, sourcesLoading: loading,
                          sourcesError: error, reloadSources: { Task { await load() } })
            .background(FateTheme.canvas).task(id: AccountScope(auth)) { await load() }
    }
    private func load() async {
        let owner = AccountScope(auth)
        if loadedOwner != owner {
            readings = BookshelfMemoryCache.shared.value(for: owner)?.readings ?? []
            loadedOwner = owner; loading = false
        }
        guard !loading else { return }
        loading = true; error = nil
        defer { if owner.isCurrent(auth) { loading = false } }
        do {
            let result = try await APIClient.shared.readings(auth: auth)
            try owner.check(auth)
            readings = result.filter { !$0.isChat }
        } catch is CancellationError { }
        catch { if owner.isCurrent(auth) { self.error = userFacingErrorMessage(error) } }
    }
}

/// Session-only, one-account cache. Never persisted to disk or reused after a logout/login epoch change.
@MainActor
final class BookshelfMemoryCache {
    static let shared = BookshelfMemoryCache()
    struct Snapshot {
        let readings: [ReadingSummary]
        let books: [AIBook]
        let nextCursor: UUID?
    }
    private var owner: AccountScope?
    private var snapshot: Snapshot?
    func value(for requestedOwner: AccountScope) -> Snapshot? {
        guard requestedOwner.userID != nil, owner == requestedOwner else {
            owner = nil; snapshot = nil
            return nil
        }
        return snapshot
    }
    func store(_ value: Snapshot, for owner: AccountScope) {
        guard owner.userID != nil else { return }
        self.owner = owner; snapshot = value
    }
}
