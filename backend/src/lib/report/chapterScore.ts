/**
 * 章ごとの構成譜。
 *
 * 【解決する問題】
 * editorial.ts の pagesFor() は role・label・語順が完全にハードコードされた
 * 15要素の固定配列1本で、8章すべてがこれを使っている。
 * 実測: 40サンプル×8章=320章で、ページラベル列の種類は3つだけ
 *      （self / love / work の分岐のみ）。
 *      「選択肢がいくつも並ぶとき…」が320回、「という問いです」が320回出現。
 *
 * 【設計方針】
 * ページ数は減らさない。減らすと「浅くなる」が再発する。
 * 代わりに「ページの役割の順序」を章ごとに変える。
 * 8章に8つの異なる movement を与えることで、同じ Claim でも読み味が変わる。
 *
 * 【Validator が強制する制約】
 *   - movement の長さは全章 12〜16
 *   - 8章の movement を文字列化したとき、8つとも異なること（現在は3種類）
 *   - opener は8章で重複しないこと
 *   - closer は8章で重複しないこと
 *   - 各章の本文に lexicalBand の語が2種類以上含まれること
 *     → 抽象語（性質・基準・軸・輪郭）だけの章が作れなくなる
 */

import type { ChapterId } from './chapterPlannerV2.js'
import type { SentenceForm } from './sentenceForm.js'

export type PageBeat =
  /** 具体的な場面から入る */
  | 'scene'
  /** 命題を置く */
  | 'claim'
  /** @deprecated データから生成できないため movements では使わない */
  | 'origin'
  /** 根拠。占術名だけ出し、用語は出さない */
  | 'evidence'
  /** 反対側 */
  | 'contrast'
  /** 一定を超えたときの切り替わり */
  | 'threshold'
  /** 順序 */
  | 'sequence'
  /** 例外 */
  | 'exception'
  /** 代償 */
  | 'cost'
  /** 他人からどう見えるか */
  | 'others'
  /** 読者への問い */
  | 'question'
  /** 行動 */
  | 'action'
  /** 崩れたときの戻り方 */
  | 'repair'
  /** 余韻 */
  | 'closing'

/**
 * ★ブロック構造。
 * 1ブロック = 1つの Claim を3ページかけて展開する。
 *   core      … その Claim の中心を述べる（subject + proposition）
 *   dependent … その Claim の別の面（counterpart / condition / cost のいずれか1つ）
 *   behavior  … その Claim の behavior
 *
 * これをやらないと、2ページ目の「そうなるのは…」が別の Claim を指してしまい、
 * 指示語の受け先が無くなる。章が一本の話として読めなくなる。
 *
 * ★1ブロックが要求してよい任意フィールドは1つまで。
 *   実測で counterpart と condition を両方持つ Claim は全8章でゼロ件だった。
 */
export interface ChapterBlock {
  /** subject + proposition を述べるページ。'scene' か 'claim' */
  core: PageBeat
  /** 任意フィールドを1つ使うページ */
  dependent: PageBeat
  /** behavior を使うページ。全 Claim が behavior を持つので必ず埋まる */
  behavior: PageBeat
}

export interface ChapterScore {
  chapter: ChapterId
  /** 4ブロック × 3ページ = 12ページ。章ごとに構成が異なる */
  blocks: readonly ChapterBlock[]
  /** 冒頭ページの構文。8章で全部異なる */
  opener: SentenceForm
  /** 末尾ページの構文。8章で全部異なる */
  closer: SentenceForm
  /** 本文に最低2種類含めるべき具体名詞 */
  lexicalBand: readonly string[]
  /** 領域混入防止。既存の正規表現を型へ移した */
  forbidden: RegExp | null
  /** 画面上の章タイトル（既存の CHAPTER_CONTRACT と揃えること） */
  heading: string
}

export const CHAPTER_SCORES: Record<ChapterId, ChapterScore> = {
  // ── 人生の軸 ─────────────────────────────────────
  // 場面から入り、対比と代償を早めに置く。抽象論に逃げさせない。
  'life-mission': {
    chapter: 'life-mission',
    blocks: [
      { core: 'scene', dependent: 'contrast', behavior: 'repair' },
      { core: 'claim', dependent: 'cost', behavior: 'action' },
      { core: 'claim', dependent: 'threshold', behavior: 'sequence' },
      { core: 'claim', dependent: 'exception', behavior: 'closing' },
    ],
    opener: 'scene-first',
    closer: 'temporal',
    lexicalBand: ['選ぶ', '決める', '断る', '引き受ける', '時間', 'お金', '順番'],
    forbidden: null,
    heading: '人生の軸',
  },

  // ── 考え方のくせ ──────────────────────────────────
  // 問いから入る唯一の章。読者に立ち止まらせてから命題を置く。
  'core-mind-1': {
    chapter: 'core-mind-1',
    blocks: [
      { core: 'claim', dependent: 'question', behavior: 'sequence' },
      { core: 'scene', dependent: 'evidence', behavior: 'action' },
      { core: 'claim', dependent: 'contrast', behavior: 'repair' },
      { core: 'claim', dependent: 'exception', behavior: 'closing' },
    ],
    opener: 'question',
    closer: 'imperative',
    lexicalBand: ['返事', 'メモ', '締切', '手順', '確認', '翌朝', '言い直す'],
    forbidden: null,
    heading: '考え方のくせ',
  },

  // ── 人との距離 ───────────────────────────────────
  // 対比から入る。この章は Claim の shape が contrast に偏るので、
  // 冒頭でその形を提示してから条件と例外へ降りる。
  'core-mind-2': {
    chapter: 'core-mind-2',
    blocks: [
      { core: 'scene', dependent: 'contrast', behavior: 'action' },
      { core: 'claim', dependent: 'exception', behavior: 'sequence' },
      { core: 'claim', dependent: 'threshold', behavior: 'repair' },
      { core: 'claim', dependent: 'cost', behavior: 'closing' },
    ],
    opener: 'contrast',
    closer: 'scene-first',
    lexicalBand: ['連絡', '約束', '距離', '紹介', '誘い', '断り方', '既読'],
    forbidden: null,
    heading: '人との距離',
  },

  // ── 消耗と回復 ───────────────────────────────────
  // 閾値から入る。「限界がどこか」を先に見せる章。
  'core-mind-3': {
    chapter: 'core-mind-3',
    blocks: [
      { core: 'claim', dependent: 'threshold', behavior: 'repair' },
      { core: 'scene', dependent: 'others', behavior: 'action' },
      { core: 'claim', dependent: 'cost', behavior: 'sequence' },
      { core: 'claim', dependent: 'contrast', behavior: 'closing' },
    ],
    opener: 'temporal',
    closer: 'negation-first',
    lexicalBand: ['疲れ', '言い方', '後悔', '引き返す', '眠り', '食事', '休む'],
    forbidden: null,
    heading: '消耗と回復',
  },

  // ── 恋のはじまり ──────────────────────────────────
  // 順序から入る。「何が先に起きるか」で恋愛の入口を描く。
  'love-beginning': {
    chapter: 'love-beginning',
    blocks: [
      { core: 'scene', dependent: 'evidence', behavior: 'action' },
      { core: 'claim', dependent: 'contrast', behavior: 'sequence' },
      { core: 'claim', dependent: 'cost', behavior: 'repair' },
      { core: 'claim', dependent: 'exception', behavior: 'closing' },
    ],
    opener: 'enumerate',
    closer: 'question',
    lexicalBand: ['連絡先', '二回目', '間隔', '返信', '会う', '名前', '予定'],
    forbidden: /仕事|職場|キャリア|上司|転職|昇進|同僚|business|会社|業務|役職|勤務|案件|取引先/,
    heading: '恋のはじまり',
  },

  // ── 関係の続き方 ──────────────────────────────────
  // 代償から入る唯一の章。続けるために何を払っているかを最初に置く。
  'love-pattern': {
    chapter: 'love-pattern',
    blocks: [
      { core: 'claim', dependent: 'cost', behavior: 'repair' },
      { core: 'scene', dependent: 'exception', behavior: 'action' },
      { core: 'claim', dependent: 'threshold', behavior: 'sequence' },
      { core: 'claim', dependent: 'others', behavior: 'closing' },
    ],
    opener: 'negation-first',
    closer: 'contrast',
    lexicalBand: ['喧嘩', '謝る', '沈黙', '同じ話', '週末', '生活', '約束'],
    forbidden: /仕事|職場|キャリア|上司|転職|昇進|同僚|business|会社|業務|役職|勤務|案件|取引先/,
    heading: '関係の続き方',
  },

  // ── 働き方 ──────────────────────────────────────
  // 他者視点から入る。仕事は「見られ方」から書くと具体になる。
  'work-mode': {
    chapter: 'work-mode',
    blocks: [
      { core: 'scene', dependent: 'others', behavior: 'sequence' },
      { core: 'claim', dependent: 'contrast', behavior: 'action' },
      { core: 'claim', dependent: 'evidence', behavior: 'repair' },
      { core: 'claim', dependent: 'cost', behavior: 'closing' },
    ],
    opener: 'third-person',
    closer: 'enumerate',
    lexicalBand: ['締切', '会議', '任される', '巻き取る', '報告', '段取り', '数字'],
    forbidden: /恋愛|恋人|結婚|パートナー|交際|デート|告白/,
    heading: '働き方',
  },

  // ── 合う環境 ─────────────────────────────────────
  // 例外から入る。「どこでは力が出ないか」を先に置くと環境の話が具体になる。
  'work-fit': {
    chapter: 'work-fit',
    blocks: [
      { core: 'claim', dependent: 'exception', behavior: 'action' },
      { core: 'scene', dependent: 'threshold', behavior: 'sequence' },
      { core: 'claim', dependent: 'contrast', behavior: 'repair' },
      { core: 'claim', dependent: 'cost', behavior: 'closing' },
    ],
    opener: 'conditional',
    closer: 'scene-first',
    lexicalBand: ['席', '裁量', '手順', '人数', '通知', '在宅', '評価'],
    forbidden: /恋愛|恋人|結婚|パートナー|交際|デート|告白/,
    heading: '合う環境',
  },
}

// ── 自己検証 ────────────────────────────────────────
// Codex はこの3関数を PR-4 のテストからそのまま呼ぶこと。

/** 8章の構成がすべて異なるか（ベースラインは3種類しかなかった） */
export function movementVariety(): number {
  const keys = Object.values(CHAPTER_SCORES).map(score =>
    score.blocks.map(b => `${b.core}/${b.dependent}/${b.behavior}`).join('>'))
  return new Set(keys).size
}

/** opener / closer が8章で重複していないか */
export function openerCloserAreUnique(): boolean {
  const scores = Object.values(CHAPTER_SCORES)
  const openers = new Set(scores.map(score => score.opener))
  const closers = new Set(scores.map(score => score.closer))
  return openers.size === scores.length && closers.size === scores.length
}

/** 全章 4ブロック = 12ページか */
export function movementLengthsAreValid(): boolean {
  return Object.values(CHAPTER_SCORES).every(score => score.blocks.length === 4)
}

/**
 * その章の Claim 群が、ブロックの要求を満たせるか。
 * ★claimBuilder はこれが true になるように Claim を選ぶこと。
 */
export const REQUIRED_FIELD_BY_BEAT: Partial<Record<PageBeat, 'counterpart' | 'condition' | 'cost'>> = {
  contrast: 'counterpart', exception: 'counterpart', others: 'counterpart',
  threshold: 'condition', evidence: 'condition',
  cost: 'cost', question: 'cost',
}

/**
 * claimBuilder への要求。
 * 12ページを埋めるには、1章あたり Claim が10件必要で、その中に
 *   counterpart を持つもの 2件以上
 *   condition   を持つもの 1件以上
 *   cost        を持つもの 1件以上
 * が含まれていること。実測での不足はページ数の減少として現れる。
 */
export const CLAIMS_REQUIRED_PER_CHAPTER = 10
export const FIELD_COVERAGE_REQUIRED = { counterpart: 2, condition: 1, cost: 1 } as const
