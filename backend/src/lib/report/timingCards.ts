import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportSection, StructuredReport } from '../reportCards.js'
import { japanDateParts } from '../japanDate.js'
import { badgeLabel, lifeEvent, type LifeEventKey } from './lifeEventLabels.js'
import { glossesForEvidence } from './jargon.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'
import type { TimingClaimAsset } from './timingClaim.js'
import { TIMING_CLAIM_ASSETS } from './timingClaimAssets.js'

type Annual = NonNullable<ReportInput['timing']>['annual'][number]
type Decade = NonNullable<ReportInput['timing']>['decades'][number]
const STRONG_THRESHOLD = 6
const FALLBACK_ASSETS = TIMING_CLAIM_ASSETS.filter(asset => asset.specificity === 'fallback' && asset.availability === 'enabled')

function unique(values: string[]) { return [...new Set(values.map(value => value.trim()).filter(Boolean))] }
function stableIndex(value: string, length: number) {
  let hash = 0
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return length === 0 ? 0 : hash % length
}

function eventKeys(values: string[]): LifeEventKey[] {
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

function valuesFor(item: Annual) { return unique([...item.themes, ...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])]) }
function primaryEvent(keys: LifeEventKey[]) {
  return [...keys].sort((left, right) => lifeEvent(left).priority - lifeEvent(right).priority || left.localeCompare(right))[0]
}

function displayTags(key: LifeEventKey) {
  const definition = lifeEvent(key)
  const domain = definition.domain === 'love' ? '恋愛' : definition.domain === 'work' ? '仕事' : '暮らし'
  const legacy = key === 'move' ? '引越し・環境変化' : key === 'meeting' ? '出会い' : definition.label
  return unique([domain, legacy])
}

function paragraph(asset: TimingClaimAsset, index: number) {
  const parts = [asset.counterpart ? `${asset.counterpart}。` : `${asset.proposition}。`]
  if (asset.condition) parts.push(index % 2 === 0 ? `これが強く出るのは、${asset.condition}に限られます。` : `当てはまるのは、${asset.condition}です。`)
  if (asset.cost) parts.push(index % 2 === 0 ? `引き換えになっているのは、${asset.cost}です。` : `そのぶん、${asset.cost}を後回しにします。`)
  parts.push(index % 2 === 0 ? `${asset.behavior}と、扱いやすくなります。` : `まずは${asset.behavior}ことから試せます。`)
  return parts.join('')
}

function clustersFor(allAnnual: Annual[], key: LifeEventKey): number[][] {
  const years = allAnnual.filter(item => eventKeys(valuesFor(item)).includes(key)).map(item => item.year).sort((a, b) => a - b)
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

function assetsFor(key: LifeEventKey, item: Annual) {
  const candidates = FALLBACK_ASSETS.filter(asset => asset.events.length === 1 && asset.events[0] === key)
    .sort((left, right) => right.salienceBase - left.salienceBase || left.id.localeCompare(right.id))
  if (candidates.length === 0) return []
  const headlines = candidates.filter(asset => asset.headline)
  const headline = headlines[stableIndex(`${item.year}|${key}|headline`, headlines.length)] ?? candidates[0]
  const body = candidates.filter(asset => asset.id !== headline.id)
  const offset = stableIndex(`${item.year}|${key}|body`, body.length)
  return [headline, ...Array.from({ length: body.length }, (_, index) => body[(offset + index) % body.length]).slice(0, 2)]
}

function card(input: ReportInput, item: Annual, allAnnual: Annual[], decade?: Decade): ReportCard {
  const rawValues = valuesFor(item)
  const key = primaryEvent(eventKeys(rawValues))
  const assets = assetsFor(key, item)
  const headline = assets[0]
  const badges = badgesFor(input, item, key, allAnnual)
  const rawDetails = unique([item.kanshi, item.tenGod, ...rawValues, ...(decade ? [`長期運 ${decade.kanshi}・${decade.tenGod}`] : [])])
  const evidence = [{ family: '干支系', system: '四柱推命', detail: rawDetails.join('・').slice(0, 160) }]
  const sections: ReportSection[] = assets.slice(1).map((asset, index) => ({
    heading: asset.typeLabel, body: paragraph(asset, index + 1), evidence,
    termGloss: evidence.flatMap(value => glossesForEvidence(value.detail)), claimId: asset.id,
  }))
  const lead = headline ? paragraph(headline, 0) : lifeEvent(key).lead
  const ordinalBadge = badges.find(label => /第.+回目/.test(label))
  const title = `${headline?.typeLabel ?? lifeEvent(key).label}${ordinalBadge ? `（${ordinalBadge}）` : ''}`
  const pages = [{ role: 'opening' as const, label: 'この年の流れ', text: lead }, ...sections.map((section, index) => ({
    role: index === sections.length - 1 ? 'closing' as const : 'core' as const, label: section.heading, text: section.body,
  }))]
  return {
    id: `turning-year-${item.year}`, kind: 'timing', scope: 'self', tab: 'timing', title, summary: lead,
    tags: unique(['時期', ...displayTags(key), ...badges]), period: { label: `${item.year}年（${item.ageRange}）` }, pages, sections, evidence,
    metadataRefs: ['turningPoints', `timing-claim:${headline?.id ?? 'none'}`],
  }
}

function signature(item: Annual) { return valuesFor(item).sort().join('|') }

/** 年の選抜条件は従来どおり。T3は表示と文章資産だけを差し替える。 */
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
}

export function replaceTimingCards(report: StructuredReport, input: ReportInput): StructuredReport {
  const timing = buildTurningPointCards(input).map(card => withCardProvenance(card, 'deterministic'))
  if (timing.length === 0) return report
  const cards = [...report.cards.filter(item => item.kind !== 'timing'), ...timing]
  const reportText = cards.flatMap(item => [`【${item.title}】`, item.summary, ...(item.sections ?? []).flatMap(section => [section.heading, section.body])]).join('\n\n')
  return finalizeReportProvenance({ ...report, reportText, cards }, 'self-report-v3')
}
