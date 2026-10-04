#if DEBUG
import SwiftUI
// Synthetic display-only examples. Does not construct auth, StoreKit or API clients.
struct BookshelfDesignPreview: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    FateEditorialHero(eyebrow: "YOUR LIBRARY", title: "あなたの本棚", subtitle: "そのときの想いと、読み返したい言葉を。")
                    Text("相談の鑑定書").font(FateType.sectionTitle)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 18), GridItem(.flexible(), spacing: 18)], spacing: 26) {
                        BookCover(title: "すれ違うふたりの、伝え方を見つめる", subtitle: "ふたりの鑑定", date: "2026-09-27", badge: "お届け済み", index: 10)
                        BookCover(title: "これからの働き方を、自分の言葉で選ぶ", subtitle: "あなたの鑑定", date: "2026-09-26", badge: "お届け済み", index: 0)
                    }
                    Text("あなたと、ふたりの鑑定").font(FateType.sectionTitle)
                    BookCover(title: "あなたの特徴と人生の軸", subtitle: "あなたの鑑定", date: "2026-09-25", badge: nil, index: 0).frame(width: 166)
                }.padding(.horizontal, 20).padding(.bottom, 36)
            }.background(FateTheme.canvas).fateAppHeader()
        }.tint(FateTheme.ink).preferredColorScheme(.light)
    }
}
#endif
