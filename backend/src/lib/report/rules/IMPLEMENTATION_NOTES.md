# 実装補足書

`PERSONALITY_RULES.md`（§1〜§58）・`EVENT_RULES.md`（§1〜§53）に対応する実装メモ。

---

## 0. この文書群の作成方針（先に読むこと）

**復元元**：会話に添付された3つの原文ドキュメント。

| 原文 | 項番 | 生成物 |
|---|---|---|
| 性格・恋愛傾向ロジック追加一覧 | §0〜§58 | `PERSONALITY_RULES.md` |
| 占いロジック追加用ルール一覧 | §0〜§53 | `EVENT_RULES.md` |
| 二人の関係性・シナストリーロジック追加一覧 | §0〜§58 | **未作成**（依頼対象外。同様に完全な原文が存在する） |

**やったこと**
- 箇条書き本文を**一字も変えずに転記**した。
- 各節に実装メタ（占術・時刻要否・系統・スコア・用途・独立性・状態）を追加した。
- メタは原文中に明示された要素からのみ導出した。

**やらなかったこと**
- 占術ルールの新規作成。71スコアを埋めるための推測は行っていない。
- 全111節分の鑑定文サンプル作成。これは占術の問題ではなく文章資産（PR-2）の作業であり、
  ここで書くと「根拠を追跡できないテンプレート」を111個増やすことになるため意図的に見送った。
  文章ブロックの型と粒度は §4 に示す。

---

## 1. 71スコアとの対応表

`traitScores.ts` の `ALL_TRAIT_SCORE_KEYS` と `PERSONALITY_RULES.md` の対応。

### Personality（45）

| スコア | 対応節 | 状態 |
|---|---|---|
| `social_extraversion` | §1 §2 §18 §37 §52 | 実装済み |
| `private_introversion` | §1 §2 §18 §52 | 実装済み |
| `social_sensitivity` | §16 §17 §29 | 根拠あり・未実装 |
| `public_agreeableness` | §16 §37 §38 | 根拠あり・未実装 |
| `private_assertiveness` | §16 §41 | 根拠あり・未実装 |
| `immersion_intensity` | §3 §4 §5 §50 | 根拠あり・未実装 |
| `career_absorption` | §4 §50 | 根拠あり・未実装 |
| `romantic_absorption` | §4 §5 §47 §50 | 根拠あり・未実装 |
| `approval_need` | §6 §15 §47 | 根拠あり・未実装 |
| `recognition_motivation` | §15 | 根拠あり・未実装 |
| `pride_sensitivity` | §14 §15 §38 §39 §47 | 根拠あり・未実装 |
| `self_complexity` | §1 §18 | 根拠あり・未実装 |
| `loneliness_tendency` | §2 §18 | 根拠あり・未実装 |
| `status_attraction` | §6 §7 §8 §47 | 根拠あり・未実装 |
| `respect_attraction` | §6 §7 §22 §49 | 根拠あり・未実装 |
| `charisma_attraction` | §9 §47 | 根拠あり・未実装 |
| `novelty_attraction` | §9 | 根拠あり・未実装 |
| `intellectual_attraction` | §27 | 根拠あり・未実装 |
| `age_gap_attraction` | §30 | 根拠あり・未実装 |
| `authority_attraction` | §30 | 根拠あり・未実装 |
| `stability_preference` | §31 | 根拠あり・未実装 |
| `reliability_preference` | §10 §13 | 根拠あり・未実装（判断1で訂正） |
| `friendship_orientation` | §20 §32 | 根拠あり・未実装 |
| `domestic_affection` | §35 | 根拠あり・未実装 |
| `family_orientation` | §34 | 根拠あり・未実装 |
| `practical_generosity` | §36 §38 | 根拠あり・未実装 |
| `partner_mirroring` | §11 §21 §42 | 根拠あり・未実装 |
| `social_conformity` | §12 §13 §42 §43 | 根拠あり・未実装 |
| `plan_orientation` | §12 §13 | 根拠あり・未実装 |
| `emotional_volatility` | §24 §33 §41 | 根拠あり・未実装 |
| `emotional_expression` | §25 | 根拠あり・未実装 |
| `relationship_boundary_strength` | §19 §37 §49 | 根拠あり・未実装 |
| `tolerance` | §19 §40 §41 | 根拠あり・未実装 |
| `gossip_curiosity` | §28 | 根拠あり・未実装 |
| `taboo_curiosity` | §28 §29 | 根拠あり・未実装 |
| `playfulness` | §26 | 根拠あり・未実装 |
| `conversation_entertainment` | §27 | 根拠あり・未実装 |
| `group_coordination` | §23 | 根拠あり・未実装 |
| `effort_respect` | §22 §49 | 根拠あり・未実装 |
| `social_neutrality` | §14 §38 §39 | 根拠あり・未実装 |
| `neutrality_pride` | §14 §39 | 根拠あり・未実装 |
| `lifestyle_adaptability` | §11 | 根拠あり・未実装 |
| `friendship_value_match` | §20 §40 §43 | 根拠あり・未実装 |
| `friendship_independence` | §21 §42 | 根拠あり・未実装 |
| `life_stage_alignment` | §21 §42 §43 | 根拠あり・未実装 |

### Attraction（10）

| スコア | 対応節 | 状態 |
|---|---|---|
| `attraction_status` | §6 §7 §8 §31 §48 §51 | 実装済み |
| `attraction_respect` | §6 §7 | 実装済み |
| `attraction_charisma` | §9 §10 §51 | 根拠あり・未実装 |
| `attraction_novelty` | §9 | 根拠あり・未実装 |
| `attraction_intellectual` | §27 | 根拠あり・未実装 |
| `attraction_age_gap` | §30 §48 | 根拠あり・未実装 |
| `attraction_authority` | §30 §48 | 根拠あり・未実装 |
| `attraction_physical` | — | **保留キー**（判断1。`confidence: 0` を返す） |
| `attraction_friendship` | §32 | 根拠あり・未実装 |
| `attraction_intensity` | §5 | 根拠あり・未実装 |

### Compatibility（11）

| スコア | 対応節 | 状態 |
|---|---|---|
| `compatibility_stability` | §9 §10 §47 | 根拠あり・未実装 |
| `compatibility_reliability` | §10 §51 | 根拠あり・未実装 |
| `compatibility_transparency` | §8 §47 §48 §51 | 根拠あり・未実装 |
| `compatibility_friendship` | §32 §33 §40 §41 §43 §51 | 根拠あり・未実装 |
| `compatibility_domestic` | §10 §35 §51 | 根拠あり・未実装 |
| `compatibility_playfulness` | §26 §53 | 根拠あり・未実装 |
| `compatibility_independence` | §2 §52 | 根拠あり・未実装（判断1で訂正） |
| `compatibility_family_orientation` | §34 | 根拠あり・未実装 |
| `compatibility_lifestyle` | §40 §52 §53 | 根拠あり・未実装 |
| `compatibility_emotional_safety` | §31 §51 | 根拠あり・未実装 |
| `compatibility_value_match` | §12 §20 §51 | 根拠あり・未実装（判断1で訂正） |

### Binding（5）

| スコア | 対応節 | 状態 |
|---|---|---|
| `long_term_binding` | §10 §32 §33 §42 | 根拠あり・未実装 |
| `marriage_binding` | §10 §13 §51 | 根拠あり・未実装 |
| `domestic_binding` | §34 §35 | 根拠あり・未実装 |
| `responsibility_binding` | 性格§13 + 時期§4 | 根拠あり・未実装（判断1で訂正） |
| `friendship_binding` | §32 | 根拠あり・未実装 |

### 集計

| 区分 | 件数 |
|---|---|
| 根拠のある節に対応がある | **70 / 71** |
| 保留キー（根拠なし） | 1（`attraction_physical`） |
| 現在コードに実装済み | 4（`private_introversion` `social_extraversion` `attraction_respect` `attraction_status`） |

**推測でルールを作っていない。** 判断1（§8）で4件の根拠を訂正した結果、未対応は1件のみになった。

---

## 2. ルール間の重複

同じ占術Factを複数の節が参照している。**同じFactから複数回加点しないこと。**

### 性格ルール内の重複

| 重複グループ | 共有Fact | 統合方針 |
|---|---|---|
| §6 §7 §14 §15 | 月–MC/10室の接触 | §7で1票。§6は「承認」、§14は「プライド」、§15は「評価欲求」として**出力先だけ分ける** |
| §1 §2 §18 | 月–4/8/12室 | §2で1票。§1は外向との差、§18は孤独として出力 |
| §3 §4 §5 | 8室・冥王星・火星 | §3で1票。§4は仕事側、§5は恋愛側の投影 |
| §7 §8 §30 §48 | 金星・7室支配星・MC/木星/土星 | §7で1票。§8はスペック、§30は年齢差、§48は理想化 |
| §12 §13 | 土星・山羊座・10室 | §12で1票 |
| §26 §27 §28 §29 | 水星（+木星／8室・冥王星） | §27で1票。§26は面白がる力、§28-29は好奇心の方向 |
| §34 §35 | 月–4室・金星 | §34で1票 |
| §16 §17 | 月・水元素・天秤座・7室 | §16で1票 |
| §19 §37 | 固定宮・冥王星 | §19で1票 |
| §14 §39 | 太陽・土星 | §14で1票。§39は「何に誇りを持つか」の分類先 |

### 時期ルール内の重複

| 重複グループ | 共有Fact | 統合方針 |
|---|---|---|
| 時期§6 の 冲・破・害 | 同一の日支Fact | 3つを独立票にしない。1票＋方向性の違い |
| 時期§12 §13 | MC・10室支配星 | §12で1票。§13は「所属が変わる」側 |
| 時期§25 §26 | 7室＝10室支配星 | **恋愛と仕事が同一Fact由来**。2票にしない |
| 時期§5 §28 | 合と冲の同時継続 | 同一条件。1ルールへ統合可 |
| 時期§18 §19 | 9室支配星・土星–ノード | §18で1票 |
| 時期§34 §37 | 天中殺・納音 | 四柱と同一 `canonicalSourceId`。**独立票にしない** |

### 性格 ↔ 時期の重複

| 節 | 対 | 方針 |
|---|---|---|
| 性格§21（友人が変わる） | 時期§22（人間関係の総入れ替え） | 同一Fact。**時期側でのみ加点**し、性格側は出力を借りる |
| 性格§4（仕事没頭） | 時期§43（キャリアスコア解釈） | 性格＝傾向、時期＝その年の増幅。**掛け算にし加算しない** |
| 性格§48（理想化） | 時期§8 / 時期§49 `relationship_idealization` | **同一概念。時期側スコアに統一する** |

---

## 3. 二重計上を避ける方法

原文（時期§0・§37・§51）が定めた原則をコードへ落とす形。

```ts
export type FactLineage = 'western' | 'vedic' | 'bazi' | 'ziwei' | 'supplemental'

export interface RuleProvenance {
  /** 同一由来を束ねる鍵。これが同じFactは合議で1票に統合される */
  canonicalSourceId: string
  /** その canonicalSource から派生した占術の一覧。重複度の補助判定に使う */
  derivations: string[]
  lineage: FactLineage
  /** 表示用の占術名。lineage より細かい */
  system: string
  /** 世代要因のみか、個人固有か */
  independence: 'personal' | 'generational' | 'derived'
  confidence: number
}
```

### canonicalSourceId の付け方

| 占術 | canonicalSourceId | derivations |
|---|---|---|
| 四柱推命 日柱 | `bazi:day-pillar:甲子` | `['四柱推命','算命学','天中殺','納音']` |
| 算命学 宿命星 | `bazi:day-pillar:甲子` | 同上（**同じID**） |
| 天中殺 | `bazi:day-pillar:甲子` | 同上（**同じID**） |
| 納音 | `bazi:day-pillar:甲子` | 同上（**同じID**） |
| 西洋 金星 | `chart:venus:牡牛座:12.3` | `['西洋占星術']` |
| インド 金星 | `chart:venus:牡牛座:12.3` | `['インド占星術']`（**同じID**。時期§0） |
| 紫微斗数 命宮 | `ziwei:lunar-date+hour:...` | `['紫微斗数']` |
| 九星 本命星 | `kyusei:year:...` | `['九星気学']` |
| 宿曜 出生宿 | `sukuyo:date:...` | `['宿曜']` |

**西洋とインドを同じIDにする理由**：時期§0が「同じ天体を利用するため完全な独立票として扱わない」と定めているため。
ただし**判定内容が異なる場合（サイン方式の違い、ダシャーとトランジット）は別Factとして残し、合議時に減衰させる**。

### 合議の計算

```ts
function consensusScore(facts: ReportFactV2[]): { value: number; lineages: FactLineage[] } {
  // 1. canonicalSourceId ごとに最強のFactだけ残す（同一由来の重複排除）
  const bySource = new Map<string, ReportFactV2>()
  for (const fact of facts) {
    const prev = bySource.get(fact.canonicalSourceId)
    if (!prev || fact.strength > prev.strength) bySource.set(fact.canonicalSourceId, fact)
  }
  const merged = [...bySource.values()]

  // 2. 同一 lineage 内は加算せず最大値（時期§50 最終行）
  const byLineage = new Map<FactLineage, number>()
  for (const fact of merged) {
    const weight = LINEAGE_WEIGHT[fact.lineage] * fact.strength
    byLineage.set(fact.lineage, Math.max(byLineage.get(fact.lineage) ?? 0, weight))
  }

  // 3. 世代要因のみのFactは減衰（時期§45）
  const hasPersonal = merged.some(f => f.independence === 'personal')
  const generationalPenalty = hasPersonal ? 1.0 : 0.4

  // 4. 系統数ボーナス（時期§51）
  const lineages = [...byLineage.keys()]
  const astroOnly = lineages.length === 2 && lineages.includes('western') && lineages.includes('vedic')
  const bonusTable = [0, 0, 0.10, 0.20, 0.35]
  const bonus = (bonusTable[Math.min(lineages.length, 4)] ?? 0.35) * (astroOnly ? 0.5 : 1)

  const base = [...byLineage.values()].reduce((sum, v) => sum + v, 0)
  return { value: (base + bonus) * generationalPenalty, lineages }
}
```

**重要**：現行の `findingsV2.ts` の `consolidateVotes` はこの構造の一部を実装済みだが、
`LINEAGE_WEIGHT`（時期§50）と `generationalPenalty`（時期§45）が入っていない。

---

## 4. 文章ブロックの粒度

依頼にあった14分割を、`PERSONALITY_RULES.md` の節構造へ接続できる形にしたもの。
**節ごとの固定テンプレートではなく、role × 条件で選ばれる小さな単位**にする。

```ts
export type BlockRole =
  | 'title' | 'opening' | 'core' | 'cause' | 'scene' | 'inner'
  | 'strength' | 'weakness' | 'duality' | 'exception'
  | 'love' | 'work' | 'action' | 'closing'

export interface RuleBlock {
  id: string                    // 'core.pride_sensitivity.high.effort'
  role: BlockRole
  /** 出典。必ず節番号を書く。空文字を許さない */
  source: `性格§${number}` | `時期§${number}`
  when: {
    score?: Array<{ key: TraitScoreKey; min?: number; max?: number }>
    /** 複数スコアの関係。§46・§50の乖離判定に使う */
    relation?: Array<{ left: TraitScoreKey; op: '>' | '<'; right: TraitScoreKey }>
    lineage?: FactLineage[]
    chapter?: ChapterId[]
    requiresBirthTime?: boolean
  }
  /** 条件の具体度。高いほど優先。generic は 0 */
  specificity: number
  render: (ctx: BlockContext) => string
}
```

### 粒度の判断

| 単位 | 判断 | 理由 |
|---|---|---|
| `score × role` | **主軸** | 71 × 14 だが、実際に条件を書けるのは66スコア。まず高頻度の20スコア × 6 role から |
| `score関係 × role` | **必須** | §10・§46・§50 の乖離判定はこれでしか表現できない。**体感精度に最も効く** |
| `score × chapter` | 従 | 恋愛章・仕事章の `love` / `work` / `action` role のみ特化 |
| 節 × role | **避ける** | 111節 × 14 = 1554ブロック。書ける量ではなく、根拠も重複する |

### 領域分離の担保

恋愛章と仕事章の混入は、`when.chapter` による**構造的な排除**で防ぐ。
`love` role のブロックは `chapter: ['love-beginning','love-pattern']` を必ず持ち、
`work` role のブロックは `chapter: ['work-mode','work-fit']` を必ず持つ。
これにより §50（仕事と恋愛の優先順位）のように両方を扱う節でも、
出力先が分かれたまま同じスコアを参照できる。

### 重複排除

鑑定書全体で `usedBlockIds: Set<string>` を共有し、一度使ったブロックは再選択しない。
同じスコアが複数章で高くても、2章目は必ず別ブロックが選ばれる。

---

## 5. PR分割案

前提として、`PR0_apply.md` の PR-0a / 0b（生成経路の抽出とベースライン固定）が完了していること。

| PR | 内容 | 出典 | 出力変化 | 依存 |
|---|---|---|---|---|
| **R-1** | `rules/` に3ファイルを配置。`traitScoreRules.personality.ts` の `source` を `'性格§7'` 形式へ統一 | — | なし | PR-0b |
| **R-2** | `RuleProvenance` 型の追加。`canonicalSourceId` に §3 の付与規則を適用 | 時期§0 §37 §51 | なし（シャドー） | R-1 |
| **R-3** | `LINEAGE_WEIGHT` と `generationalPenalty` を `findingsV2.ts` へ追加 | 時期§45 §50 | なし（シャドー） | R-2 |
| **R-4** | 性格ルール投入 第1弾：§1 §2 §3 §7 §8 §14 §16 §24（既実装4スコア + 高頻度8スコア） | 性格§1-§29 | なし（シャドー） | R-3 |
| **R-5** | `traitScoreScale` の較正。1,000件の合成出生データから分布を出して自動生成 | — | なし | R-4 |
| **R-6** | 性格ルール投入 第2弾：§9 §10 §11 §12 §19 §26 §27 §30 §34 §35 §36 | 性格§9-§36 | なし（シャドー） | R-5 |
| **R-7** | §46（Attraction/Compatibility 解釈）の8分岐をブロックとして本文へ接続 | 性格§46 §10 §50 | **本質章** | R-6 |
| **R-8** | §56（言い換え規則）を禁止語バリデータとして実装 | 性格§56 / 時期§48 | なし（検査のみ） | R-7 |
| **T-1** | 時期§33 の月支・年支・時支の冲を `calcTimingCycles` へ追加 | 時期§33 | **時期カード** | PR-0c |
| **T-2** | `TimingScoreKey` 18件の型と算出を追加 | 時期§49 | なし（シャドー） | T-1 |
| **T-3** | 時期§39 の外惑星→天体トランジットを `annualAstrology` へ追加（時刻不要） | 時期§39 | シャドー | T-2 |
| **T-4** | 時期§42〜§44 の分岐表で `titleFor()` を置換 | 時期§42 §43 §44 | **時期カード** | T-3 |
| **T-5** | 時期§21 + §44 で `move` フラグを有効化 | 時期§21 §44 | **時期カード** | T-4 |
| **T-6** | 時期§32 の流年四化を `ziwei.ts` へ追加 | 時期§32 | シャドー→時期 | T-4 |
| **T-7** | 時期§38 の4軸トランジット（時刻必須） | 時期§38 | 時期カード | T-6 |
| **T-8** | 時期§40 のアンタルダシャー | 時期§40 | 時期カード | T-7 |
| **T-9** | 時期§52 のパターンA〜Eをタイトル生成の最上位分岐へ | 時期§52 | 時期カード | T-8 |

**R系列とT系列は独立に進められる。** R系列は自己鑑定の本質章、T系列は時期カードにしか触らない。

### ローンチ前に必要な最小範囲

R-1 / R-2 / R-3 / T-1 / T-4 / T-5。
これで「引越しが一度も出ない」「別離タイトルが根拠なく出る」「月支の冲を見ていない」が解消する。

R-4 以降（Score層の本文接続）はローンチ後に回せる。

---

## 6. 根拠不足の一覧と対応

### スコアはあるがルールがない（判断1で1件に減少）

| スコア | 対応方針 |
|---|---|
| `attraction_physical` | 原文に一度も出てこない。**保留キーとして残し、`confidence: 0` を返す。ブロック条件に使わない**。将来、性格§5（5室・火星・金星）から条件を定義する余地はあるが、現状は推測になるため実装しない |

以下4件は判断1で根拠を確定した（前回の「根拠不足」判定を訂正）。

| スコア | 確定した根拠 |
|---|---|
| `reliability_preference` | 性格§10 §13 |
| `responsibility_binding` | 性格§13 + 時期§4 |
| `compatibility_independence` | 性格§2 §52 |
| `compatibility_value_match` | 性格§12 §20 |

### ルールはあるがスコアがない（性格側6件）

| 概念 | 出典 | 対応方針 |
|---|---|---|
| Idealization | §8 §47 §48 | 判断2で確定。**キーを増やさず、`natalIdealizationBase` を時期スコア算出の内部中間値として持つ** |
| Spiritual Curiosity | §54 | 占術条件は揃っている。キーを追加するか出力対象から外すかの判断が必要 |
| Boundary Awareness | §28 | 占術条件なし。**実装しない** |
| Leadership Care | §23 | 占術条件なし。`group_coordination` で代替 |
| Friendship Loyalty | §22 | 占術条件なし。`effort_respect` で代替 |
| Individual Freedom | §43 | 占術条件なし。`social_conformity` の逆値で代替 |

### 時期側の根拠不足（8件）

`EVENT_RULES.md` 末尾の一覧を参照。特に次の2つは判定に直結する。

- **`emotional_stress` の判定条件が本文に存在しない**。§49 に名前だけある。
- **「合と冲が近接」の判定窓（§5 §28）が未定義**。何か月以内を近接とするか決める必要がある。

---

## 7. 必要なテスト

### 契約テスト

```ts
// ruleContract.test.ts
test('すべてのルールが実在する節を source に持つ', () => {
  // source が '性格§N'（1≤N≤58）または '時期§N'（1≤N≤53）の形式であること
  // 対応する見出しが rules/*.md に存在すること
})

test('出生時刻を要求するルールは requiresBirthTime のFactしか参照しない', () => {
  // ハウス・ASC・MC・紫微斗数・時柱を使うルールが、時刻なし入力で発火しないこと（時期§46）
})

test('同一 canonicalSourceId のFactは合議で1票に統合される', () => {
  // 四柱・算命学・天中殺・納音から同じ結論が出ても lineageCount が1であること（時期§37 §51）
})

test('西洋とインドのみの一致は2系統一致より弱い', () => {
  // 時期§51 の5行目
})

test('本文に占術用語が出ない', () => {
  // 天中殺・日柱・化忌・ナクシャトラ等の禁止語リスト
})

test('言い換え規則を守っている', () => {
  // 性格§56 の9件、時期§48 の7件。「別れます」「浮気」「凶」等の禁止語
})

test('恋愛章に仕事語彙が出ない / 仕事章に恋愛語彙が出ない', () => {
  // when.chapter による構造的排除が効いていること
})
```

### 分布テスト

```ts
// ruleDistribution.test.ts（1,000件の合成出生データ）
test('各スコアの p10 と p90 の差が 0.25 以上ある', () => {
  // 分布が潰れていない＝スコアが実質的な定数になっていない
})

test('各スコアが最低3ルール・2系統以上から加点される', () => {
  // 単一占術依存のスコアを検出する
})

test('各ブロックの発火率が 5%〜60% に収まる', () => {
  // 全員に出るブロック（＝個人差を作らない）と、誰にも出ないブロックを検出
})

test('外惑星のみのFactは世代減衰が効いている', () => {
  // 同年生まれ100件で、外惑星由来のFindingが全員一致していないこと（時期§45）
})

test('時期カードのタイトルが1人あたり15種類以上になる', () => {
  // 現行は最大15タイトル・1人あたり20〜25骨格。T-4 後の目標値
})
```

### 回帰テスト

```ts
// 既存の selfReportSnapshot.test.ts を拡張
test('ゴールデンスナップショット40件と完全一致する', () => {})

test('同一入力は常に同一結果を返す', () => {})

test('ルール追加後も補完ブロック率が増えない', () => {})

test('ペア間のページ本文Jaccard中央値がベースライン以下', () => {
  // ルールを増やして個人差が減っていないことの確認
})

test('同日生まれ・時刻違い6件が互いに異なる', () => {
  // 時刻依存の要素が実際に効いていること
})
```

---

## 8. 確定した判断（2026-08-24）

### 判断1：`traitScores.ts` の71キーは変更しない

較正スケールの作り直しコストに対して、変更の利得が小さい。
前回「根拠不足」とした5件のうち4件は、既存の節から正当に根拠を引ける（前回の判定を訂正する）。

| スコア | 訂正後の根拠 | 扱い |
|---|---|---|
| `reliability_preference` | 性格§10「月・土星・4室・7室が安定性を求める」＋§13 | **根拠あり** |
| `responsibility_binding` | 性格§13 ＋ 時期§4「土星がDESC・7室支配星へ関与→責任・契約・義務が生じる」 | **根拠あり** |
| `compatibility_independence` | 性格§2 ＋ §52 の二人差分 | **根拠あり** |
| `compatibility_value_match` | 性格§20 ＋ §12 | **根拠あり** |
| `attraction_physical` | なし | **保留キー**。`confidence: 0` を返し、ブロックを一切持たせない |

結果：**対応 70/71、キー変更ゼロ、較正やり直しゼロ。**

```ts
/** 根拠となるルールが存在しないため、値を返さないキー。ブロック条件に使ってはならない */
export const UNGROUNDED_TRAIT_SCORE_KEYS: readonly TraitScoreKey[] = ['attraction_physical']
```

`computeTraitScores` は `UNGROUNDED_TRAIT_SCORE_KEYS` に含まれるキーについて
`{ value: 0.5, raw: 0, confidence: 0, contributingFacts: [], lineages: [] }` を返す。
`confidence: 0` のスコアはブロック選択の条件として使えない、という契約テストを置くこと。

### 判断2：Idealization はキーを増やさず、時期スコアの内部入力にする

性格§48 は出生図由来の恒常的傾向（trait）、時期§8 は年ごとの変動（state）であり、
これは性格§50 の「時期運が Absorption 傾向を増幅する」と同じ構造である。
片方へ寄せると情報が落ち、両方をキーにすると二重計上になる。

```ts
// natalIdealizationBase は TraitScoreKey ではなく、TimingScore 算出内部の中間値として持つ
function natalIdealizationBase(facts: ReportFactV2[]): number {
  // 性格§48：海王星・木星 → 7室・金星
  // 出力は 0〜1。TraitScoreSet には含めない
}

function relationshipIdealization(year: number, facts: ReportFactV2[]): number {
  return clamp01(natalIdealizationBase(facts) * transitFactor(year))  // 時期§8
}
```

**キーは増えず、二重計上も起きない。**
性格§48 は「その年の理想化しやすさの出生図側の入力を定義する節」として扱う。

### 判断3：`COMPATIBILITY_RULES.md` を作成する

作成済み。§0〜§58 の全項目を復元し、実装メタを付与した。

相性は**全58項目が未実装**であり、シナストリー計算そのものがリポジトリに存在しない。
時刻不要で実装できる項目（§15 宿曜の宿関係、§44 会話、§7 修復力、§43 の一部、§34 Fun/Safety）
から着手すれば、現行の「実質3パターン」から多軸プロファイルまで到達できる。
詳細は `COMPATIBILITY_RULES.md` 末尾の優先実装候補を参照。

### 判断4：天中殺の増幅率は 15%

```ts
export const TENCHUSATSU_AMPLIFIER = 1.15
```

**加点ではなく乗算**であること。加点にすると天中殺が独立票として振る舞い、時期§34・§37・§51 に違反する。
`EVENT_RULES.md` §34 に反映済み。

---

## 9. まだ残っている判断（相性の実装前に決めること）

1. **`RELATION_SCORE_KEYS` に `resentment_accumulation` を追加するか。**
   相性§42 の破局式 `conflict_intensity × (1-repair) × (1-safety) × resentment` に必須だが、
   相性§1 の39スコアに含まれていない。**追加して40件にすることを推奨。**

2. **関係タイプの体系を統合するか。**
   相性§35（5類型）・§36（8タイプ）・§47〜§51（追加4タイプ）が併存している。
   **§36 の8タイプ + Deep & Fiery / Shared Mission / Equal Rivals / Quiet Distance = 12タイプへの統合を推奨。**

3. **相性のカード構成を20カード（軸別）と現行8章（関係ラベル別）のどちらにするか。**
   **20カードを基本とし、関係ラベル（片思い・交際中・婚約・復縁・友人・家族）は
   表示順と文面のトーンだけを変える方式を推奨。**
   関係ラベルごとに20カードを書き分けると 6 × 20 = 120章分の文章資産が必要になり破綻する。

4. **環境データの入力UIを作るか。**
   相性§12 §18 §25 §31 §32 が、同棲の有無・交際期間・職場重複・関係開始時の状況を要求している。
   これらは占術Factでは代替できない。**ローンチ前は環境データなしで成立する項目だけを実装し、
   環境依存の項目（Equal Rivals型など）は「判定不能」として付与しない方式を推奨。**

5. **相性§55（実体験データによる学習）を実装するか。**
   **決定論化の初期段階では実装しないことを推奨。** ウェイトの自動調整は同一入力の再現性を壊す。
