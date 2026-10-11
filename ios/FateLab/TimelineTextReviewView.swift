#if FATELAB_TIMELINE_REVIEW
import SwiftUI

/// Internal visual review only. Generated cards use the real v3.33 engine;
/// the reader/list/tag views below are the shipping components.
struct TimelineTextReviewView: View {
    struct Sample: Decodable, Identifiable {
        let id: String
        let title: String
        let note: String
        let cards: [ReadingCard]
    }
    @State private var selection = "self-employed"
    private let samples: [Sample] = (try? JSONDecoder().decode([Sample].self, from: TimelineTextReviewData.data)) ?? []
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("時系列 v3.33・表示確認専用").font(FateType.sectionTitle)
                    Text("本番反映前のサンプルです。登録・購入・AI相談は行いません。通常利用はTestFlightのビルド122へ戻してください。")
                        .font(.footnote).foregroundStyle(FateTheme.muted)
                    Picker("確認するサンプル", selection: $selection) {
                        ForEach(samples) { sample in Text(sample.title).tag(sample.id) }
                    }.pickerStyle(.menu)
                    if let sample = samples.first(where: { $0.id == selection }) {
                        Text(sample.note).font(.footnote).foregroundStyle(FateTheme.muted)
                        if sample.id == "self-employed" {
                            Text("「6年以上前の年も見る」を押し、2015年の「#活動の転機の候補」と、カードを開いた後の簡易本文をご確認ください。")
                                .font(.footnote).foregroundStyle(FateTheme.ink)
                        }
                        if sample.id == "couple" {
                            ReadingCardList(cards: sample.cards, onQuestion: { _ in })
                        } else {
                            SelfTimingList(cards: sample.cards, conversationID: nil, onQuestion: { _ in })
                                .id(sample.id)
                        }
                    } else {
                        Text("確認データを読み込めませんでした。")
                    }
                }.padding(20)
            }.background(FateTheme.canvas).fateAppHeader()
        }.tint(FateTheme.ink)
    }
}
#endif
