# FATE LAB 二人の関係性・シナストリールール（全58項目・完全版）

## この文書について

**復元元**：「二人の関係性・シナストリーロジック追加一覧」原文（§0〜§58）。
箇条書き本文は**原文をそのまま転記**しており、加筆・要約・言い換えを行っていない。

各項目の末尾の引用ブロック（`>`）は**実装のために追加したメタ情報**であり、原文には存在しない。
原文中に明示された占術要素・スコア名から導出できる範囲に限り、導出できないものは「根拠不足」と明記した。

**実装からの参照**：`source: '相性§7'` の形式。項番の変更・統合・欠番を行わないこと。

---

## 現状の実装との対応（先に読むこと）

**シナストリー計算はリポジトリに存在しない。**
`synastry` / 相互アスペクト / ハウスオーバーレイに相当するコードは1行もない。

| 経路 | 実態 |
|---|---|
| AI相性鑑定（本番） | `compatibilityContext.ts` が両者の命式をJSONで抜き出し、`partners.ts` がそのままSonnetへ渡す。**相性判定はモデルの内部知識に委譲されており、決定論的なスコアは一切ない** |
| 決定論相性鑑定（未接続） | `deterministicCompatibility.ts` L47-52。日干一致とライフパス mod 3 の2軸のみ。**実質3パターン**（aligned / complementary / clashing） |
| 二人の時期 | `coupleTimingCards.ts`。両者の `themes` 配列の**文字列完全一致**で4分類 |

本文書の38スコア・8関係タイプは**すべて未実装**である。
相性を決定論へ切り替えるには、本文書が計算仕様の原本になる。

---

## 新規に必要な型（本文書全体の前提）

```ts
/** 二人のFactを突き合わせて生まれる関係Fact。個人Factとは別レイヤー */
export interface SynastryFact {
  id: string
  kind: 'cross-aspect' | 'overlay' | 'element' | 'stem-relation' | 'sukuyo' | 'shared-timing' | 'environment'
  selfFactId: string | null
  partnerFactId: string | null
  axis: RelationAxis
  signal: string
  polarity: -1 | 0 | 1
  strength: number
  /** どちらの出生時刻を必要とするか。相性§54 の抑制に使う */
  requiresSelfBirthTime: boolean
  requiresPartnerBirthTime: boolean
  canonicalSourceId: string
  lineage: FactLineage
}

export type RelationAxis =
  | 'attraction' | 'depth' | 'communication' | 'fun' | 'safety'
  | 'values' | 'growth' | 'domestic' | 'conflict' | 'repair' | 'binding' | 'power'

export interface RelationScore {
  key: RelationScoreKey
  value: number          // 0〜1
  confidence: number     // 時刻不明・系統数から算出
  contributingFacts: string[]
  lineages: FactLineage[]
}
```

---

# 0. 基本原則

* 二人の相性は、単一の「相性点」で判定しない。
* 「惹かれる」「楽しい」「深く理解できる」「生活できる」「成長できる」「長続きする」「喧嘩しない」はそれぞれ別の相性軸として判定する。
* 強く惹かれ合う相手が、必ずしも安心できる相手とは限らない。
* よく喧嘩する相手が、必ずしも相性の悪い相手とは限らない。
* 喧嘩の多さより、喧嘩後の修復力を独立して判定する。
* 「会話が盛り上がる」と「心の内側を理解し合える」は別物として判定する。
* 「一緒にいて楽しい」と「一緒にいて安心する」は別物として判定する。
* 「刺激がある」と「信頼できる」は別物として判定する。
* 「価値観が似ている」と「性格が似ている」は別物として判定する。
* 「長く一緒にいることで形成された親密さ」と「出生時から存在する相性」を区別する。
* 同棲・職場・学校など物理的接触時間が長い関係では、占術上の親密性だけでなく接触量による関係深化を補正する。
* 実際の関係性は、Synastry × Individual Personality × Timing × Shared Environmentで決まるものとして扱う。

> **位置づけ** 全項目に適用される上位制約。個別ルールではない。
> **実装** 最終行が全体の計算構造そのもの。
> ```ts
> relationshipProfile = combine(
>   synastryScores,      // 二人のFact突き合わせ（本文書 §42〜§46）
>   individualTraits,    // 各自の Trait Score（性格§44 §45）
>   timingOverlay,       // 二人の時期の重なり（§57 / 時期§49）
>   sharedEnvironment,   // 同棲・職場など接触量（§12 §25 §32）
> )
> ```
> **状態** 未実装。**現行の「実質3パターン」はこの原則の全項目に違反している**

---

# 1. 関係性として持つべき主要スコア

以下を0〜1で算出する。

* romantic_attraction
* physical_attraction
* emotional_intimacy
* emotional_safety
* mutual_understanding
* conversational_flow
* conversational_depth
* humor_compatibility
* value_alignment
* ambition_alignment
* lifestyle_alignment
* friendship_compatibility
* domestic_compatibility
* novelty_compatibility
* growth_compatibility
* shared_project_compatibility
* adventure_compatibility
* admiration_mutual
* pride_collision
* ego_competition
* conflict_frequency
* conflict_intensity
* repair_capacity
* forgiveness_capacity
* transparency
* predictability
* mystery_distance
* trust_stability
* betrayal_risk_pattern
* dependency_intensity
* shared_identity
* partnership_team_feeling
* fate_companion_feeling
* relationship_stimulation_need
* relationship_boredom_risk
* power_balance
* social_display_affection
* private_affection
* long_term_binding

> **位置づけ** 関係スコアの定義（39件。原文の見出しは「主要スコア」）
> **推奨型定義**
> ```ts
> export const RELATION_SCORE_KEYS = [
>   'romantic_attraction','physical_attraction','emotional_intimacy','emotional_safety',
>   'mutual_understanding','conversational_flow','conversational_depth','humor_compatibility',
>   'value_alignment','ambition_alignment','lifestyle_alignment','friendship_compatibility',
>   'domestic_compatibility','novelty_compatibility','growth_compatibility',
>   'shared_project_compatibility','adventure_compatibility','admiration_mutual',
>   'pride_collision','ego_competition','conflict_frequency','conflict_intensity',
>   'repair_capacity','forgiveness_capacity','transparency','predictability',
>   'mystery_distance','trust_stability','betrayal_risk_pattern','dependency_intensity',
>   'shared_identity','partnership_team_feeling','fate_companion_feeling',
>   'relationship_stimulation_need','relationship_boredom_risk','power_balance',
>   'social_display_affection','private_affection','long_term_binding',
> ] as const
> export type RelationScoreKey = typeof RELATION_SCORE_KEYS[number]
> ```
> **注意** `long_term_binding` は `traitScores.ts` の `BindingScoreKey` と**同名**である。
> 個人の傾向（本人がどれだけ関係を維持しやすいか）と、この二人の結合度は別物なので、
> **`RelationScoreKey` は別の型として定義し、同名衝突を型で防ぐこと**
> **状態** 未実装。`§1` の39スコアが本文書のほぼ全項目の出力先になる

---

# 2. 「運命共同体感」が生まれやすい関係

* 太陽・月・ASC・IC・7室・8室・ノードなど本人の中核領域同士が複数強く結びつく時は、「ただ付き合っている」以上の運命共同体感が生まれやすい傾向がある。
* 月・太陽・ASCなど人格の核と、相手の個人天体が複数調和する時は、相手を自分の生活・人生の一部として感じやすい傾向がある。
* 4室・7室・8室的な結びつきが強い関係は、デート相手より「一緒に生きる人」という感覚になりやすい傾向がある。
* 月同士、月と太陽、月と金星など感情系の結びつきが強い場合、言葉にしなくても相手の存在が日常へ溶け込みやすい傾向がある。
* ノードと太陽・月・金星・ASCなどの接触が強い関係は、本人たちが「縁がある」「人生の一部だった」と感じやすい傾向がある。
* Partnership Team FeelingとShared Identityがともに高い場合、「彼氏彼女」より「二人で一つのチーム」という感覚が強くなりやすい。
* 同棲など生活共有がある場合は、Fate Companion Feelingを環境要因によって追加補正する。
* 運命共同体感が強い関係は、別れた後も比較対象として長く本人の恋愛観へ残りやすい。

> **占術** 西洋占星術（太陽・月・ASC・IC・7室・8室・ノード・金星のクロスアスペクトとオーバーレイ）
> **時刻** **双方必須**（ASC・IC・4/7/8室）｜**系統** western
> **スコア** `fate_companion_feeling` `shared_identity` `partnership_team_feeling`
> **用途** 相性「二人の本質」「惹かれ合う理由」
> **独立性** ノードは移動が遅く**同年代で共通**。太陽・月・ASCへの接触がある時のみ個人要因（時期§45）
> **環境補正** 7行目が §12 の Acquired Intimacy と同じ構造。占術由来と接触量由来を分けること
> **状態** 未実装。`SynastryFact.kind = 'cross-aspect' | 'overlay'` が必要

---

# 3. 一緒に新しいことをすると仲が深まる

* 木星・天王星・射手座・9室・11室など成長・新体験を表す要素が二人の個人天体と強くつながる時は、新しい体験を共有することで関係が活性化しやすい傾向がある。
* 二人ともNovelty Needが高い場合、同じ日常を繰り返すより旅行・新規事業・趣味・挑戦を共有した方が仲が良くなりやすい。
* 木星的相性が強い二人は、「一緒にいると世界が広がる」という感覚を持ちやすい。
* 天王星的相性が強い二人は、新しい場所・新しい遊び・新しいプロジェクトを始めることで関係に刺激が戻りやすい。
* Shared Project Compatibilityが高い二人は、一緒に何かを作る・稼ぐ・挑戦することで愛情が深まりやすい。
* Ambition Alignmentが高い二人は、互いの夢や野心を共有すること自体が親密さになりやすい。
* Relationship Stimulation Needが高い関係では、何も起きない平穏な時期ほど関係満足度が低下する場合がある。
* Novelty Compatibilityが高い二人には、「新しい体験を定期的に共有すること」が関係維持要因になる。

> **占術** 西洋占星術（木星・天王星・射手座・9室・11室）
> **時刻** 9室・11室使用時は双方必須｜**系統** western
> **スコア** `novelty_compatibility` `adventure_compatibility` `growth_compatibility` `shared_project_compatibility` `ambition_alignment` `relationship_stimulation_need`
> **用途** 相性「長く続ける条件」「二人でいると広がる世界」
> **独立性** 2行目は**個人のTrait Score の突き合わせ**（性格§9 `novelty_attraction`）。シナストリーFactとは別レイヤーなので加算しない
> **状態** 未実装

---

# 4. ビジネス・挑戦を一緒にできるカップル

* 二人の火星・木星・土星・MC関連が調和する時は、恋愛だけでなく目標達成のチームとして機能しやすい傾向がある。
* 火星同士の相性が良い場合、行動速度・頑張り方・勝負への姿勢が合いやすい。
* 木星同士または木星と個人天体が強く調和する場合、「もっとやってみよう」と互いを拡大させやすい。
* 土星が適度に調和する場合、アイデアだけでなく継続・責任分担がしやすい。
* Ambition Alignmentが高いカップルは、旅行・起業・副業・資格取得など「共通の目標」を持つことで関係満足度が上がりやすい。
* Shared Project Compatibilityが高い二人は、共同作業がデートの代替になる場合がある。
* 二人とも競争心が強い場合は、Shared Project CompatibilityとEgo Competitionを同時に判定する。
* 共同目標がある時は非常に仲が良いが、目標を失うと関係自体の目的が薄れるカップルも存在する。

> **占術** 西洋占星術（火星・木星・土星・MC のクロスアスペクト）
> **時刻** MC使用時は双方必須｜**系統** western
> **スコア** `shared_project_compatibility` `ambition_alignment` `ego_competition` `partnership_team_feeling`
> **用途** 相性「二人だからできること」
> **独立性** 7行目が重要。**Shared Project と Ego Competition を同時に高く出せる構造にすること**（片方で打ち消さない）
> **状態** 未実装

---

# 5. 二人とも野心が強い

* 二人とも10室・MC・火星・木星・土星など社会達成要素が強い場合、お互いの向上心を理解しやすい。
* Ambition Alignmentが高い場合、仕事優先による不満が比較的起こりにくい。
* Ambition Alignmentが高い二人は、互いの成功を刺激として自分も頑張りやすい。
* 一方で二人ともPride SensitivityとStatus Orientationが高い場合、無意識の競争が発生しやすい。
* Ambition Alignmentが高くEgo Competitionも高い場合、「最高の相棒」にも「最大のライバル」にもなりやすい。
* 片方の成功が急激に大きくなった場合、Power Balanceが変化し、関係性が再編される場合がある。

> **占術** 西洋占星術（10室・MC・火星・木星・土星）
> **時刻** 10室・MC使用時は双方必須｜**系統** western
> **スコア** `ambition_alignment` `ego_competition` `power_balance`
> **入力** 各自の `pride_sensitivity`（性格§14）・`status_attraction`（性格§7）
> **用途** 相性「二人の本質」「二人のプライド」
> **独立性** 4行目は**両者の Trait Score の積**であってシナストリーFactではない。二重計上しないこと
> **状態** 未実装。**性格§14 が未実装のため、本項も動かせない。性格§14 が前提になる**

---

# 6. プライドが高い二人は喧嘩しやすい

* 二人とも太陽・火星・獅子座・固定宮・MC・10室など自己主張・プライド要素が強い場合、些細な問題でも「どちらが折れるか」の争いになりやすい。
* Pride Sensitivityが双方高い場合、内容そのものより「言い方」「扱われ方」「尊重されたか」が喧嘩の原因になりやすい。
* 太陽と火星のハードアスペクトがシナストリーで強い場合、互いに相手の自尊心や競争心を刺激しやすい。
* 火星同士がハードに関わる場合、行動テンポ・怒り方・決断方法を巡って衝突しやすい。
* 太陽同士・月同士が固定的で強い場合、どちらも簡単に引かず喧嘩が長引きやすい。
* Pride Collisionが高い関係では、問題解決より「相手に負けたくない」が優先されやすい。
* Pride Collisionが高くてもRepair Capacityが高ければ、喧嘩の多さだけでは破局リスクを高くしない。

> **占術** 西洋占星術（太陽・火星・獅子座・固定宮・MC・10室・月のクロスアスペクト）
> **時刻** MC・10室使用時は双方必須｜**系統** western
> **スコア** `pride_collision` `conflict_frequency` `conflict_intensity`
> **入力** 各自の `pride_sensitivity`（性格§14）
> **用途** 相性「すれ違いやすい場面」「喧嘩の原因」「二人のプライド」
> **独立性** 最終行が**破局判定への制約**。`conflict_frequency` 単独で相性を下げないこと（§7・§42）
> **状態** 未実装。**性格§14 が前提**

---

# 7. よく喧嘩するのに仲直りできる

* 火星的刺激が強く、同時に月・金星・木星の調和がある関係は、喧嘩が多くても愛情基盤が残りやすい。
* Conflict Intensityが高くてもEmotional Safetyが高い場合、怒りや泣くことを関係終了とは感じにくい。
* 木星が二人の月・金星・水星を支える場合、喧嘩後に「まあいいか」と許す力が働きやすい。
* 月・金星の親密性が高い関係は、喧嘩しても相手への情そのものが消えにくい。
* Repair Capacityが高い二人は、謝る・泣く・話し合う・抱きしめるなど、それぞれの仲直りパターンを形成しやすい。
* Conflict Frequencyが高くRepair Capacityも高い関係は、「喧嘩しながら続くカップル」になりやすい。
* Conflict Frequencyだけで相性点を下げない。
* Conflict Intensity × Repair Capacityで実際の破局危険度を算出する。

> **占術** 西洋占星術（火星・月・金星・木星・水星のクロスアスペクト）
> **時刻** 不要（天体同士のアスペクトのみ）｜**系統** western
> **スコア** `repair_capacity` `forgiveness_capacity` `emotional_safety` `conflict_intensity`
> **用途** 相性「関係を修復する方法」「喧嘩した後、戻れる二人？」
> **独立性** 最終2行が §42 の `relationship_damage` 式の根拠
> **状態** 未実装。**出生時刻を必要としないため、相性決定論化で最初に実装できる項目のひとつ**

---

# 8. 泣きながら謝って仲直りする関係

* 月・火星が強く刺激し合う関係では、感情が爆発しやすい。
* 月・金星も同時に強く結びついている場合、怒りの後に愛着が戻りやすい。
* Emotional Expressionが双方高い場合、怒り・悲しみ・謝罪が非常にドラマチックになりやすい。
* Emotion Suppressionが低いカップルは、喧嘩を表に出す分、問題も表面化しやすい。
* 感情を大きくぶつけてもRepair Capacityが高い場合、そのやり取り自体が関係維持パターンになることがある。
* 「喧嘩が激しい＝不仲」としない。

> **占術** 西洋占星術（月・火星・金星のクロスアスペクト）
> **時刻** 不要｜**系統** western
> **スコア** `conflict_intensity` `repair_capacity`
> **入力** 各自の `emotional_expression`（性格§25）
> **用途** 相性「関係を修復する方法」
> **独立性** §7の具体パターン。§7で加点済みのFactを再加点しない
> **状態** 未実装。`emotion_suppression` は `emotional_expression` の逆値で代替（**独立キーは作らない**）

---

# 9. 会話が楽しい関係

* 水星同士、または水星と月・金星・木星が調和する時は、会話のテンポが合いやすい。
* 水星と木星が強く関わる時は、話題が広がりやすく、長時間話しても飽きにくい。
* 水星と金星が関わる時は、相手の話し方自体を心地よく感じやすい。
* 水星と火星が調和する場合、テンポの速い掛け合い・ツッコミ・議論を楽しみやすい。
* 水星と天王星が強い場合、変わった話・新しい話・意外な視点で盛り上がりやすい。
* Conversational Flowが高い関係は、恋愛感情が落ち着いた後も友人としての楽しさが残りやすい。
* Humor Compatibilityが高い関係は、一緒にいる時の主観的幸福度が高まりやすい。

> **占術** 西洋占星術（水星と 水星/月/金星/木星/火星/天王星 のクロスアスペクト）
> **時刻** 不要｜**系統** western
> **スコア** `conversational_flow` `humor_compatibility` `friendship_compatibility`
> **入力** 各自の `conversation_entertainment`（性格§27）
> **用途** 相性「会話の相性」
> **独立性** §44 が本項の算出仕様。**§10 の `conversational_depth` とは別スコアにすること**
> **状態** 未実装。時刻不要で実装できる

---

# 10. 「話は面白い」と「心の会話ができる」は別

* 水星の相性が良くても、月・8室・4室・冥王星など感情深度の相性が弱い場合、会話は楽しくても心の奥までは理解し合えない傾向がある。
* Conversational Flowが高くEmotional Intimacyが低い場合、「一緒にいると楽しいけれど、本当のところ何を考えているかわからない」と感じやすい。
* 水星・木星・天王星だけが強い関係は、知的・娯楽的会話は盛り上がっても感情共有が不足する場合がある。
* 月・水星・冥王星・8室が強く結びつく関係では、表面的な会話から自然に本音・恐怖・弱さへ入っていきやすい。
* Conversational DepthはConversational Flowとは別スコアにする。
* 「話が合うから相性が良い」と単純判定しない。

> **占術** 西洋占星術（月・8室・4室・冥王星・水星のクロスアスペクトとオーバーレイ）
> **時刻** 4室・8室使用時は双方必須｜**系統** western
> **スコア** `conversational_depth` `emotional_intimacy`
> **用途** 相性「心の深いところの相性」「相手の本音を理解しやすい？」
> **独立性** 最終2行が制約。**`conversational_flow` を `conversational_depth` へ流用しないこと**
> **状態** 未実装。**§9 と本項の分離が、相性鑑定の精度感を大きく左右する**

---

# 11. 相手が何を考えているかわからない

* 水星と月のシナストリーが弱い場合、思考と言葉と感情の翻訳がうまくいきにくい傾向がある。
* 相手の水星と本人の月がハードに関わる場合、相手が言っていることと本人が感じ取ることにズレが生じやすい。
* 海王星が水星・月・DESC・金星へ強く関与する関係は、相手の本音を推測する時間が増えやすい。
* 12室的なオーバーレイや海王星的関係が強い場合、「好きなのか嫌いなのか」「何を考えているのか」が読みにくくなりやすい。
* Mystery Distanceが高くTransparencyが低い関係では、同じ時間を過ごしても心理的距離が縮まりにくい場合がある。
* Emotional Intimacyが低い人同士は、情報共有はしていても感情共有が不足しやすい。
* 本人が「深い話」を求めるタイプの場合、相手のEmotional Disclosureが低いほど孤独を感じやすい。

> **占術** 西洋占星術（水星・月・海王星・DESC・金星・12室オーバーレイ）
> **時刻** DESC・12室使用時は双方必須｜**系統** western
> **スコア** `mystery_distance` `transparency` `emotional_intimacy` `mutual_understanding`
> **用途** 相性「相手の本音を理解しやすい？」「すれ違いやすい場面」
> **独立性** 海王星は世代天体。水星・月・DESC・金星への接触時のみ個人要因
> **非対称性** 7行目が重要。**本項は方向を持つ**（本人→相手 と 相手→本人 で値が異なる）。`RelationScore` を対称値として持たない設計が必要
> **状態** 未実装。`emotional_disclosure` は独立キーを作らず `transparency` の各自成分として持つ

---

# 12. 一緒に長く過ごしても心の距離が縮まらない

* Physical ProximityとEmotional Intimacyを別々に判定する。
* 一緒にいる時間が長くても、月・水星・8室的な深い共有が弱い場合、心理的親密性は必ずしも高まらない。
* Emotional Disclosureが双方低い場合、長期交際でも「相手をよく知らない」という感覚が残ることがある。
* 逆にシナストリー上のEmotional Intimacyが高い二人は、比較的短期間でも深く理解し合った感覚を持ちやすい。
* 共同生活による親密さはEnvironmental Intimacyとして別加点する。
* 占術由来のEmotional Intimacyと、単純な接触時間によるAcquired Intimacyを区別する。

> **位置づけ** **占術由来と環境由来を分離する制約ルール**
> **実装形**
> ```ts
> interface IntimacyBreakdown {
>   synastryIntimacy: number    // 占術由来（§43）
>   acquiredIntimacy: number    // 接触量由来。ユーザー入力（同棲・交際年数・職場）から算出
>   total: number               // 合算だが、内訳を鑑定文で必ず分けて説明する
> }
> ```
> **用途** 相性「心の深いところの相性」／§13・§25・§32の前提
> **独立性** **Acquired Intimacy を占術スコアへ混ぜないこと。**混ぜると「長く付き合った＝相性が良い」という逆算になる（§56）
> **状態** 未実装。**接触量データ（同棲の有無・交際期間・職場が同じか）をユーザー入力として取る必要がある。現在このUIが存在しない**

---

# 13. 初恋・同棲相手を後の恋人と比較しやすい

* Shared IdentityとEmotional Intimacyが非常に高い最初の長期恋愛は、その後の恋愛における基準値になりやすい。
* 初めて同棲・共同生活・共同挑戦を経験した相手は、実際のシナストリー以上に心理的基準として残りやすい。
* First Major Relationship Weightを別途持つ。
* 初恋または最初の長期恋愛については、記憶上の重要度を通常の恋愛より高く補正する。
* 後の恋人が悪い相性でなくても、Emotional IntimacyやShared Identityが最初の相手より低い場合、「何か足りない」と感じやすい。
* アプリでは「元彼の方が運命」と断定せず、「最初に作った恋愛の深さが、無意識の基準になりやすい」と説明する。

> **位置づけ** 複数の相性鑑定をまたぐ比較ルール
> **実装形** `firstMajorRelationshipWeight: number` を関係メタデータとして保持
> **用途** 相性の補助説明
> **表現制約** 最終行が出力規則。**断定禁止**
> **独立性** 占術Factを消費しない
> **状態** 未実装。**複数の相性鑑定を横断参照する機能が現在ない**ため、実装優先度は低い

---

# 14. 価値観・空気感が合う

* 月・太陽・ASC・金星など日常的な人格要素が調和する時は、細かく説明しなくても「なんとなく合う」と感じやすい。
* 月同士・月と太陽・金星の調和は、生活テンポ・感情反応・好みの自然な一致につながりやすい。
* Value Alignmentが高い関係は、大きな人生観について同じ方向を向きやすい。
* Lifestyle Alignmentが高い関係は、一緒に住んでも日常的ストレスが少なくなりやすい。
* Emotional Rhythmが似ている二人は、沈黙でも気まずくなりにくい。
* 「空気感が合う」は、会話相性より月・金星・ASCなど非言語的相性を重視して判定する。

> **占術** 西洋占星術（月・太陽・ASC・金星のクロスアスペクト）
> **時刻** ASC使用時は双方必須｜**系統** western
> **スコア** `value_alignment` `lifestyle_alignment`
> **用途** 相性「二人の価値観」「惹かれ合う理由」
> **独立性** 最終行が**§9（会話相性）との分離指示**。会話が合うことを価値観一致へ流用しない
> **状態** 未実装。`emotional_rhythm` は独立キーを作らず、月同士のアスペクト強度で代替

---

# 15. 宿曜の栄親的な関係

* 宿曜で栄親関係の場合、互いの成長・支援・生活上の相性が比較的自然になりやすい傾向がある。
* 栄親関係は、強烈な刺激より「なんだかんだ合う」「一緒に進みやすい」という形で現れやすい。
* 栄親に西洋占星術の木星・月・金星の調和が重なる場合、共同成長感を高く加点する。
* 栄親だけで恋愛継続を断定しない。
* 栄親でも双方の火星・太陽が強く衝突する場合、価値観は合っていても喧嘩が多くなる場合がある。
* 宿曜はRelationship Baselineを補助するが、Conflict / Transparency / Bindingは別系統で判定する。

> **占術** 宿曜（栄親・業胎・危成・安壊・命の宿関係）／西洋占星術（木星・月・金星・火星・太陽）
> **時刻** 不要（宿曜は日付で確定）｜**系統** supplemental + western
> **スコア** `growth_compatibility` `value_alignment`（Relationship Baseline として）
> **用途** 相性「二人の本質」の基礎
> **独立性** **宿曜単独で断定しない**（4行目）。西洋との一致がある時のみ加点（3行目）。
> ウェイトは supplemental の 0.05（時期§50）
> **状態** 未実装。**`getSukuyo()` は実装済みで宿名は取得できるが、二人の宿関係（栄親等）を判定する関数が存在しない。**
> 現行 `deterministicCompatibility.ts` は evidence に宿名の文字列を載せるだけで判定に使っていない。
> **宿関係の判定表（27宿×27宿）を追加すれば、時刻不要で相性の基礎軸が1つ手に入る。実装コストが最も低い項目**

---

# 16. サプライズ・外向きの愛情表現

* 金星・獅子座・5室・太陽が強い人は、相手を喜ばせる演出・プレゼント・サプライズを好みやすい傾向がある。
* Social Display Affectionが高い人は、誕生日・記念日・外食など見える形で愛情を表現しやすい。
* 金星と木星が強い場合、相手へお金・時間・イベントを使うことを惜しみにくい。
* 外面が良くSocial Display Affectionが高い人は、他者から「良い彼氏・良い彼女」に見える行動を取りやすい。
* Social Display AffectionとPrivate Emotional Intimacyは別物として判定する。
* サプライズが多い＝心の深い共有がある、とは限らない。

> **占術** 西洋占星術（金星・獅子座・5室・太陽・木星）
> **時刻** 5室使用時は必須｜**系統** western
> **スコア** `social_display_affection` `private_affection`
> **入力** 各自の `practical_generosity`（性格§36）
> **用途** 相性「あなたが相手に求めすぎること」「相手があなたに求めること」
> **独立性** **本項は個人特性であってシナストリーではない。**各自について算出し、二人の差分を出力する
> **表現制約** 最終2行が制約。Social Display を Emotional Intimacy へ加点しない
> **状態** 未実装

---

# 17. 社会的成功によって関係が変わる

* 片方のStatus / Career Expansionが急上昇すると、カップル内のPower Balanceが変化しやすい。
* 元々Ego Competitionが高い二人では、資格取得・昇進・年収上昇など片方の成功が関係の緊張を生みやすい。
* Novelty Seekingが高い本人が大きな成功を得た場合、「今までできなかった遊び・経験をしたい」という欲求が高まる場合がある。
* 恋愛開始時の社会的立場と数年後の立場が大きく変わる場合、Compatibilityを再評価する必要がある。
* 二人の関係は出生時の静的相性だけでなく、Life Stage Divergenceによって変化する。
* Career Expansionが一方だけ高くRelationship Bindingが弱まる時期は、成功をきっかけに別々の方向へ進む場合がある。

> **占術** 時期スコアの二人重ね合わせ（時期§15 `career_expansion` / 時期§49）
> **時刻** 元ルールに従う｜**系統** 派生
> **スコア** `power_balance` `ego_competition` `long_term_binding`
> **用途** 相性「二人の時期の流れ」
> **独立性** **本項は時期鑑定の二人版。**シナストリーFactを消費せず、両者の `TimingScore` を突き合わせる
> **状態** 未実装。**時期§49 の18スコアが前提**

---

# 18. 同じ仕事・同じ役職のカップル

* 二人の仕事上の立場が近い場合、Mutual Understanding of Workは高まりやすい。
* 同時に、双方のPride Sensitivity・Competitivenessが高い場合、仕事上の考え方がそのまま恋愛喧嘩へ持ち込まれやすい。
* 同じ職場・同じ役職・同じ専門性を持つカップルは、理解者にも競争相手にもなりやすい。
* Career Equalityが高くEgo Competitionも高い場合、「相手に指図されたくない」という衝突が起こりやすい。
* 職場と恋愛の境界が弱い二人は、仕事上の不満を恋愛へ、恋愛上の不満を仕事へ持ち込みやすい。
* Work Relationship Overlapが高い場合、Conflict Spillover Riskを加点する。
* 仕事上のレイヤーが同じことは、価値観理解にはプラスだが、Power Struggleにはマイナスになる場合がある。

> **占術** なし（**環境データ由来**）
> **入力** ユーザー入力の職場重複・役職近接度／各自の `pride_sensitivity`（性格§14）
> **スコア** `mutual_understanding` `ego_competition` `pride_collision` `power_balance`
> **用途** 相性「喧嘩の原因」
> **独立性** **占術Factを消費しない環境ルール。**§0 の `sharedEnvironment` に相当
> **状態** 未実装。**環境データを取るUIが存在しない。**`career_equality` `work_relationship_overlap` `conflict_spillover_risk` はいずれも §1 の39スコアに含まれていない（**根拠不足**）

---

# 19. 対等すぎると喧嘩が増える

* 双方のStatus・能力・役職・自己評価が近く、どちらも主導権を取りたい場合、Power Balanceが拮抗しやすい。
* Power Balanceが均等でもPride Collisionが高い場合、「対等だからこそ譲れない」関係になりやすい。
* 一方が明確なリーダー、もう一方がフォロワーという関係より、二人ともLeader Orientationが高い場合に衝突頻度が増えやすい。
* 相手を尊敬していることと、相手の意見に従えることは別。
* Mutual AdmirationとEgo Competitionが両方高い関係は、強い魅力と強い衝突が同居しやすい。

> **占術** 各自の Trait Score 差分（性格§14 `pride_sensitivity` / §23 `group_coordination`）
> **スコア** `power_balance` `pride_collision` `ego_competition` `admiration_mutual`
> **用途** 相性「二人のプライド」「すれ違いやすい場面」
> **独立性** 派生ルール。**`power_balance` は差分の絶対値が小さいほど拮抗として扱う**（値が高い＝均衡、ではない点に注意して型コメントを書くこと）
> **状態** 未実装。`leader_orientation` は `group_coordination` で代替

---

# 20. 盛り上がっている時は最高、悪い時は最悪

* 木星・水星・金星など楽しさを作る相性と、火星・冥王星・天王星など緊張を作る相性が同時に非常に強い場合、関係満足度の振れ幅が大きくなりやすい。
* Humor Compatibilityが高くConflict Intensityも高い関係は、「楽しい時は誰より楽しいが、喧嘩すると地獄」という形になりやすい。
* Attractionが高くEmotional Safetyが低い関係は、高揚と不安定さを繰り返しやすい。
* Relationship Volatilityは、Attraction × Conflict Intensity − Emotional Safetyで評価する。
* Relationship Volatilityが高い関係は、平均的満足度ではなく最高点と最低点の差が大きくなりやすい。
* アプリでは「相性が良い／悪い」の二択ではなく、「振れ幅の大きい関係」として説明する。

> **占術** 西洋占星術（木星・水星・金星 と 火星・冥王星・天王星 の同時強度）
> **時刻** 不要｜**系統** western
> **算出式**（原文4行目が明示）
> ```ts
> const relationshipVolatility =
>   romantic_attraction * conflict_intensity - emotional_safety
> ```
> **スコア** `conflict_intensity` `emotional_safety` `humor_compatibility`
> **用途** 相性「この二人だけの関係パターン」／§47 Roller Coaster 型の判定
> **表現制約** 最終行が出力規則。**二択で出さない**
> **状態** 未実装。`relationship_volatility` は §1 の39スコアに含まれていないが、**式が明示されているため派生値として算出できる**

---

# 21. 相手の話が面白いことが恋愛維持要因になる

* 本人のConversation Entertainment Needが高い場合、水星・木星・天王星相性を恋愛満足度へ高く加点する。
* Humor Compatibilityが高い場合、多少の性格不一致があっても「一緒にいると楽しい」が関係維持要因になりやすい。
* 水星相性が強いカップルは、恋愛感情だけでなく友達的楽しさによって結びつきやすい。
* ただしHumor Compatibilityだけが高くEmotional Safetyが低い場合、楽しい時だけ成立する関係になりやすい。
* 「会話の面白さによるBinding」と「安心感によるBinding」を分ける。

> **占術** 西洋占星術（水星・木星・天王星のクロスアスペクト）
> **時刻** 不要｜**系統** western
> **スコア** `humor_compatibility` `friendship_compatibility` `long_term_binding`
> **入力** 各自の `conversation_entertainment`（性格§27）
> **用途** 相性「一緒にいると楽しいこと」
> **独立性** 最終行が制約。**Binding を単一の値にせず、由来別に分けて出力する**（§40 Maintenance Driver と同じ構造）
> **状態** 未実装

---

# 22. 価値観が合っても喧嘩する

* Value Alignmentが高くてもPride Collisionが高い場合、目指す方向は同じなのに方法論で喧嘩しやすい。
* Ambition Alignmentが高い二人は目的が一致していても、「どちらのやり方が正しいか」で競争しやすい。
* 太陽・火星の衝突が強い場合、根本価値観の一致だけでは衝突を防げない。
* 「価値観が合う＝喧嘩しない」ではない。
* Value Alignmentは長期方向性、Conflict Styleは日常の摩擦として別評価する。

> **占術** 西洋占星術（太陽・火星のハードアスペクト）
> **時刻** 不要｜**系統** western
> **スコア** `value_alignment` `pride_collision` `conflict_frequency`
> **用途** 相性「喧嘩の原因」
> **独立性** 最終行が制約。**`value_alignment` を `conflict_frequency` の減点に使わない**
> **状態** 未実装

---

# 23. 喧嘩が多くても深い関係

* Emotional Intimacyが高くConflict Frequencyも高い場合、相手に本音を見せられるからこそ衝突が増えることがある。
* 親密性の低い関係は、喧嘩しない代わりに本音も話していない場合がある。
* Conflict Frequencyの低さをそのままRelationship Qualityとして加点しない。
* 本当に重要なのは、Conflict Cause / Emotional Safety / Repair Capacity / Resentment Accumulation。
* 深く関わる二人は、表面的に平和な関係より衝突が増えることがある。
* 「喧嘩がない」と「深く理解し合っている」は別判定にする。

> **位置づけ** 制約ルール。`conflict_frequency` の解釈規則
> **スコア** `emotional_intimacy` `conflict_frequency` `emotional_safety` `repair_capacity`
> **用途** 相性「喧嘩した後、戻れる二人？」
> **独立性** 3行目が重要。**喧嘩の少なさを加点に使わない**
> **状態** 未実装。`resentment_accumulation` は §1 の39スコアに含まれていないが、**§42 の破局式で使われる**ため追加が必要（→ §42 参照）

---

# 24. 喧嘩しないが深くもない関係

* Conflict Frequencyが低くてもEmotional Intimacy・Conversational Depth・Shared Identityが低い場合、表面的に平和でも心理的距離が残りやすい。
* 相手の内面へ踏み込まない二人は、大きな喧嘩が少ない代わりに深い関係にもなりにくいことがある。
* Mystery Distanceが高い関係では、問題が起きる前に感情そのものを共有していない場合がある。
* Relationship Qualityを「喧嘩の少なさ」で評価しない。

> **位置づけ** §23の裏側。§49 Quiet Distance 型の判定条件
> **スコア** `conflict_frequency`（低）`emotional_intimacy`（低）`conversational_depth`（低）`mystery_distance`（高）
> **用途** 相性「この二人だけの関係パターン」
> **状態** 未実装

---

# 25. 一緒に住むことで深まる相性

* Domestic Compatibilityが高い二人は、同棲によって親密さが強まりやすい。
* 月・4室・金星的相性が良い場合、食事・睡眠・家事・休日など日常共有が関係を深めやすい。
* 同棲はEmotional Intimacyを自動的に上げるのではなく、Acquired Intimacyを上げる。
* Domestic Compatibilityが低い場合、同棲時間が長いほど摩擦が増える。
* 初期恋愛の高揚より、同棲後の生活相性の方がMarriage Compatibility予測には重要。
* Physical Time Togetherを補正変数として持つ。

> **占術** 西洋占星術（月・4室・金星のクロスアスペクトとオーバーレイ）
> **時刻** 4室使用時は双方必須｜**系統** western
> **スコア** `domestic_compatibility` `lifestyle_alignment`
> **用途** 相性「一緒に暮らした時の相性」「結婚後の関係」
> **独立性** 3行目が§12の再掲。**同棲を Emotional Intimacy へ加点しない**
> **状態** 未実装。`physical_time_together` は環境入力（§12と同じUIが必要）

---

# 26. 一緒に旅行・外出すると仲が良くなる

* 木星・射手座・9室・天王星要素が強い関係では、旅行・遠出・新しい場所が愛情を再活性化しやすい。
* Adventure Compatibilityが高いカップルは、日常より旅行中の方が仲が良くなりやすい。
* Relationship Boredom Riskが高い二人には、外出・旅行・共通体験を関係維持アドバイスとして提示する。
* 二人が共にNovelty Seeking高の場合、刺激不足が愛情低下と誤認される場合がある。

> **占術** 西洋占星術（木星・射手座・9室・天王星）
> **時刻** 9室使用時は双方必須｜**系統** western
> **スコア** `adventure_compatibility` `relationship_boredom_risk` `novelty_compatibility`
> **用途** 相性「この関係がマンネリ化したら？」
> **独立性** §3と同一Fact群。§3は「新体験で深まる」、本項は「マンネリ時の処方」として出力を分ける
> **状態** 未実装

---

# 27. 「一緒に成長すること」が愛情になる

* 木星・土星・火星・10室的相性が強い二人は、互いの成長を支えること自体を愛情として感じやすい。
* Growth Compatibilityが高いカップルは、何も変わらない関係より、二人で目標へ向かう関係を好みやすい。
* 相手が成長を止めた時、Respect Attractionが下がる場合がある。
* Ambition AlignmentとRespect Attractionが高い人は、恋人の成長停滞を恋愛感情の低下として感じる場合がある。
* 共同成長型カップルは、「安心」だけでは関係満足度が不足する場合がある。

> **占術** 西洋占星術（木星・土星・火星・10室）
> **時刻** 10室使用時は双方必須｜**系統** western
> **スコア** `growth_compatibility` `ambition_alignment` `admiration_mutual`
> **入力** 各自の `respect_attraction`（性格§7）・`effort_respect`（性格§22）
> **用途** 相性「二人で成長できる？」／§45が算出仕様
> **独立性** 性格§49（尊敬喪失で冷める）と連動
> **状態** 未実装

---

# 28. 相手の成功で別れる可能性

* 相手の成功そのものを破局要因としない。
* 成功によってNovelty Seeking / Social Opportunity / Power Balance / Life Stageが大きく変わる場合、関係維持条件が変化しやすい。
* 一方の社会的選択肢が急増した時、元々Commitment Stabilityが低い人物は関係外へ関心が向きやすくなる場合がある。
* Relationship Bindingが強ければ、社会的成功は共同成長として作用しやすい。
* Relationship Bindingが弱く、Novelty Seekingが高い場合、社会的成功は別離の契機になりやすい。
* 「資格取得＝別れる」のような単純ルールにしない。

> **位置づけ** §17の破局側。制約ルールを多く含む
> **スコア** `power_balance` `long_term_binding` `relationship_boredom_risk`
> **用途** 相性「二人の時期の流れ」
> **表現制約** 1行目と最終行が出力規則。**単純ルール化しない**
> **状態** 未実装。`commitment_stability` は §1 の39スコアに含まれない（`trust_stability` で代替可）

---

# 29. 外面が良い人との関係

* Social Charmが高い人物は、第三者・友人・家族・職場からの評価が高くなりやすい。
* Social CharmとPrivate Transparencyは別スコアにする。
* Social Display Affectionが高い人物は、サプライズ・記念日・プレゼントなど目に見える愛情表現が得意になりやすい。
* 外から「素敵な恋人」に見えることと、二人きりの感情的親密性は一致しない場合がある。
* Partner Social ReputationをRelationship Qualityへ直接加点しない。

> **位置づけ** 制約ルール。§16の裏側
> **スコア** `social_display_affection` `private_affection` `transparency`
> **入力** 各自の `social_neutrality` `public_agreeableness`（性格§38）
> **用途** 相性「信頼できる関係？」
> **独立性** 最終行が制約。**外部評価を相性へ加点しない**
> **状態** 未実装。`social_charm` は性格§38 の `social_neutrality` + `public_agreeableness` で代替

---

# 30. 「何を考えているかわからない相手」との関係

* 本人のEmotional Intimacy Needが高く、相手のEmotional Disclosureが低い場合、不満が蓄積しやすい。
* 本人が深い会話を求めるほど、曖昧なコミュニケーションを心理的距離として感じやすい。
* 海王星的シナストリーが強い場合、相手を理解しようとして本人側の推測が増えやすい。
* Mystery Attractionが高い人は、最初は「わからなさ」に惹かれても、長期的にはTransparency不足として苦しくなる場合がある。
* Attraction MysteryとCompatibility Transparencyは逆方向に働くことがある。

> **占術** 西洋占星術（海王星のクロスアスペクト）
> **時刻** 不要｜**系統** western
> **スコア** `mystery_distance` `transparency`
> **入力** 各自の `compatibility_transparency`（性格§8 §48）
> **用途** 相性「相手の本音を理解しやすい？」
> **非対称性** §11と同様に方向を持つ
> **独立性** 最終行が重要。**Attraction と Compatibility が逆向きに働く実例**（性格§10・§46と同一構造）
> **状態** 未実装

---

# 31. 初期の始まり方がその後の関係へ影響する

* シナストリーが同じでも、交際開始時に秘密・三角関係・曖昧さ・不信がある場合、その後のTrust Stabilityを低く補正する。
* Relationship Origin Qualityを別変数として保持する。
* relationship_origin_transparency
* relationship_origin_exclusivity
* relationship_origin_security
* relationship_origin_mutuality
* relationship_origin_timing_quality
* 始まりが曖昧な関係は、その後も「相手が何を考えているかわからない」という認知パターンが残りやすい。
* 初期信頼が低い場合、シナストリー上のCommunication Compatibilityが高くても完全には補えない場合がある。
* 占術だけでなく関係開始時の事実情報をRelationship Scoreへ組み込む。

> **位置づけ** **占術外の事実データ**を相性へ組み込むルール
> **推奨型定義**
> ```ts
> export interface RelationshipOrigin {
>   transparency: number    // 開始時に隠し事がなかったか
>   exclusivity: number     // 三角関係でなかったか
>   security: number        // 不信がなかったか
>   mutuality: number       // 双方向だったか
>   timingQuality: number   // 双方の時期が適切だったか
> }
> ```
> **スコア** `trust_stability`（補正先）`transparency`
> **用途** 相性「信頼できる関係？」
> **独立性** **占術Factを消費しない。**ユーザー入力が必要
> **状態** 未実装。**入力UIが存在しない。**実装するなら相性作成時の任意設問として取る

---

# 32. 職場恋愛特有の相性

* Work Overlapが高い関係は、接触時間が増えるため恋愛開始確率が上がりやすい。
* 同じ仕事をしている二人は、仕事の愚痴・成功・失敗を共有できるためMutual Understandingが高まりやすい。
* 一方で仕事上の評価・役職・競争がRelationship Power Balanceへ流入しやすい。
* 職場で喧嘩するカップルは、Relationship ConflictとCareer Conflictが相互増幅しやすい。
* Work Overlapが高い関係では、仕事と恋愛の境界管理能力をCompatibilityへ追加する。

> **位置づけ** 環境ルール。§18と同一の入力を使う
> **スコア** `mutual_understanding` `power_balance` `conflict_frequency`
> **用途** 相性「喧嘩の原因」／時期§26（社内恋愛）と連動
> **独立性** 占術Factを消費しない
> **状態** 未実装。§18と同じく環境入力UIが必要

---

# 33. 同格の相手への惹かれ方

* Status Attractionが高い人でも、自分と同程度の役職・能力を持つ相手にはMutual Respectが生まれやすい。
* 同格同士は尊敬を得やすい一方、上下関係がないためEgo Competitionも高まりやすい。
* Mutual RespectとPower Competitionが同時に高い関係は、「話は合うが喧嘩も多い」形になりやすい。
* 特に双方が仕事に自信を持っている場合、意見の違いが本人のアイデンティティ否定として感じられやすい。

> **位置づけ** §19の恋愛側。各自の `status_attraction`（性格§7）を入力とする
> **スコア** `admiration_mutual` `ego_competition` `power_balance`
> **用途** 相性「惹かれ合う理由」「二人のプライド」
> **状態** 未実装

---

# 34. 関係の「楽しさ」と「安全性」

* Humor Compatibility・Novelty Compatibility・Adventure CompatibilityをFun Scoreとしてまとめる。
* Emotional Safety・Transparency・Reliability・Repair CapacityをSafety Scoreとしてまとめる。
* Funが高くSafetyも高い関係は、非常に満足度が高くなりやすい。
* Funが高くSafetyが低い関係は、強烈に楽しいが不安定になりやすい。
* Funが低くSafetyが高い関係は、安定するが刺激不足を感じる場合がある。
* FunもSafetyも低い関係は、長期維持動機が弱くなりやすい。
* Relationship CompatibilityではFunとSafetyを別表示する。

> **位置づけ** **合成スコアの定義。4象限の分岐として直接実装できる**
> ```ts
> const funScore = mean([humor_compatibility, novelty_compatibility, adventure_compatibility])
> const safetyScore = mean([emotional_safety, transparency, predictability, repair_capacity])
> // 4象限 → 4つの出力ブロック（原文3〜6行目がそのまま文面の根拠）
> ```
> **用途** 相性の主要カード。**最終行が表示仕様（別表示すること）**
> **独立性** 派生。構成要素を二重表示しない
> **状態** 未実装。**§41 と並んで、相性鑑定の表示構造を決める中核**

---

# 35. 関係の「深さ」と「軽さ」

* Emotional Intimacy・Shared Identity・8室/4室/月的相性が高い関係はDeep Bond型になりやすい。
* 水星・木星・11室・天王星が中心の関係はFriend/Fun型になりやすい。
* 金星・火星中心の関係はRomantic/Physical型になりやすい。
* 土星・4室・7室中心の関係はStable Partnership型になりやすい。
* 冥王星・8室・ノード中心の関係はTransformational型になりやすい。
* 一つのカップルが複数タイプを持つ場合がある。
* Deep Bond型が必ず幸せとは限らず、依存・執着も強くなる場合がある。

> **占術** 西洋占星術（どの天体群が支配的かで5類型へ分類）
> **時刻** ハウス使用時は双方必須｜**系統** western
> **スコア** 5類型それぞれの支配度
> **用途** 相性「この二人だけの関係パターン」
> **独立性** 6行目が重要。**排他分類にしない。複数タイプの同時付与を許す**
> **状態** 未実装。§36 の8タイプと**5類型が別体系**である点に注意。実装時はどちらかに統一するか、両方を別カードとして出す

---

# 36. 関係タイプ分類

二人のスコアから以下のタイプを複数付与する。

## Adventure Partners

* adventure_compatibility 高
* novelty_compatibility 高
* growth_compatibility 高

「一緒に新しい世界を見ることで愛情が育つ二人」

## Power Couple

* ambition_alignment 高
* mutual_admiration 高
* shared_project_compatibility 高

「互いの成長や成功を刺激し合う二人」

## Best Friends

* friendship_compatibility 高
* humor_compatibility 高
* conversational_flow 高

「恋人である前に親友のような二人」

## Deep Bond

* emotional_intimacy 高
* shared_identity 高
* fate_companion_feeling 高

「心と生活が深く結びつきやすい二人」

## Fire & Fight

* romantic_attraction 高
* conflict_intensity 高
* pride_collision 高

「強く惹かれる一方、衝突も激しい二人」

## Roller Coaster

* fun_score 高
* conflict_intensity 高
* emotional_safety 低〜中

「最高と最低の振れ幅が大きい二人」

## Quiet Stability

* stability 高
* domestic_compatibility 高
* conflict_intensity 低

「刺激より安心感で続く二人」

## Mysterious Distance

* attraction 中〜高
* mystery_distance 高
* emotional_intimacy 低
* transparency 低

「惹かれているのに、最後まで相手の内側が見えにくい二人」

> **位置づけ** **8タイプの判定条件と出力文が完全に揃っている。そのまま実装できる**
> ```ts
> export interface RelationType {
>   id: 'adventure_partners' | 'power_couple' | 'best_friends' | 'deep_bond'
>     | 'fire_and_fight' | 'roller_coaster' | 'quiet_stability' | 'mysterious_distance'
>   label: string
>   conditions: Array<{ key: RelationScoreKey | 'fun_score' | 'safety_score'; min?: number; max?: number }>
>   /** 原文の「」内がそのまま文面になる */
>   statement: string
> }
> ```
> **用途** 相性「この二人だけの関係パターン」
> **独立性** **複数付与すること**（原文冒頭）。排他にしない
> **状態** 未実装。**閾値（「高」「低〜中」）が数値で定義されていない。**
> 1,000件の分布から p70 / p30 などで決める必要がある（分布テストの対象）

---

# 37. 今回のA×1996/1/5型から得られるロジック

この実例は以下のパターンの教師データとして扱う。

* Value Alignment 高
* Ambition Alignment 高
* Novelty Compatibility 高
* Adventure Compatibility 高
* Shared Project Compatibility 高
* Emotional Intimacy 高
* Shared Identity 高
* Partnership Team Feeling 高
* Pride Collision 高
* Conflict Frequency 高
* Conflict Intensity 中〜高
* Repair Capacity 高
* Social Display Affection 高

この組み合わせの時は、

「価値観や目指す方向が近く、二人で新しいことへ挑戦するほど仲が深まりやすい。一方で双方のプライドが刺激されやすく、衝突も多い。ただし情緒的な結びつきと修復力が強ければ、喧嘩自体が即座に別離へつながるとは限らない。」

という傾向として出力する。

また、

* Growth Compatibilityが高い関係は、双方の人生フェーズが大きく分岐した時に関係が終了する場合がある。
* 「相性が悪くて別れた」と「相性は良かったが人生方向が分岐した」を区別する。

> **位置づけ** 教師データ1件。**§55のルールにより、1組だけで確認されたルールは仮説扱いとする**
> **対応タイプ** §36 の Adventure Partners + Power Couple + Deep Bond + Fire & Fight の複合
> **実装** 「」内の文章は**出力ブロックとして直接使える**。条件は上記13スコアの複合
> **独立性** **このパターンのウェイトを上げないこと。**複数人物で再現されるまで仮説（§55）
> **状態** 未実装。回帰テストの期待値としては使える

---

# 38. 今回のA×1995/9/3型から得られるロジック

この実例は以下のパターンの教師データ候補として扱う。

* Romantic Attraction 中〜高
* Physical/Initial Attraction 有
* Emotional Intimacy 低〜中
* Conversational Depth 低
* Transparency 低〜中
* Mystery Distance 高
* Shared Identity 低
* Fate Companion Feeling 低
* Acquired Intimacy 低〜中

この組み合わせの時は、

「交際自体は成立しても、時間が経つほど『相手の本心が見えない』『深いところでつながっている感じがしない』という違和感が残りやすい。」

と判定する。

* 恋愛開始の有無とDeep Bondの有無を分ける。
* 交際していた期間だけではEmotional Intimacyを高く判定しない。
* 前の恋愛のShared Identityが非常に高い場合、次の関係の心理的距離をより強く感じる場合がある。
* Relationship Origin Qualityが低かった場合、その影響をTransparencyへ反映する。

> **位置づけ** 教師データ1件。仮説扱い（§55）
> **対応タイプ** §36 の Mysterious Distance
> **独立性** 3行目が§13（初恋比較）、4行目が§31（開始時の質）の適用例
> **状態** 未実装

---

# 39. 今回のA×1992/9/23型から得られるロジック

この実例は以下のパターンの教師データとして扱う。

* Conversational Flow 高
* Humor Compatibility 高
* Mutual Work Understanding 高
* Career Equality 高
* Mutual Respect 中〜高
* Ego Competition 高
* Pride Collision 高
* Conflict Frequency 高
* Conflict Intensity 非常に高い
* Relationship Volatility 高
* Fun Score 高
* Safety Score 低
* Work Relationship Overlap 高

この組み合わせの時は、

「話が合い、盛り上がっている時には非常に楽しい。一方で互いのプライドや仕事観がぶつかりやすく、状態が悪い時の衝突は激しくなりやすい。楽しさと安心感の差が大きい、振れ幅の激しい関係。」

と判定する。

* Humor Compatibilityが非常に高くてもSafety Scoreが低い場合、結婚相性を高くしすぎない。
* Work Overlap × Ego Competition × Pride Collisionが高い場合、喧嘩リスクを大きく加点する。
* 楽しい時間の強さによって不安定な関係が長引く場合がある。

> **位置づけ** 教師データ1件。仮説扱い（§55）
> **対応タイプ** §36 の Roller Coaster + Best Friends + Equal Rivals（§51）
> **独立性** 2行目が§18（職場重複）の適用例。**環境データが必要**
> **状態** 未実装

---

# 40. 「なぜ付き合ったのか」と「なぜ続いたのか」を分ける

恋愛関係について以下を別々に判定する。

## Attraction Driver

付き合い始めた理由。

* physical
* status
* humor
* novelty
* intellectual
* emotional
* admiration
* proximity
* work
* friendship

## Maintenance Driver

関係が続いた理由。

* emotional_safety
* habit
* domestic_life
* shared_projects
* friendship
* sexual_attraction
* admiration
* dependency
* social_structure
* repair_capacity

## Breakdown Driver

関係が壊れやすい理由。

* pride_collision
* secrecy
* value_divergence
* career_divergence
* boredom
* betrayal
* emotional_distance
* competition
* lifestyle_difference
* poor_repair

* Attraction DriverとMaintenance Driverが異なる関係は多い。
* 「付き合えた理由」がなくなっても、Maintenance Driverが強ければ関係は続く。
* Attractionが強くてもMaintenance Driverが弱い関係は短期化しやすい。

> **位置づけ** **3つのドライバーを分離する構造定義。相性鑑定の物語性を作る中核**
> ```ts
> export type AttractionDriver = 'physical' | 'status' | 'humor' | 'novelty' | 'intellectual'
>   | 'emotional' | 'admiration' | 'proximity' | 'work' | 'friendship'
> export type MaintenanceDriver = 'emotional_safety' | 'habit' | 'domestic_life' | 'shared_projects'
>   | 'friendship' | 'sexual_attraction' | 'admiration' | 'dependency' | 'social_structure' | 'repair_capacity'
> export type BreakdownDriver = 'pride_collision' | 'secrecy' | 'value_divergence' | 'career_divergence'
>   | 'boredom' | 'betrayal' | 'emotional_distance' | 'competition' | 'lifestyle_difference' | 'poor_repair'
>
> interface DriverRanking { driver: string; weight: number; contributingFacts: string[] }
> ```
> **実装** 各ドライバーを §1 のスコアから算出し、**上位2件のみ出力する**。全件出すと読み物にならない
> **用途** 相性「惹かれ合う理由」「長く続ける条件」「すれ違いやすい場面」の**3章がこの構造にそのまま対応する**
> **状態** 未実装。**AIを外しても「二人だけの物語」に感じられるかは、この項目の実装品質で決まる**

---

# 41. 相性点より「相性プロファイル」を優先する

最終的な二人鑑定では100点満点だけを出さない。

最低でも以下を個別表示する。

* ときめき
* 会話
* 心の深さ
* 安心感
* 価値観
* 一緒に成長する力
* 生活相性
* 友情
* 喧嘩しやすさ
* 仲直り力
* 信頼
* 刺激
* 長期安定
* 結婚生活
* 運命共同体感

例えば、

「総合相性80%」

だけではなく、

「一緒に世界を広げる相性 94%
心の深さ 91%
日常生活 82%
喧嘩の少なさ 35%
仲直り力 89%」

のように、矛盾した性質を同時に出せる構造にする。

> **位置づけ** **表示仕様。15項目のプロファイル表示**
> **対応**
> | 表示名 | RelationScoreKey |
> |---|---|
> | ときめき | `romantic_attraction` |
> | 会話 | `conversational_flow` |
> | 心の深さ | `emotional_intimacy` |
> | 安心感 | `emotional_safety` |
> | 価値観 | `value_alignment` |
> | 一緒に成長する力 | `growth_compatibility` |
> | 生活相性 | `domestic_compatibility` |
> | 友情 | `friendship_compatibility` |
> | 喧嘩しやすさ | `conflict_frequency` |
> | 仲直り力 | `repair_capacity` |
> | 信頼 | `trust_stability` |
> | 刺激 | `novelty_compatibility` |
> | 長期安定 | `long_term_binding` |
> | 結婚生活 | `marriage_compatibility`（§57で定義） |
> | 運命共同体感 | `fate_companion_feeling` |
> **独立性** **矛盾する値を同時に出せること**が要件。総合点で平均して潰さない
> **状態** 未実装。**現行の相性鑑定に相当する表示が存在しない**

---

# 42. 喧嘩スコアの計算

Conflict Riskを以下から構成する。

* mars_hard_aspects
* sun_mars_hard
* mercury_mars_hard
* moon_mars_hard
* pluto_personal_hard
* pride_collision
* ego_competition
* work_overlap
* emotional_volatility_difference

ただしRelationship Damageは、

Conflict Risk単体ではなく、

# relationship_damage

conflict_intensity
× (1 - repair_capacity)
× (1 - emotional_safety)
× resentment_accumulation

で考える。

よく喧嘩してもRepair Capacityが高い二人は、破局確率を過大評価しない。

> **位置づけ** **喧嘩スコアの算出仕様。式が明示されている**
> ```ts
> const conflictRisk = weightedSum([
>   marsHardAspects, sunMarsHard, mercuryMarsHard, moonMarsHard, plutoPersonalHard,
>   prideCollision, egoCompetition, workOverlap, emotionalVolatilityDifference,
> ])
> const relationshipDamage =
>   conflict_intensity * (1 - repair_capacity) * (1 - emotional_safety) * resentment_accumulation
> ```
> **注意** `resentment_accumulation` は §1 の39スコアに**含まれていない**。
> 式で必須なので `RELATION_SCORE_KEYS` へ追加すること（→ 40件になる）。
> `emotional_volatility_difference` は各自の `emotional_volatility`（性格§24）の差分から算出する
> **入力** 性格§14 `pride_sensitivity` / 性格§24 `emotional_volatility` / §18 環境データ
> **用途** 相性「喧嘩の原因」「喧嘩した後、戻れる二人？」
> **状態** 未実装。**性格§14・§24 が前提**

---

# 43. 心の深さスコア

Emotional Intimacyは以下を重視する。

* Moon ↔ Moon
* Sun ↔ Moon
* Mercury ↔ Moon
* Venus ↔ Moon
* Pluto ↔ Moon
* 4th-house overlays
* 8th-house overlays
* Node ↔ personal planets
* Water element compatibility
* emotional_disclosure compatibility

ただし冥王星・8室は深さと同時に執着も増やすため、

* emotional_depth
* emotional_safety
* dependency_intensity

を別々に計算する。

> **位置づけ** `emotional_intimacy` の算出仕様
> **時刻** 4室・8室オーバーレイに双方必須。月同士・太陽月は時刻不要
> **独立性** 冥王星は世代天体だが、月への接触は個人固有
> **重要** 最終ブロックが制約。**深さを安全性へ流用しない。`dependency_intensity` を別途出す**
> **状態** 未実装。**月同士・太陽↔月・水星↔月・金星↔月の4つは時刻不要で計算できる**ため、
> 時刻なしユーザーにも `emotional_intimacy` を confidence 低めで出せる（§54）

---

# 44. 会話相性スコア

Conversational Flowは以下を重視する。

* Mercury ↔ Mercury
* Mercury ↔ Sun
* Mercury ↔ Venus
* Mercury ↔ Jupiter
* Mercury ↔ Uranus

Conversational Depthは以下を別途重視する。

* Mercury ↔ Moon
* Mercury ↔ Pluto
* Mercury ↔ 8th house
* Mercury ↔ IC
* Moon ↔ Pluto

水星同士が良いだけでは「深い会話ができる」と判定しない。

> **位置づけ** `conversational_flow` / `conversational_depth` の算出仕様
> **時刻** Flow は**全て時刻不要**。Depth は 8室・IC に双方必須
> **系統** western
> **用途** 相性「会話の相性」
> **独立性** 最終行が制約。§9・§10の実装仕様
> **状態** 未実装。**`conversational_flow` は5組すべてが時刻不要。相性決定論化で最初に実装すべき**

---

# 45. 共同成長スコア

Growth Compatibilityは以下を重視する。

* Jupiter ↔ Sun
* Jupiter ↔ Moon
* Jupiter ↔ Mercury
* Jupiter ↔ Mars
* Jupiter ↔ ASC
* Saturn harmonious aspects
* 9th/10th/11th house overlays
* similar ambition scores
* similar novelty scores

Growth Compatibilityが高い場合、

「一緒に何かへ挑戦している時ほど、二人の関係が生き生きしやすい」

と出力する。

> **位置づけ** `growth_compatibility` の算出仕様
> **時刻** ASC・9/10/11室に双方必須。木星↔太陽/月/水星/火星 は時刻不要
> **入力** 各自の `ambition`（性格§4 `career_absorption`）・`novelty_attraction`（性格§9）
> **出力** 「」内が**そのまま文面**として使える
> **状態** 未実装

---

# 46. 運命共同体スコア

Fate Companion Feelingは以下から算出する。

* Sun/Moon cross-aspects
* Moon/ASC
* Moon/IC
* Venus/Moon
* Node/personal planets
* 4th-house overlays
* 7th-house overlays
* 8th-house overlays
* Saturn binding
* long-term shared_environment
* acquired_intimacy

ただしSaturn Bindingが高い場合、

「離れられない」ことを「幸せ」と誤判定しない。

Fate Companion FeelingとRelationship Satisfactionを別スコアにする。

> **位置づけ** `fate_companion_feeling` の算出仕様
> **時刻** ASC・IC・4/7/8室に双方必須｜**系統** western
> **入力** `shared_environment` `acquired_intimacy`（§12の環境データ）
> **独立性** **最終2行が最重要の制約。**土星による拘束を満足度へ加点しない
> **状態** 未実装。§2の実装仕様にあたる

---

# 47. 楽しいが危険な関係

以下が重なる時は、Roller Coaster型として判定する。

* attraction 高
* humor 高
* conversational_flow 高
* mars/pluto tension 高
* pride_collision 高
* emotional_safety 低
* repair_capacity 低〜中

出力：

「二人には強い楽しさと引力があります。ただ、状態が悪い時にはそのエネルギーがそのまま衝突へ転じやすい関係です。」

> **位置づけ** §36 Roller Coaster の判定条件と出力文
> **実装** 7条件 + 出力文。**そのままブロックとして使える**
> **状態** 未実装

---

# 48. 深くて喧嘩も多い関係

以下が重なる時はDeep & Fiery型として判定する。

* emotional_intimacy 高
* shared_identity 高
* value_alignment 高
* pride_collision 高
* conflict_frequency 高
* repair_capacity 高

出力：

「穏やかな二人というより、深く関わるからこそよくぶつかる二人。ただ、ぶつかった後に戻れる力も強い関係です。」

> **位置づけ** 関係タイプの判定条件と出力文（§36の8タイプには含まれない9つ目）
> **注意** §36 と §47〜§51 で**タイプ体系が二重になっている**。
> 実装時は §36 の8タイプへ Deep & Fiery / Shared Mission / Equal Rivals / Quiet Distance を加えた**12タイプに統合すること**
> **状態** 未実装

---

# 49. 平和だが距離のある関係

以下が重なる時はQuiet Distance型として判定する。

* conflict_frequency 低
* emotional_intimacy 低
* conversational_depth 低
* mystery_distance 高
* transparency 低〜中

出力：

「大きくぶつかることは少なくても、相手の内側まで入り込む感覚は弱くなりやすい関係です。」

> **位置づけ** 関係タイプの判定条件と出力文。§24の実装仕様
> **状態** 未実装

---

# 50. 二人で何かをしている時ほど仲が良い関係

以下が重なる時はShared Mission型として判定する。

* growth_compatibility 高
* adventure_compatibility 高
* ambition_alignment 高
* shared_project_compatibility 高
* relationship_stimulation_need 高

出力：

「この二人は、ただ一緒にいるより、二人で何かを目指している時の方が関係が輝きやすいタイプです。」

Relationship Boredom Riskも高い場合、

「関係がマンネリ化した時は、旅行・勉強・副業・新しい趣味など、二人の共通プロジェクトを作ることで関係が再活性化しやすい」

とアドバイスする。

> **位置づけ** 関係タイプの判定条件と出力文。§3・§26 の実装仕様
> **実装** 条件付きの追加文（Boredom Risk 高）を持つ。**action role のブロックとして使える**
> **状態** 未実装

---

# 51. 同格ライバル型カップル

以下が重なる時はEqual Rivals型として判定する。

* mutual_admiration 高
* career_equality 高
* ambition_alignment 高
* pride_collision 高
* ego_competition 高
* work_overlap 高

出力：

「互いに相手の能力を認められる一方、似た土俵にいるからこそ競争心も刺激されやすい二人です。尊敬がある時は最高の同志になれますが、勝ち負けの構図になると衝突が激しくなりやすいでしょう。」

> **位置づけ** 関係タイプの判定条件と出力文。§19・§33 の実装仕様
> **注意** `career_equality` と `work_overlap` は**環境データ**であり占術Factではない。
> 環境入力がない場合、このタイプは**判定不能**として付与しない
> **状態** 未実装

---

# 52. 相手を理解できる感覚

Mutual Understandingを以下に分解する。

## Cognitive Understanding

「何を考えているかわかる」

* Mercury compatibility
* Sun/Mercury
* Mercury/Mercury

## Emotional Understanding

「どう感じているかわかる」

* Moon/Mercury
* Moon/Moon
* Moon/Venus

## Deep Understanding

「本人も言葉にしていない部分まで感じる」

* Moon/Pluto
* Mercury/Pluto
* 8th-house connections
* IC connections

一つが高くても、他が高いとは限らない。

> **位置づけ** `mutual_understanding` の3分解
> **時刻** Cognitive / Emotional は**時刻不要**。Deep は 8室・IC に双方必須
> **実装** `mutual_understanding` を単一値にせず、3成分を保持して個別表示する
> ```ts
> interface MutualUnderstanding {
>   cognitive: number; emotional: number; deep: number
> }
> ```
> **用途** 相性「相手の本音を理解しやすい？」
> **独立性** 最終行が制約。3成分を平均して潰さない
> **状態** 未実装

---

# 53. 相性鑑定の文章生成ロジック

「相性が良いです」で終わらせない。

以下の構造で文章を生成する。

1. 二人が自然に惹かれる理由
2. 一緒にいると何が楽しいか
3. 二人が深くつながれる部分
4. 日常生活で合う部分
5. ぶつかりやすい部分
6. 喧嘩した時の修復力
7. この関係が続くために必要なこと
8. 二人だからできること
9. AttractionとLong-term Compatibilityの違い
10. この関係特有のテーマ

> **位置づけ** **相性鑑定の章構成そのもの**
> **対応**
> | # | 章 | 主要スコア | 出典節 |
> |---|---|---|---|
> | 1 | 惹かれる理由 | `romantic_attraction` + Attraction Driver | §40 §33 |
> | 2 | 楽しいこと | `fun_score` | §34 §9 §21 |
> | 3 | 深くつながれる部分 | `emotional_intimacy` | §43 §10 |
> | 4 | 日常生活 | `domestic_compatibility` `lifestyle_alignment` | §25 §14 |
> | 5 | ぶつかりやすい部分 | `conflict_risk` | §42 §6 |
> | 6 | 修復力 | `repair_capacity` | §7 §8 |
> | 7 | 続くために必要なこと | Maintenance Driver | §40 |
> | 8 | 二人だからできること | `shared_project_compatibility` | §4 §50 |
> | 9 | Attraction と Long-term の違い | 両者の乖離 | §57 性格§10 §46 |
> | 10 | この関係特有のテーマ | 関係タイプ | §36 §47〜§51 |
> **状態** 未実装。**現行の相性8章とほぼ対応するが、中身が3パターンしかない**

---

# 54. 出生時刻不明の相手との相性

* 相手の出生時刻が不明の場合、相手のASC・MC・ハウスを使用しない。
* 相手の月が当日にサイン移動する場合、月関連相性は確定扱いしない。
* 紫微斗数の相性は使用しない。
* 四柱推命の時柱は使用しない。
* 宿曜は日付から算出できる範囲のみ使用する。
* 太陽・水星・金星・火星・木星・土星など日付でほぼ確定する要素を中心に判定する。
* 時刻不明の場合、Emotional Intimacyなど月・ハウス依存スコアのConfidenceを下げる。

> **位置づけ** データ品質の制約ルール。**時期§46 の相性版**
> **実装** `SynastryFact.requiresSelfBirthTime` / `requiresPartnerBirthTime` によるFact除外 + `confidence` の減衰
> **時刻不要で計算できるスコア一覧**（本項6行目の適用）
> - `conversational_flow`（§44 の5組すべて）
> - `repair_capacity` / `forgiveness_capacity`（§7）
> - `value_alignment` の一部（太陽・金星）
> - `growth_compatibility` の一部（木星↔太陽/水星/火星）
> - `conflict_intensity` の一部（太陽↔火星、火星↔火星）
> - 宿曜の宿関係（§15）
> **状態** **未実装。`deterministicCompatibility.ts` は `requiresBirthTime` を一切参照していない。**
> 現行の決定論相性は日干とライフパスのみなので偶然この制約に違反していないが、
> シナストリーを実装する際は**最初にこの分岐を入れること**

---

# 55. 実体験データによる補正

ユーザーから実際の関係性データがある場合、

* synastry_prediction
* observed_relationship_data

を別保存する。

Observed Dataによって出生図の意味そのものを変更するのではなく、

「どの配置がどの現象として出たか」

を教師データとして蓄積する。

例えば、

* 火星ハード → 喧嘩
* 木星強 → 共同挑戦
* 水星強 → 会話の楽しさ
* 月・8室強 → 深い心のつながり

など複数人物で再現された時に、そのルールのウェイトを上げる。

1組だけで確認されたルールは仮説扱いとする。

> **位置づけ** 学習の制約ルール
> **重要** **最終行が §37〜§39 の教師データ3件に適用される。3件はいずれも仮説扱い**
> **実装** 予測と観測を別保存し、**観測が出生図の解釈を書き換えないようにする**
> ```ts
> interface RelationshipObservation {
>   synastryPrediction: RelationScore[]   // 生成時のスコア
>   observedOutcome: Record<string, unknown>  // ユーザー入力
>   // 予測を上書きしない。別レコードとして蓄積するだけ
> }
> ```
> **状態** 未実装。**決定論化の初期段階では実装しないこと。**ウェイト自動調整は再現性を壊す

---

# 56. 今回最も重要な発見

* 「喧嘩が多い」と「相性が悪い」は同義ではない。
* 「喧嘩しない」と「深くつながっている」も同義ではない。
* 心の深さと会話の楽しさは別。
* 楽しい関係と安全な関係は別。
* 一緒に新しい体験をすること自体が愛情維持装置になるカップルが存在する。
* 共同目標を持つことで強くなるカップルが存在する。
* 野心が似ていることは共同成長にはプラスだが、プライド衝突にはマイナスになり得る。
* 同じ仕事・同じ役職は理解を深める一方、競争と喧嘩も増幅する場合がある。
* 強い感情的結合＋強い衝突＋高い修復力という関係が存在する。
* 会話が盛り上がる＋心は通じないという関係も存在する。
* 相手のことが読めない状態は、会話量では解消されない場合がある。
* サプライズなど外向きの愛情表現と、内面的な親密さは別。
* 初恋・最初の同棲・初めての運命共同体型恋愛は、その後の恋愛比較基準になりやすい。
* 相性が良い二人でも、人生フェーズ・社会的成功・価値観の変化によって別れることがある。
* 別れたことを理由に「相性が悪かった」と逆算しない。
* 長続きしたことを理由に「相性が良かった」と逆算しない。
* Relationship Qualityは、Attraction / Depth / Fun / Safety / Growth / Conflict / Repair / Stabilityに分ける。

> **位置づけ** 全体のまとめ。**最後の3行が最も重要な制約**
> **対応節** §7 / §24 / §10 / §34 / §3 / §4 / §5 / §18 / §48 / §10 / §11 / §16 / §13 / §17 / §55 / §55 / §41
> **実装** 15〜16行目（逆算の禁止）は §55 の学習制約として実装する
> **状態** 制約として一部実装可能

---

# 57. 最終的な二人相性の計算構造

relationship_profile =
{
attraction,
emotional_depth,
communication,
fun,
friendship,
values,
lifestyle,
growth,
shared_mission,
domestic,
trust,
transparency,
conflict,
pride_collision,
repair,
stability,
fate_companion,
marriage_compatibility
}

総合点だけではなく、このプロファイル自体を鑑定の中心にする。

最終的な長期相性は、

# long_term_quality

emotional_safety

* transparency
* value_alignment
* domestic_compatibility
* friendship_compatibility
* repair_capacity
* growth_compatibility

- destructive_conflict
- secrecy
- unresolved_power_struggle

を中心に算出する。

AttractionはLong-term Qualityへそのまま大きく加点しない。

> **位置づけ** **最終出力の構造定義**
> ```ts
> export interface RelationshipProfile {
>   attraction: number; emotional_depth: number; communication: number; fun: number
>   friendship: number; values: number; lifestyle: number; growth: number
>   shared_mission: number; domestic: number; trust: number; transparency: number
>   conflict: number; pride_collision: number; repair: number; stability: number
>   fate_companion: number; marriage_compatibility: number
> }
>
> const longTermQuality =
>   emotional_safety + transparency + value_alignment + domestic_compatibility
>   + friendship_compatibility + repair_capacity + growth_compatibility
>   - destructive_conflict - secrecy - unresolved_power_struggle
> // AttractionはLong-term Qualityへ大きく加点しない（原文最終行）
> ```
> **注意** 原文のリスト記法（`*` と `-`）は**加算項と減算項**を意味している。
> Markdownの箇条書きと紛らわしいため、実装時は上記の式を正とすること
> **未定義スコア** `destructive_conflict` `secrecy` `unresolved_power_struggle` は §1 の39スコアに含まれない。
> それぞれ `conflict_intensity × (1 - repair_capacity)` / `1 - transparency` / `power_balance` の拮抗度で代替する
> **状態** 未実装。**§41 の表示仕様と一体で実装すること**

---

# 58. FateLabで特に出す価値がある二人鑑定

ユーザーに以下を別カードとして提示する。

* 「なぜ二人は惹かれ合う？」
* 「一緒にいると楽しいこと」
* 「心の深いところの相性」
* 「会話の相性」
* 「二人の価値観」
* 「二人で成長できる？」
* 「一緒に暮らした時の相性」
* 「喧嘩の原因」
* 「喧嘩した後、戻れる二人？」
* 「二人のプライド」
* 「信頼できる関係？」
* 「相手の本音を理解しやすい？」
* 「友達としての相性」
* 「恋人としての相性」
* 「結婚相手としての相性」
* 「二人でいると広がる世界」
* 「この関係がマンネリ化したら？」
* 「あなたが相手に求めすぎること」
* 「相手があなたに求めること」
* 「この二人だけの関係パターン」

> **位置づけ** **カード構成の定義（20枚）**
> **現行との差** 現在の相性鑑定は8章（恋愛/片思い/交際中/婚約・夫婦/復縁/友人/家族 + 二人の本質など）。
> 本項の20カードは**関係ラベルによる分岐ではなく、軸による分割**である。
> 実装時はどちらを採るか決める必要がある。**推奨は本項の20カードを基本とし、関係ラベルで表示順と文面のトーンを変える方式**
> （関係ラベルごとに20カードを書き分けると 6ラベル × 20 = 120章分の文章資産が必要になり、破綻する）
> **各カードの根拠**
> | カード | 出典節 | 時刻要否 |
> |---|---|---|
> | なぜ惹かれ合う？ | §40 §33 §2 | 一部必要 |
> | 一緒にいると楽しいこと | §9 §21 §34 | **不要** |
> | 心の深いところの相性 | §43 §10 | 一部必要 |
> | 会話の相性 | §44 §9 | **不要** |
> | 二人の価値観 | §14 §22 | 一部必要 |
> | 二人で成長できる？ | §45 §27 | 一部必要 |
> | 一緒に暮らした時の相性 | §25 §14 | 必要 |
> | 喧嘩の原因 | §42 §6 §22 | 一部必要 |
> | 喧嘩した後、戻れる二人？ | §7 §8 §23 | **不要** |
> | 二人のプライド | §6 §19 §33 | 必要 |
> | 信頼できる関係？ | §29 §31 | 一部必要 |
> | 相手の本音を理解しやすい？ | §11 §30 §52 | 一部必要 |
> | 友達としての相性 | §9 §21 性格§40 | 一部必要 |
> | 恋人としての相性 | §36 §41 | 一部必要 |
> | 結婚相手としての相性 | §57 性格§51 | 必要 |
> | 二人でいると広がる世界 | §3 §26 §50 | 一部必要 |
> | マンネリ化したら？ | §26 §50 | 一部必要 |
> | あなたが相手に求めすぎること | §16 §30 | 一部必要 |
> | 相手があなたに求めること | §16 §29 | 一部必要 |
> | この二人だけの関係パターン | §36 §47〜§51 | 一部必要 |
> **状態** 未実装。**4カードが完全に時刻不要**であり、時刻なしユーザーにも成立する

---

## 実装状況サマリ

| 状態 | 件数 |
|---|---|
| 実装済み | **0** |
| 部分実装 | **0** |
| 未実装 | 58 |

シナストリー計算がリポジトリに存在しないため、本文書は全項目が未実装である。

## 時刻不要で実装できる項目（優先実装候補）

相性鑑定は**相手の出生時刻が不明なケースが多い**ため、時刻不要の軸から作ると適用範囲が広い。

| 順位 | 項目 | 内容 | 理由 |
|---|---|---|---|
| 1 | **§15** | 宿曜の宿関係（栄親等） | `getSukuyo()` が既にある。27×27の判定表を足すだけ。時刻不要 |
| 2 | **§44 Flow** | `conversational_flow`（水星の5組） | 全て時刻不要。§9 の出力に直結 |
| 3 | **§7** | `repair_capacity` `emotional_safety` | 全て時刻不要。§42 の破局式の分母 |
| 4 | **§43 の一部** | `emotional_intimacy`（月同士・太陽↔月・水星↔月・金星↔月） | 4組が時刻不要 |
| 5 | **§34** | Fun / Safety の4象限 | 上記の合成だけで出せる |
| 6 | **§40** | 3つのドライバー分離 | 物語性の中核。上記スコアから算出 |
| 7 | **§36 §47〜§51** | 関係タイプ12種 | 判定条件と出力文が完全に揃っている |
| 8 | **§41 §57** | プロファイル表示と長期相性 | 表示仕様。上記の集約 |

**§15〜§34（順位1〜5）だけで、現行の「実質3パターン」から
Fun/Safety の4象限 × 会話 × 深さ × 修復力の多軸プロファイルまで到達できる。**
ハウス・ASC・MC を使う項目（§2 §25 §46 など）はその後でよい。

## 根拠不足・要判断の一覧

| 項目 | 出典 | 内容 |
|---|---|---|
| `resentment_accumulation` | §42 | 破局式に必須だが §1 の39スコアに含まれない。**追加が必要** |
| `relationship_volatility` | §20 | 式は明示されているが §1 に含まれない。派生値として算出可 |
| `career_equality` `work_relationship_overlap` `conflict_spillover_risk` | §18 §39 §51 | 環境データ由来。**入力UIが存在しない** |
| `marriage_compatibility` | §41 §57 | §57 の `long_term_quality` と同義か別か不明 |
| `destructive_conflict` `secrecy` `unresolved_power_struggle` | §57 | §1 に含まれない。代替式は §57 のメタに記載 |
| `commitment_stability` | §28 | §1 に含まれない。`trust_stability` で代替 |
| §36 の閾値（「高」「低〜中」） | §36 | 数値未定義。1,000件の分布から p70 / p30 等で決める |
| タイプ体系の二重化 | §35 §36 §47〜§51 | 5類型 / 8タイプ / 追加4タイプが併存。**12タイプへの統合を推奨** |
| カード構成 | §58 | 20カード（軸別）と現行8章（関係ラベル別）のどちらを採るか |
| 環境データ | §12 §18 §25 §31 §32 | 同棲・交際期間・職場重複・開始時の状況。**取得UIが存在しない** |
