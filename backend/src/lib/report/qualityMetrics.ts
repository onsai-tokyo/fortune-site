import type { ReportCard, StructuredReport } from '../reportCards.js'
import type { ReportFinding } from './findings.js'

/**
 * PR-0b: 「似ている」を数値で測る。
 *
 * 以降のPRは、この指標のベースライン差分だけで合否を判定する。
 * 目視の印象で採否を決めないこと。印象は再現しないが、この数値は再現する。
 */

export interface ReportQualityMetrics {
  /** 本質章（tab==='essence'）の枚数 */
  chapterCount: number
  /** Findingが割り当たらず補完文で埋まった章の割合 */
  supplementChapterRate: number
  /** 1鑑定書内でのページ本文ユニーク率。1.0 なら章内・章間の重複ゼロ */
  uniquePageTextRate: number
  /** 同一タイトルの重複数（0が正常） */
  duplicateTitleCount: number
  /** 年カードのタイトル重複数 */
  duplicateTimingTitleCount: number
  /** 年カードの枚数 */
  timingCardCount: number
  /** 使用されたFinding key集合 */
  findingKeys: string[]
  /** evidence に現れた占術名の種類数。少ないほど「一部の占術しか効いていない」 */
  evidenceSystemCount: number
  /** 恋愛章に混入した仕事語彙 + 仕事章に混入した恋愛語彙のページ数 */
  loveWorkLeakage: number
}

export interface CorpusQualityMetrics {
  sampleCount: number
  /** 全ペアのページ本文Jaccardの中央値。低いほど個人差がある */
  pairwisePageJaccardMedian: number
  /** 全ペアのFinding key集合Jaccardの中央値 */
  pairwiseFindingJaccardMedian: number
  /** 全ペアでタイトル構成が完全一致した組の割合 */
  identicalTitleSetRate: number
  /** コーパス全体で観測されたユニークな本質章タイトル数 */
  distinctEssenceTitles: number
  /** スクロール本文でユーザーが見る Claim 見出しのユニーク数 */
  distinctDisplayedClaimHeadings: number
  /** evidence が1件もない本質カード数 */
  emptyEvidenceCardCount: number
  /** 2占術以上の evidence を持つ本質カード数 */
  multiSystemEvidenceCardCount: number
  /** summary が「あなたは」で始まる本質カードの割合 */
  youSubjectRate: number
  /** 同一の本質タイトルが出た最大回数 */
  maxTitleRepeat: number
  /** 本質カードのページラベル列の種類数 */
  labelSequenceVariety: number
  /** コーパス全体で観測されたユニークな年カードタイトル数 */
  distinctTimingTitles: number
  /** コーパス全体で観測されたユニークなページ本文数 */
  distinctPageTexts: number
  /** 補完章率の平均 */
  meanSupplementChapterRate: number
  /** 恋愛/仕事混入の合計 */
  totalLoveWorkLeakage: number
}

const WORK_LEXICON = /仕事|職場|上司|部下|同僚|転職|昇進|会社|業務|役職|勤務|案件|取引先/
const LOVE_LEXICON = /恋愛|恋人|交際|片思い|婚約|結婚|夫婦|好きな人|デート|復縁/

function isEssenceCard(card: ReportCard): boolean {
  return card.tab === 'essence' || (card.tab === undefined && card.kind === 'essence')
}

function isTimingCard(card: ReportCard): boolean {
  return card.tab === 'timing' || card.kind === 'timing'
}

function isSupplementCard(card: ReportCard): boolean {
  if (card.compositionMode === 'supplement') return true
  return (card.metadataRefs ?? []).some(ref => ref.startsWith('supplement:'))
}

function countDuplicates(values: string[]): number {
  const seen = new Set<string>()
  let duplicates = 0
  for (const value of values) {
    if (seen.has(value)) duplicates += 1
    else seen.add(value)
  }
  return duplicates
}

/**
 * 領域混入の検出。
 * 恋愛章（id が love- で始まる）のページ本文に仕事語彙が出たら1、その逆も1。
 * ページ label が明示的に相手領域を扱う場合（例: 「任され方との相性」）も混入として数える。
 * ここを甘くすると、恋愛章に仕事の話が入る問題が指標へ出なくなる。
 */
function countLoveWorkLeakage(cards: ReportCard[]): number {
  let leakage = 0
  for (const card of cards) {
    const isLove = card.id.startsWith('love-')
    const isWork = card.id.startsWith('work-')
    if (!isLove && !isWork) continue
    for (const page of card.pages) {
      const haystack = `${page.label}${page.text}`
      if (isLove && WORK_LEXICON.test(haystack)) leakage += 1
      if (isWork && LOVE_LEXICON.test(haystack)) leakage += 1
    }
  }
  return leakage
}

export function measureReportQuality(report: StructuredReport, findings: ReportFinding[] = []): ReportQualityMetrics {
  const essence = report.cards.filter(isEssenceCard)
  const timing = report.cards.filter(isTimingCard)
  const pageTexts = report.cards.flatMap(card => card.pages.map(page => page.text))
  const evidenceSystems = new Set(report.cards.flatMap(card => card.evidence.map(item => item.system)))

  return {
    chapterCount: essence.length,
    supplementChapterRate: essence.length === 0 ? 0 : essence.filter(isSupplementCard).length / essence.length,
    uniquePageTextRate: pageTexts.length === 0 ? 1 : new Set(pageTexts).size / pageTexts.length,
    duplicateTitleCount: countDuplicates(essence.map(card => card.title)),
    duplicateTimingTitleCount: countDuplicates(timing.map(card => card.title)),
    timingCardCount: timing.length,
    findingKeys: [...new Set(findings.map(finding => finding.key))].sort(),
    evidenceSystemCount: evidenceSystems.size,
    loveWorkLeakage: countLoveWorkLeakage(report.cards),
  }
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1
  let intersection = 0
  for (const value of left) if (right.has(value)) intersection += 1
  const union = left.size + right.size - intersection
  return union === 0 ? 1 : intersection / union
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

export interface CorpusSample {
  id: string
  report: StructuredReport
  findings: ReportFinding[]
}

export function measureCorpusQuality(samples: CorpusSample[]): CorpusQualityMetrics {
  const prepared = samples.map(sample => ({
    id: sample.id,
    pages: new Set(sample.report.cards.flatMap(card => card.pages.map(page => page.text))),
    findingKeys: new Set(sample.findings.map(finding => finding.key)),
    titles: sample.report.cards.filter(isEssenceCard).map(card => card.title).sort().join('|'),
    metrics: measureReportQuality(sample.report, sample.findings),
    essenceTitles: sample.report.cards.filter(isEssenceCard).map(card => card.title),
    essenceCards: sample.report.cards.filter(isEssenceCard),
    timingTitles: sample.report.cards.filter(isTimingCard).map(card => card.title),
  }))

  const pageJaccard: number[] = []
  const findingJaccard: number[] = []
  let identicalTitleSets = 0
  let pairs = 0
  for (let i = 0; i < prepared.length; i += 1) {
    for (let j = i + 1; j < prepared.length; j += 1) {
      pairs += 1
      pageJaccard.push(jaccard(prepared[i].pages, prepared[j].pages))
      findingJaccard.push(jaccard(prepared[i].findingKeys, prepared[j].findingKeys))
      if (prepared[i].titles === prepared[j].titles) identicalTitleSets += 1
    }
  }

  const essenceCards = prepared.flatMap(item => item.essenceCards)
  const titleCounts = essenceCards.reduce<Map<string, number>>((counts, card) => {
    counts.set(card.title, (counts.get(card.title) ?? 0) + 1)
    return counts
  }, new Map())
  return {
    sampleCount: prepared.length,
    pairwisePageJaccardMedian: Number(median(pageJaccard).toFixed(4)),
    pairwiseFindingJaccardMedian: Number(median(findingJaccard).toFixed(4)),
    identicalTitleSetRate: pairs === 0 ? 0 : Number((identicalTitleSets / pairs).toFixed(4)),
    distinctEssenceTitles: new Set(prepared.flatMap(item => item.essenceTitles)).size,
    distinctDisplayedClaimHeadings: new Set(essenceCards.flatMap(card =>
      (card.sections?.length ? card.sections.map(section => section.heading) : [card.title])
    )).size,
    emptyEvidenceCardCount: essenceCards.filter(card => card.evidence.length === 0).length,
    multiSystemEvidenceCardCount: essenceCards.filter(card => new Set(card.evidence.map(item => item.system)).size >= 2).length,
    youSubjectRate: essenceCards.length === 0 ? 0 : Number((essenceCards.filter(card => /^あなたは/u.test(card.summary)).length / essenceCards.length).toFixed(4)),
    maxTitleRepeat: Math.max(0, ...titleCounts.values()),
    labelSequenceVariety: new Set(essenceCards.map(card => card.pages.map(page => page.label).join('|'))).size,
    distinctTimingTitles: new Set(prepared.flatMap(item => item.timingTitles)).size,
    distinctPageTexts: new Set(prepared.flatMap(item => [...item.pages])).size,
    meanSupplementChapterRate: prepared.length === 0 ? 0
      : Number((prepared.reduce((sum, item) => sum + item.metrics.supplementChapterRate, 0) / prepared.length).toFixed(4)),
    totalLoveWorkLeakage: prepared.reduce((sum, item) => sum + item.metrics.loveWorkLeakage, 0),
  }
}
