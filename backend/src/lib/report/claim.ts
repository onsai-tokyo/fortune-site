/**
 * Claim ＝ 生活言語の命題。Finding と本文のあいだに置く中間層。
 *
 * 【なぜ必要か】
 * 現在は Finding → 文章資産（editorial.ts の signalLanguage）が直結しているため、
 * 「専門用語を消す」と「根拠を失う」が同時に起きる。
 * Claim 層は用語を消す場所ではなく、用語の置き場所を変える場所である。
 *
 * 【用語の3層配置】
 *   本文   Claim.subject / proposition / behavior … 生活語のみ（JARGON_TERMS を1語も含めない）
 *   根拠   Claim.evidence[].detail                … 専門用語のまま残す
 *   用語集 Claim.termGloss                        … 用語 + 平易な説明
 *
 * 【章はここで決まる】
 * 現在 specializedLanguage() は finding.key しか見ず、どの章に置かれるかを知らない。
 * その結果、life-mission（人生の軸）に紫微斗数の化忌 Finding が入って
 * 「大切な領域に入ると、反応の振れ幅が大きくなる」が価値観の章タイトルになる（実測 34/40）。
 * Claim が chapter を持つことでこれを解消する。
 */

import type { FactLineage } from './facts.js'
import type { ChapterId } from './chapterPlannerV2.js'
import type { TermGloss } from './jargon.js'
import type { TraitScoreKey } from './traitScores.js'

export type ClaimScoreKey = TraitScoreKey | 'private_affection'

/**
 * 命題の型。
 * ★ これが「章ごとに読み味を変える」の実体。
 *   同じ軸の所見でも shape が違えば、まったく違う文になる。
 */
export type ClaimShape =
  /** AだがB。gap 由来。最も個別性が出る */
  | 'contrast'
  /** Xのとき、Yになる */
  | 'condition'
  /** Xが一定を超えると、Yへ切り替わる */
  | 'threshold'
  /** まずX、次にY */
  | 'sequence'
  /** ふつうはX、ただしZではXにならない */
  | 'exception'
  /** Xを選ぶと、Zを手放すことになる */
  | 'cost'
  /** Xは、Yを守るために身につけた */
  | 'origin'
  /** 崩れたとき、Zで戻れる */
  | 'repair'

export type ClaimConfidence =
  /** 複数占術が一致（consensus） */
  | 'observed'
  /** 単一占術の突出（signature） */
  | 'likely'
  /** 出生時刻がない等で根拠が弱い。断定形の構文を使わせない */
  | 'conditional'

export interface EvidenceRef {
  family: FactLineage
  /** '四柱推命' など */
  system: string
  /** '日干と月干の干合' — ★専門用語はここに残す */
  detail: string
  factIds: string[]
}

export interface Claim {
  id: string
  /** ★ 章は Claim が持つ */
  chapter: ChapterId
  shape: ClaimShape

  // ── 以下はすべて生活語。containsJargon() が false であること ──
  /** 「反対意見が出た場面」。文の起点になる名詞句 */
  subject: string
  /** 「その場では表情を変えない」。主張の本体 */
  proposition: string
  /** contrast / exception の反対側。「親しい相手の一言では返事が一日遅れる」 */
  counterpart?: string
  /** 「相手が近い関係のとき」。condition / threshold で使う */
  condition?: string
  /** 観測可能な行動。action ページの素材 */
  behavior: string
  /** 何を手放すか。cost で使う */
  cost?: string
  /** 章タイトル用。ClaimAsset.typeLabel をそのまま引き継ぐ */
  typeLabel: string

  /** 根拠。表示は任意だが追跡は必須。空配列を許さない */
  evidence: EvidenceRef[]
  /** 用語はここへ退避。本文には出さない */
  termGloss: TermGloss[]

  confidence: ClaimConfidence
  /** 出生時刻に依存するか。無い場合 conditional へ降格する */
  requiresBirthTime: boolean
  /** 0..1。章内の並び順に使う */
  salience: number
}

/**
 * 資産テーブルの1レコード。
 * Claim はこれと Finding / Fact から組み立てる。
 *
 * ★ 粒度に注意。
 * 現在の editorial.ts は「軸1つ = 1レコード（trait/statement/title の3フィールド）」で
 * 全31件しかない。これを「Claim 1つ = 1レコード（6フィールド）」へ細分化し、
 * 150〜200件まで増やす。この件数が最終的な文章の多様性の上限になる。
 */
export interface ClaimAsset {
  id: string
  chapter: ChapterId
  /** どの Finding からこの Claim を作るか */
  trigger: ClaimTrigger
  /** 関連する決定論スコア。根拠と確信度の補助に使う。 */
  scoreKey: ClaimScoreKey
  shape: ClaimShape
  /**
   * ★章タイトルにそのまま出る短い名詞句。「〜するタイプ」「〜な人」で終える。
   * 雛形で合成しない。1件ずつ人が書く。ここが章タイトルの多様性そのものになる。
   */
  typeLabel: string
  subject: string
  proposition: string
  counterpart?: string
  condition?: string
  behavior: string
  cost?: string
  /** ChapterScore.lexicalBand との照合に使う。本文へ含まれる具体名詞 */
  lexicalTags: readonly string[]
  /** 章内の並び順の初期値。Finding の confidence で調整される */
  salienceBase: number
}

export type ClaimTrigger =
  /** facts.ts の signal に一致（independence / harmony など18種） */
  | { kind: 'signal'; signal: string }
  /** 軸のみ一致。signal 一致の資産が無いときのフォールバック */
  | { kind: 'axis'; axis: string }
  /** gapFindings.ts の GapSpec.key に一致。'gap:public-private' など */
  | { kind: 'gap'; gapKey: string }
  /** 欠けている五行。'missing-金' など */
  | { kind: 'missing'; element: string }
  /** 紫微斗数の化星。'mutagen-祿' など */
  | { kind: 'mutagen'; star: string }
  /** Trait Scoreを直接根拠にする資産。 */
  | { kind: 'score'; scoreKey: ClaimScoreKey }

export function triggerKey(trigger: ClaimTrigger): string {
  switch (trigger.kind) {
    case 'signal': return `signal:${trigger.signal}`
    case 'axis': return `axis:${trigger.axis}`
    case 'gap': return trigger.gapKey
    case 'missing': return `missing:${trigger.element}`
    case 'mutagen': return `mutagen:${trigger.star}`
    case 'score': return `score:${trigger.scoreKey}`
  }
}
