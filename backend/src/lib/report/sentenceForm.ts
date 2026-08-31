/**
 * 構文カタログと決定論的な選択。
 *
 * 【解決する問題】
 * 実測 320/320（100%）の summary が「あなたは、」で始まっている。
 * editorial.ts の summaryFor() が `あなたは、${statement}。${scene}` の固定連結だったため。
 *
 * 【設計】
 * 9種の構文を12〜16ページへラテン方陣で回す。これにより:
 *   - 1章内で同じ構文が3回以上出ない（9種 > 16/3）
 *   - 章オフセットを3ずつずらすので、同じ beat が章ごとに違う構文になる
 *   - seed は生年月日ハッシュのみ。同一入力なら同一結果（再現性を維持）
 *
 * 【重要】
 * 「あなたは」で始められるのは1章につき最大1ページ。Validator が強制する。
 * 主語を消すのではなく、主語の位置と種類を変える。
 *   - scene-first  → 主語が「場面」
 *   - third-person → 主語が「周囲」
 *   - contrast     → 主語が2つ並ぶ
 *   - question     → 主語が問いに埋まる
 */

import { createHash } from 'crypto'
import type { Claim } from './claim.js'
import type { ChapterId } from './chapterPlannerV2.js'
import type { PageBeat } from './chapterScore.js'

export type SentenceForm =
  /** 場面から入る。「打ち合わせで反対意見が出ても、…」 */
  | 'scene-first'
  /** 対比。「外では…。一方で、親しい相手には…」 */
  | 'contrast'
  /** 条件。「…がそろったときだけ、…」 */
  | 'conditional'
  /** 否定から入る。「…だからではありません。…」 */
  | 'negation-first'
  /** 問い。「なぜ…のでしょうか。」 */
  | 'question'
  /** 時間差。「以前は…。いまは…」 */
  | 'temporal'
  /** 三人称視点。「周囲からは…と見えています」 */
  | 'third-person'
  /** 命令。「…を先に決めてください」 */
  | 'imperative'
  /** 列挙。「三つあります。ひとつは…」 */
  | 'enumerate'

export const ALL_FORMS: readonly SentenceForm[] = [
  'scene-first', 'contrast', 'conditional', 'negation-first', 'question',
  'temporal', 'third-person', 'imperative', 'enumerate',
] as const

export const YOU_SUBJECT_LIMIT_PER_CHAPTER = 1

/** 章の並び順。ラテン方陣のオフセットに使う */
export const CHAPTER_ORDER: readonly ChapterId[] = [
  'life-mission', 'core-mind-1', 'core-mind-2', 'core-mind-3',
  'love-beginning', 'love-pattern', 'work-mode', 'work-fit',
] as const

/**
 * beat と構文の相性を先に固定する。
 * ここで固定しない beat だけをラテン方陣で回す。
 */
const PREFERRED_FORM: Partial<Record<PageBeat, SentenceForm>> = {
  question: 'question',
  action: 'imperative',
  contrast: 'contrast',
  others: 'third-person',
  scene: 'scene-first',
}

function seedInt(seed: string): number {
  return createHash('sha256').update(seed).digest().readUInt32BE(0)
}

export function formFor(
  chapter: ChapterId,
  beat: PageBeat,
  pageIndex: number,
  seed: string,
): SentenceForm {
  const preferred = PREFERRED_FORM[beat]
  if (preferred) return preferred
  const chapterOffset = CHAPTER_ORDER.indexOf(chapter)
  const offset = seedInt(seed) % ALL_FORMS.length
  return ALL_FORMS[(pageIndex + chapterOffset * 3 + offset) % ALL_FORMS.length]
}

// ────────────────────────────────────────────────────────────
// 実現器（realizer）
//
// Claim のフィールドを、構文ごとに違う語順・違う接続で文へ変える。
// ★ ここが「代わり映えしない」を直す実体。
//   同じ Claim でも form が違えば、語順・主語・接続がすべて変わる。
// ────────────────────────────────────────────────────────────

export interface RealizeInput {
  claim: Claim
  form: SentenceForm
  /** その章で「あなたは」を既に使ったか */
  youSubjectUsed: boolean
}

/** 文末を整える。体言止めと「〜性質です」の連発を避ける */
/**
 * beat（ページの役割）ごとに、Claim のどのフィールドを表に出すかを決める。
 * ★ここを分離しないと、同じ Claim が別のページで同じ文になる。
 *   開発中に3回この分離を崩して、そのたび重複が復活した。
 */
export const BEAT_SLOT: Record<PageBeat, ClaimSlot> = {
  origin: 'origin',
  scene: 'core', claim: 'core', evidence: 'condition',
  contrast: 'counterpart', threshold: 'condition', sequence: 'behavior',
  exception: 'counterpart', cost: 'cost', others: 'counterpart',
  question: 'cost', action: 'behavior', repair: 'behavior', closing: 'behavior',
}

export type ClaimSlot = 'core' | 'counterpart' | 'condition' | 'cost' | 'behavior' | 'origin' | 'closing'

/** その beat を埋めるために Claim が持っていなければならないフィールド */
export const BEAT_REQUIRES: Partial<Record<PageBeat, keyof Claim>> = {
  sequence: 'behavior', action: 'behavior', repair: 'behavior',
  contrast: 'counterpart', exception: 'counterpart', others: 'counterpart',
  cost: 'cost', question: 'cost',
  evidence: 'condition', threshold: 'condition',
}

/** slot ごとに使ってはいけない構文。声色が他の slot とぶつかるため */
export const SLOT_FORBIDDEN_FORMS: Partial<Record<ClaimSlot, ReadonlySet<SentenceForm>>> = {
  core: new Set<SentenceForm>(['third-person']),
}

function close(body: string): string {
  return body.endsWith('。') ? body : `${body}。`
}

export function realize(claim: Claim, form: SentenceForm, beat: PageBeat): string {
  const { subject: s, proposition: p, counterpart: cp, condition: cond, behavior: b, cost } = claim
  const slot = BEAT_SLOT[beat]

  if (slot === 'cost' && cost) {
    if (beat === 'question') {
      return close(`では、何と引き換えにそうしているのでしょうか。${cost}です`)
    }
    return close(`ここには引き換えもあります。${cost}。損得の話ではなく、順番の話です`)
  }

  if (slot === 'behavior') {
    if (beat === 'action')  return close(`試せることがあります。${b}ことから始めてみてください`)
    if (beat === 'repair')  return close(`崩れたと感じたときは、${b}ところから戻すのが早い順番です`)
    if (beat === 'closing') return close(`この章の話が自分に当てはまるかどうかは、${b}ところから確かめられます`)
    return close(`手をつける順番があります。${b}。そのあとの判断が軽くなります`)
  }

  if (slot === 'counterpart' && cp) {
    if (beat === 'exception') return close(`ただし、例外があります。${cp}`)
    // ★counterpart は「隠れている側」。周囲に見えている側ではない。ここを逆にすると意味が反転する
    if (beat === 'others')    return close(`周りから見えているのは、ここまでです。実際には、${cp}`)
    return close(`一方で、${cp}。どちらが本当かではなく、場面によって出方が違うだけです`)
  }

  if (slot === 'condition' && cond) {
    if (beat === 'evidence') {
      return close(`当てはまるのは、${cond}です。それ以外の場面では、そこまで表に出ません`)
    }
    // condition には「性質が出る条件」と「良い結果が出る条件」の両方がある。
    // 「〜に限られます」は両方に成り立つ。「はっきり出ます」は前者にしか成り立たない
    return close(`そうなるのは、${cond}に限られます。いつも同じように出るわけではありません`)
  }

  // ── core slot。subject と proposition だけを使う ──
  switch (form) {
    case 'scene-first':    return close(`${s}、${p}`)
    case 'contrast':       return close(`${s}、${p}。同じ人でも、場面によって出方は変わります`)
    case 'conditional':    return close(`${s}、${p}。いつもではなく、この場面で特にそうなります`)
    case 'negation-first': return close(`気分で決めているわけではありません。${s}、${p}`)
    case 'question':       return close(`${s}、${p}。意識してそうしているわけではありません`)
    case 'temporal':       return close(`${s}、${p}。ずっと同じというより、繰り返すうちにこの形になっています`)
    case 'imperative':     return close(`思い当たる場面があるはずです。${s}、${p}`)
    case 'enumerate':      return close(`起きていることは単純です。${s}、${p}`)
    default:               return close(`${s}、${p}`)
  }
}

/** summary 用。タイトル直下の1〜2文。★「あなたは、」で始めない */
export function realizeSummary(claim: Claim, form: SentenceForm): string {
  if (form === 'contrast' && claim.counterpart) {
    return close(`${claim.subject}、${claim.proposition}。一方で、${claim.counterpart}`)
  }
  if (form === 'conditional' && claim.condition) {
    return close(`${claim.condition}に、${claim.proposition}`)
  }
  return close(`${claim.subject}、${claim.proposition}`)
}

/**
 * 章タイトル。★雛形で合成しない。Claim が持つ typeLabel をそのまま使う。
 * 合成すると「選択を間違えたと気づいたあとから戻る道すじがある」のような
 * 読みにくいタイトルになる。人が書いた名詞句に勝てない。
 */
export function realizeTitle(claim: Claim): string {
  return claim.typeLabel
}

/** ページに表示するラベル。★内部用語をそのまま出さない */
export const BEAT_LABEL: Record<PageBeat, string> = {
  origin: 'ここまでの背景',
  scene: 'よくある場面',
  claim: 'ここで起きていること',
  evidence: '当てはまる場面',
  contrast: '反対側の顔',
  threshold: '切り替わる境目',
  sequence: '順番',
  exception: '例外',
  cost: '引き換えに払うもの',
  others: '周りからの見え方',
  question: 'なぜそうなるのか',
  action: '試せること',
  repair: '戻り方',
  closing: 'この章のまとめ',
}

/** 差し替えページのラベル。同じ「ここで起きていること」を並べないため */
export const CORE_SUB_LABELS = ['別の場面', 'もうひとつの面', '重なるところ', 'ここも同じ'] as const

/** 「あなたは」で始まる文か */
export function startsWithYouSubject(text: string): boolean {
  return /^あなたは/.test(text.trim())
}
