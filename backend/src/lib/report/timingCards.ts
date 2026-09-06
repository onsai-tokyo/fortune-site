import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportSection, StructuredReport } from '../reportCards.js'
import { japanDateParts } from '../japanDate.js'
import { periodLabel } from '../age.js'
import { badgeLabel, lifeEvent, type LifeEventKey } from './lifeEventLabels.js'
import { glossesForEvidence } from './jargon.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'
import { annualNarrative } from './timingAnnualNarrative.js'

type Annual = NonNullable<ReportInput['timing']>['annual'][number]
type Decade = NonNullable<ReportInput['timing']>['decades'][number]
const STRONG_THRESHOLD = 6

function unique(values: string[]) { return [...new Set(values.map(value => value.trim()).filter(Boolean))] }

export function timingEventKeys(values: string[]): LifeEventKey[] {
  const has = (pattern: RegExp) => values.some(value => pattern.test(value))
  const keys: LifeEventKey[] = []
  if (has(/結婚|婚約|入籍|同居/)) keys.push('marriage')
  if (has(/出会|縁が始|交際開始|恋愛開始/)) keys.push('meeting')
  if (has(/別れ|離別|失恋|関係.*見直|距離/)) keys.push('separation')
  if (has(/仕事|転職|昇進|責任|役割|成果|独立|肩書/)) keys.push('work')
  if (has(/収入|財|お金|資産|現実/)) keys.push('money')
  if (has(/引越|転居|移動|配置転換|環境.*変|住む場所/)) keys.push('move')
  if (has(/学|資格|探究|知識|訓練|専門/)) keys.push('study')
  if (has(/休|整理|内省|見直|手放|刷新|立て直/)) keys.push('reset')
  return keys.length ? keys : ['seed']
}

export function timingAnnualValues(item: Annual) { return unique([...item.themes, ...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])]) }
function primaryEvent(keys: LifeEventKey[]) {
  return [...keys].sort((left, right) => lifeEvent(left).priority - lifeEvent(right).priority || left.localeCompare(right))[0]
}

function displayTags(key: LifeEventKey) {
  const definition = lifeEvent(key)
  const domain = definition.domain === 'love' ? '恋愛' : definition.domain === 'work' ? '仕事' : '暮らし'
  const legacy = key === 'move' ? '引越し・環境変化' : key === 'meeting' ? '出会い' : definition.label
  return unique([domain, legacy])
}

function clustersFor(allAnnual: Annual[], key: LifeEventKey): number[][] {
  const years = allAnnual.filter(item => timingEventKeys(timingAnnualValues(item)).includes(key)).map(item => item.year).sort((a, b) => a - b)
  const clusters: number[][] = []
  for (const year of years) {
    const last = clusters.at(-1)
    if (!last || year - last.at(-1)! > 2) clusters.push([year])
    else last.push(year)
  }
  return clusters
}

function badgesFor(input: ReportInput, item: Annual, key: LifeEventKey, allAnnual: Annual[]) {
  const definition = lifeEvent(key)
  if (!definition.ordinal) return [definition.label]
  const clusters = clustersFor(allAnnual, key)
  const clusterIndex = clusters.findIndex(cluster => cluster.includes(item.year))
  const strong = Boolean(input.birthTime) && item.score >= STRONG_THRESHOLD
  return clusters.length >= 2 && clusterIndex >= 0 && strong ? [badgeLabel(key, clusterIndex)] : [definition.label]
}

function card(input: ReportInput, item: Annual, allAnnual: Annual[], decade?: Decade): ReportCard | null {
  const themes = annualNarrative(item.themes)
  const relationships = annualNarrative(item.relationshipEvents ?? [])
  const phrases = [...themes, ...relationships]
  // A broad event label alone cannot support a year-specific prediction.
  if (phrases.length === 0) return null
  const rawValues = timingAnnualValues(item)
  const keys = timingEventKeys(rawValues)
  const key = primaryEvent(keys)
  const badges = badgesFor(input, item, key, allAnnual)
  const rawDetails = unique([item.kanshi, item.tenGod, ...rawValues, ...(decade ? [`長期運 ${decade.kanshi}・${decade.tenGod}`] : [])])
  const evidence = [{ family: '干支系', system: '四柱推命', detail: `${item.year}年・${rawDetails.join('・')}` }]
  const sections: ReportSection[] = [
    { heading: 'この年のテーマ', values: themes, source: 'themes' },
    { heading: '人との関係', values: relationships, source: 'relationships' },
  ].filter(section => section.values.length > 0).map(section => ({
    heading: section.heading, body: section.values.map(phrase => phrase.body).join(''), evidence,
    termGloss: evidence.flatMap(value => glossesForEvidence(value.detail)), claimId: `timing-annual-${item.year}-${section.source}`,
  }))
  // Preserve every calculated theme/event even when the primary tag is "work".
  // Do not manufacture year differences with a hash or silently add monthly timing.
  const lead = phrases.map(phrase => phrase.body).join('')
  const ordinalBadge = badges.find(label => /第.+回目/.test(label))
  const themeTitle = phrases[0].title
  const title = `${themeTitle}${ordinalBadge ? `（${ordinalBadge}）` : ''}`
  const pages = [{ role: 'opening' as const, label: 'この年の流れ', text: lead }, ...sections.map((section, index) => ({
    role: index === sections.length - 1 ? 'closing' as const : 'core' as const, label: section.heading, text: section.body,
  }))]
  return {
    id: `turning-year-${item.year}`, kind: 'timing', scope: 'self', tab: 'timing', title, summary: lead,
    tags: unique(['時期', ...displayTags(key), ...badges, ...keys.flatMap(displayTags)]),
    period: { label: input.birthDate ? periodLabel(input.birthDate, item.year)
      : item.age != null ? `${item.year}年（${item.age}歳になる年）` : `${item.year}年（${item.ageRange}）` },
    pages, sections, evidence, metadataRefs: ['turningPoints', `timing-annual:${item.year}`, ...phrases.map(phrase => `timing-annual-v1:${phrase.id}`)],
  }
}

function signature(item: Annual) { return timingAnnualValues(item).sort().join('|') }

/** 年の選抜条件は従来どおり。本文は既存の年計算が持つ生活語を欠落なく表示する。 */
export function buildTurningPointCards(input: ReportInput, nowYear = japanDateParts().year): ReportCard[] {
  const start = nowYear - 15
  const end = nowYear + 20
  const allAnnual = [...(input.timing?.annual ?? [])].sort((a, b) => a.year - b.year)
  const inRange = allAnnual.filter(item => item.year >= start && item.year <= end)
  const turningPoints = inRange.filter(item => {
    const previous = allAnnual.find(value => value.year === item.year - 1)
    const relationshipEvent = (item.relationshipSignals?.length ?? 0) > 0 || (item.relationshipEvents?.length ?? 0) > 0
    const changedTheme = previous ? signature(previous) !== signature(item) : false
    return relationshipEvent || item.score >= 8 || (changedTheme && item.score >= 6)
  })
  const selected = turningPoints.length ? turningPoints : [...inRange].sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 3).sort((a, b) => a.year - b.year)
  return selected.map(item => card(input, item, allAnnual, input.timing?.decades.find(period => item.year >= period.startYear && item.year <= period.endYear)))
    .filter((item): item is ReportCard => item !== null)
}

export function replaceTimingCards(report: StructuredReport, input: ReportInput): StructuredReport {
  if (!input.timing) return report
  const timing = buildTurningPointCards(input).map(card => withCardProvenance(card, 'deterministic'))
  const cards = [...report.cards.filter(item => item.kind !== 'timing'), ...timing]
  const reportText = cards.flatMap(item => [`【${item.title}】`, item.summary, ...(item.sections ?? []).flatMap(section => [section.heading, section.body])]).join('\n\n')
  return finalizeReportProvenance({ ...report, reportText, cards }, 'self-report-v3')
}
