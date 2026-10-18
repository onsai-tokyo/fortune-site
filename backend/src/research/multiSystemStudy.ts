import { calcAstrology, calcVedicAnnualDasha } from '../lib/astrology.js'
import { calcTimingCycles, calcShichu } from '../lib/divination/index.js'
import { buildTimingEvidenceTimeline, type TimingEvidenceBirthInput } from '../lib/report/timingEvidencePipeline.js'
import { buildVedicTimingEvidence } from '../lib/report/timingVedicEvidence.js'
import type { TimingEvidenceDefinition } from '../lib/report/timingScoreEngine.js'
import type { TimingScoreKey } from '../lib/report/timingClaim.js'
import { MULTI_SYSTEM_PATTERNS, SINGLE_THEME_COPY } from './multiSystemPatterns.js'
import { diagnoseVimshottariInterval } from './vimshottariDiagnostic.js'

export const STUDY_POLICY = {
  version: 'multi-system-study-v2-single-supported', productionEligible: false, trainingEligible: false, qualityEligible: false,
  temporalClaim: '年内の対応候補。複数占術の同月・同時成立を示すものではない。',
} as const

export interface StudyEvidence extends TimingEvidenceDefinition {
  timeBasis: string
  interval?: { start: string; end: string }
}
export interface SanmeiContext {
  id: string; family: 'stem_branch'; system: '算命学'; factor: string; body: string
}
const FAMILY_LABELS = { stem_branch: '四柱推命', vedic: 'インド占星術', western: '西洋占星術', ziwei: '紫微斗数', auxiliary: '補助占術' }

export function composeMultiSystemYear(year: number, evidence: readonly StudyEvidence[], contexts: readonly SanmeiContext[] = []) {
  // Same lineage supporting several themes still represents one astronomical/calendar fact.
  const supported = evidence.filter(e => e.available && e.matched && e.support > 0
    && Number.isFinite(e.support) && (e.quality ?? 1) > 0 && (e.polarity ?? 1) === 1)
  const opposed = evidence.filter(e => e.available && e.matched && e.support > 0 && (e.polarity ?? 1) === -1)
  const themes = [...new Set(supported.map(e => e.scoreKey))].sort().map(key => {
    const rows = supported.filter(e => e.scoreKey === key)
    const families = [...new Set(rows.map(e => e.sourceFamily))].sort()
    const groups = [...new Set(rows.map(e => e.correlationGroup))].sort()
    return { key, families, groups, evidenceIds: [...new Set(rows.map(e => e.id))],
      status: opposed.some(e => e.scoreKey === key) ? 'mixed' as const
        : groups.length >= 2 ? 'cross_group_correspondence' as const
          : families.length >= 2 ? 'related_systems_only' as const : 'single_system' as const }
  })
  const cards = MULTI_SYSTEM_PATTERNS.flatMap(pattern => {
    const rows = supported.filter(e => pattern.themes.includes(e.scoreKey))
    if (!pattern.themes.every(theme => rows.some(e => e.scoreKey === theme))) return []
    const groups = [...new Set(rows.map(e => e.correlationGroup))].sort()
    // One system is now sufficient by user request. Groups describe provenance,
    // not an admission gate; all component themes must still have real support.
    if (opposed.some(e => pattern.themes.includes(e.scoreKey))) return []
    const factors = [...new Set(rows.map(e => e.factLineageId))]
    const overlap = pattern.themes.filter(key => themes.some(t => t.key === key && t.status === 'cross_group_correspondence'))
    return [{ id: `${year}:${pattern.id}`, patternId: pattern.id, title: pattern.title, body: pattern.body,
      themes: pattern.themes, groups, factors, systems: [...new Set(rows.map(e => FAMILY_LABELS[e.sourceFamily]))].sort(),
      agreementThemes: overlap, relationship: overlap.length ? 'shared_and_complementary'
        : new Set(rows.map(e => e.sourceFamily)).size === 1 ? 'single_system' : 'complementary_only',
      evidence: rows, sanmeiContexts: contexts, ...STUDY_POLICY }]
  })
  const singleReadings = themes.map(theme => {
    const rows = supported.filter(e => e.scoreKey === theme.key)
    const counterEvidence = opposed.filter(e => e.scoreKey === theme.key)
    return { id: `${year}:single:${theme.key}`, theme: theme.key, ...SINGLE_THEME_COPY[theme.key],
      systems: theme.families.map(f => FAMILY_LABELS[f]), groups: theme.groups, status: theme.status,
      evidence: rows, counterEvidence,
      qualification: counterEvidence.length ? '同じテーマに相反する読みもあります。方向を一つに決めず、両方の根拠を確認してください。' : null,
      ...STUDY_POLICY }
  })
  // Sanmei need not wait for a compound card to exist. Keep its actual factor
  // attached, and do not manufacture an event score or another independent vote.
  const sanmeiReadings = contexts.map(context => ({ ...context, ...STUDY_POLICY }))
  return { year, cards, singleReadings, sanmeiReadings, themes, contexts, availableEvidenceCount: evidence.filter(e => e.available).length,
    unavailableEvidenceCount: evidence.filter(e => !e.available).length,
    evidence, ...STUDY_POLICY }
}

const LORD_JA: Record<string, string> = { Ketu: 'ケートゥ', Venus: '金星', Sun: '太陽', Moon: '月', Mars: '火星', Rahu: 'ラーフ', Jupiter: '木星', Saturn: '土星', Mercury: '水星' }
const pad = (n: number) => String(n).padStart(2, '0')

/** Observation-free renderer. Only birth fields and a year range enter calculation.
 * The current annual Vedic representative is replaced IN THIS STUDY ONLY by all
 * actual major/minor intervals intersecting the year, with explicit provenance.
 * No scorer, threshold, production option or live artifact is modified. */
export function buildMultiSystemStudy(input: TimingEvidenceBirthInput, fromYear: number, throughYear: number) {
  // Explicit allowlist: notes/names/observations are never retained or forwarded.
  input = { birthYear: input.birthYear, birthMonth: input.birthMonth, birthDay: input.birthDay,
    birthHour: input.birthHour, birthMinute: input.birthMinute, gender: input.gender, birthplace: input.birthplace }
  if (!Number.isInteger(fromYear) || !Number.isInteger(throughYear) || fromYear > throughYear
    || fromYear < input.birthYear + 18 || throughYear > input.birthYear + 60) throw new RangeError('Study range must be within ages 18–60')
  const timeline = buildTimingEvidenceTimeline(input)
  const timing = calcTimingCycles(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0, input.gender)
  const astro = calcAstrology(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0, input.birthplace)
  const moon = astro.vedic?.planets.find(p => p.name === '月')?.longitude ?? null
  const date = `${input.birthYear}-${pad(input.birthMonth)}-${pad(input.birthDay)}`
  const birthInstant = input.birthHour === undefined ? null : `${date}T${pad(input.birthHour)}:${pad(input.birthMinute ?? 0)}:00+09:00`
  const dasha = diagnoseVimshottariInterval({ birthInstant, siderealMoonLongitude: moon,
    sourceRef: 'calcAstrology/astronomy-engine; existing Lahiri approximation; no independent oracle',
    from: `${fromYear}-01-01T00:00:00+09:00`, until: `${throughYear + 1}-01-01T00:00:00+09:00` })
  const dashaHouses = input.birthHour === undefined ? undefined
    : calcVedicAnnualDasha(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0, input.birthplace)[0]
  const endpoints = [0, 23].map(hour => calcShichu(input.birthYear, input.birthMonth, input.birthDay, hour, hour === 23 ? 59 : 0))
  const dayStable = input.birthHour !== undefined || endpoints[0].day.kanshi === endpoints[1].day.kanshi
  const years = timeline.years.filter(year => year >= fromYear && year <= throughYear).map(year => {
    const start = Date.parse(`${year}-01-01T00:00:00+09:00`), end = Date.parse(`${year + 1}-01-01T00:00:00+09:00`)
    const rows: StudyEvidence[] = (timeline.byYear.get(year) ?? []).filter(e => e.sourceFamily !== 'vedic').map(e => ({ ...e,
      timeBasis: e.sourceFamily === 'western' ? '出生月日の年代表点。年間走査・月判定ではない'
        : e.sourceFamily === 'ziwei' ? '既存の流年計算。暦の境界と月の対応は未照合'
          : '既存の流年・大運。節入り境界と月の対応は未照合' }))
    for (const period of dasha.periods) {
      if (Date.parse(period.start) >= end || Date.parse(period.end) <= start) continue
      const annual = { ...dashaHouses, year, available: true,
        mahadashaLord: LORD_JA[period.major], antardashaLord: LORD_JA[period.minor],
        mahadashaTransition: period.major === period.minor && Date.parse(period.start) >= start && Date.parse(period.start) < end }
      for (const e of buildVedicTimingEvidence([annual]).get(year) ?? []) rows.push({ ...e,
        id: `${e.id}:${period.start}`, interval: { start: period.start, end: period.end },
        timeBasis: '明示出生時刻からのダシャー区間。365.25日/年の研究方式',
        detail: `${e.detail ?? ''} / ${period.start}〜${period.end}` })
    }
    if (!dasha.available) {
      rows.push(...(timeline.byYear.get(year) ?? []).filter(e => e.sourceFamily === 'vedic')
        .map(e => ({ ...e, available: false, matched: false, support: 0, timeBasis: '出生時刻不明: ダシャー未利用' })))
    }
    const raw = timing.annual.find(y => y.year === year)!
    const contexts: SanmeiContext[] = dayStable ? (raw.sanmeiSignals ?? []).flatMap(factor => {
      if (factor.includes('天中殺')) return [{ id: `${year}:sanmei-void`, family: 'stem_branch' as const, system: '算命学' as const, factor,
        body: '算命学の補足では、拡大を急ぐより、前提や進め方を確かめ直すテーマとして扱います。失敗や不幸を意味するものではありません。' }]
      if (factor.startsWith('位相法')) return [{ id: `${year}:sanmei-phase`, family: 'stem_branch' as const, system: '算命学' as const, factor,
        body: '算命学の位相法でも関わり方の変化を確認します。四柱推命と同じ干支関係に由来するため、独立した一致として加算しません。' }]
      return []
    }) : []
    return composeMultiSystemYear(year, rows, contexts)
  })
  return { ...STUDY_POLICY, input, years, dasha,
    limitations: [
      '占術要素と生活テーマの対応は既存の未承認ルールに基づく研究候補。的中率ではない。',
      '西洋は年代表点、干支・紫微はそれぞれの流年。年内の候補を同時成立や特定月の出来事へ読み替えない。',
      input.birthplace ? '出生地は県の情報。角度・ハウスは県庁代表座標による概算。市町村・座標の感度未検証。' : '出生地不明。場所が必要な要素は未判定。',
      input.birthHour === undefined ? '出生時刻不明。インドのダシャー・紫微斗数・角度などは補完せず未判定。' : '出生時刻の申告誤差・日界の方式差は別途検証が必要。',
      '宿曜・納音・九星気学の出来事別時期adapterは未接続。出生時の分類だけで特定年の独立した根拠を作らない。',
    ],
  }
}

export interface StudyObservation { id: string; year: number; months?: number[]; themes: TimingScoreKey[]; note: string }
/** Labels are joined only after birth-only calculation; never select prose with them. */
export function compareStudyObservations(study: ReturnType<typeof buildMultiSystemStudy>, observations: readonly StudyObservation[]) {
  return observations.map(observation => {
    const year = study.years.find(y => y.year === observation.year)
    const correspondence = observation.themes.filter(key => year?.themes.some(t => t.key === key && t.status === 'cross_group_correspondence'))
    const supportedThemes = observation.themes.filter(key => year?.singleReadings.some(r => r.theme === key))
    const windows = observation.months?.length ? observation.months.map(month => ({
      start: Date.UTC(observation.year, month - 1, 1, -9), end: Date.UTC(observation.year, month, 1, -9),
    })) : [{ start: Date.UTC(observation.year, 0, 1, -9), end: Date.UTC(observation.year + 1, 0, 1, -9) }]
    const dashaPeriods = study.dasha.periods.filter(p => windows.some(w => Date.parse(p.start) < w.end && Date.parse(p.end) > w.start))
    return { observation, correspondence, supportedThemes, noSupportedThemes: observation.themes.filter(key => !supportedThemes.includes(key)),
      noCrossGroupCorrespondence: observation.themes.filter(key => !correspondence.includes(key)),
      dashaPeriods, dashaAvailable: study.dasha.available,
      patternIds: year?.cards.map(c => c.patternId) ?? [],
      status: year ? 'retrospective_theme_comparison' : 'outside_range',
      eventVerified: false, monthlyEventVerified: false,
      note: '未記録の出来事を不発としない。候補との対応は、事実の予測成功を意味しない。' }
  })
}
