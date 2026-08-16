import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var traits: [ProfileTrait] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("FATE LAB · YOUR PROFILE").font(.caption).tracking(3).foregroundStyle(FateTheme.gold)
                Text("あなたについて\nわかってきたこと").font(.system(size: 31, weight: .medium, design: .serif))
                if auth.session != nil {
                    Text("\(traits.count)").font(.system(size: 48, weight: .medium, design: .serif)).foregroundStyle(FateTheme.gold)
                }
                Text("質問を重ねながら『合っている』と選んだ内容だけを保存します。")
                    .foregroundStyle(FateTheme.muted).lineSpacing(6)
                if auth.session == nil {
                    Button("ログインして確認する") { AuthPresentation.shared.isPresented = true }.buttonStyle(GoldButtonStyle())
                } else if traits.isEmpty {
                    ReportCard { Text("まだ何も保存されていません。\n鑑定書について質問すると、会話からわかったことがここに加わります。").lineSpacing(7) }
                } else {
                    ForEach(groupedTraits, id: \.category) { group in
                        VStack(alignment: .leading, spacing: 12) {
                            Text(categoryLabel(group.category)).font(.system(size: 18, weight: .medium, design: .serif))
                            ForEach(group.values) { trait in
                                ReportCard {
                                    HStack(alignment: .top) {
                                        Text(trait.text).lineSpacing(6)
                                        Spacer()
                                        Menu {
                                            Button("削除", role: .destructive) { Task { await delete(trait) } }
                                        } label: { Image(systemName: "ellipsis").frame(width: 36, height: 36).foregroundStyle(FateTheme.muted) }
                                    }
                                }
                            }
                        }
                    }
                }
            }.padding(20)
        }.background(FateTheme.ivory).fateScreenTitle("あなたについて").task {
            guard let token = auth.session?.accessToken else { return }
            traits = (try? await APIClient.shared.traits(token: token)) ?? []
        }
    }

    private var groupedTraits: [(category: String, values: [ProfileTrait])] {
        Dictionary(grouping: traits, by: \.category).map { ($0.key, $0.value) }.sorted { $0.category < $1.category }
    }

    private func categoryLabel(_ value: String) -> String {
        ["work": "仕事", "love": "恋愛", "decision": "決め方", "relationship": "人間関係"].first { $0.key == value }?.value ?? value
    }

    private func delete(_ trait: ProfileTrait) async {
        guard let token = auth.session?.accessToken else { return }
        do { try await APIClient.shared.deleteTrait(id: trait.id, token: token); traits.removeAll { $0.id == trait.id } }
        catch { /* 削除に失敗した場合は表示を維持する */ }
    }
}
