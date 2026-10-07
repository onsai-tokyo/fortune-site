/**
 * Timeline v3 — couple timeline (ふたりの時系列).
 * Applies the individual v3 signals to both people and composes pair-level years.
 * Output shape mirrors coupleAllYears/snapshot.ts#snapshotTimeline so the route can switch by flag.
 * Spec: docs/timeline-v3/COUPLE.md
 */
import { readFileSync } from 'node:fs'
import type { ReportCard, ReportCardEvidence, ReportSection } from '../../reportCards.js'
import { candidate, type TimelineTag } from '../timelineTags.js'
import { timelineLayout } from '../coupleAllYears/timeline.js'
import { decideYear, timelineContext, toneOf, setPairToneResolver, type StageTone, type PartnerKind, yearSignals, tenGod, movementQuality, type TimelineContext, type TimelineV3Input, type YearSignals } from './signals.js'
import { composeYear, parts, pickPossibilities, pastizeAll, toSimpleCard, type TimelineStyle } from './compose.js'
import { eventParts } from './events.js'
import { formatMonth } from './vedic.js'
import { decadeInfo, depthParts, keepForTense, timingParagraph, yearTone } from './depth.js'
import { areaParts } from './areas.js'
import { TIMELINE_V3_VERSION } from './version.js'
import { personalLines } from './personal.js'
import { pairLifeLines, eventTimeline } from './lifeline.js'

let PP: any
export function pairParts(): any {
  PP ??= JSON.parse(readFileSync(new URL('./data/pairParts.json', import.meta.url), 'utf8'))
  return PP
}
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
const pastize = (s: string) => s.replace(/時期です。$/, '時期でした。').replace(/年です。$/, '年でした。')

export type PairStatus = 'crush' | 'partnered' | 'engaged' | 'married' | 'former' | 'friend' | 'family'
export type PairTheme = 'both' | 'self' | 'partner' | 'trust' | 'quiet' | 'friend'
export interface CoupleV3Input { self: TimelineV3Input; partner: TimelineV3Input; relationshipLabel?: string; meetingYear: number | null; referenceYear: number; endYear?: number; style?: TimelineStyle }

export function pairStatus(label: string | undefined): PairStatus {
  return (pairParts().labelStatus[label ?? ''] as PairStatus) ?? 'partnered'
}
const romantic = (s: PairStatus) => s !== 'friend' && s !== 'family'
const manifestKey = (s: PairStatus) => s === 'engaged' ? 'partnered' : s

export interface PairDecision {
  theme: PairTheme; strength: 'quiet' | 'active' | 'major'
  relSelf: number; relPartner: number; marriage: boolean; meeting: boolean
  chapterSelf: boolean; chapterPartner: boolean
  /** v2.16: years since the meeting (partnered / engaged, 1–4) or since the marriage from your 年表 (3–7) */
  stage: { kind: 'dating' | 'married'; k: number } | null
}

export function pairStage(a: TimelineContext, status: PairStatus, year: number, meetingYear: number | null): PairDecision['stage'] {
  if (meetingYear === null || !['partnered', 'engaged', 'married', 'crush', 'former'].includes(status)) return null
  const evs = (a.input.lifeEvents ?? []).filter(e => e.year >= meetingYear && e.year < year && ['marriage', 'divorce', 'breakup'].includes(e.kind))
  const last = evs.at(-1)
  if (last?.kind === 'marriage') { const k = year - last.year; return k >= 3 && k <= 7 ? { kind: 'married', k } : null }
  if (last) return null
  // v2.23: a married couple without a recorded marriage, crush and former couples also count the years from the meeting
  // (the window is the same; only the wording differs by label)
  const k = year - meetingYear
  return k >= 1 && k <= 4 ? { kind: 'dating', k } : null
}

export function pairBase(a: TimelineContext, b: TimelineContext, status: PairStatus, year: number, meetingYear: number | null): { d: PairDecision; sa: YearSignals; sb: YearSignals } {
  const sa = yearSignals(a, year), sb = yearSignals(b, year)
  const relSelf = sa.relationship.score, relPartner = sb.relationship.score
  const trust = decideYear(a, year).theme === 'trust' || decideYear(b, year).theme === 'trust'
  let theme: PairTheme
  if (!romantic(status)) theme = 'friend'
  else if (trust) theme = 'trust'
  else if (relSelf >= 2 && relPartner >= 2) theme = 'both'
  // One-sided years need a clearer signal (>=3, or >=2 with the other side at least 1) so the couple view stays selective.
  else if (relSelf >= 3 || (relSelf >= 2 && relPartner >= 1)) theme = 'self'
  else if (relPartner >= 3 || (relPartner >= 2 && relSelf >= 1)) theme = 'partner'
  else theme = 'quiet'
  // v2.16: inside a stage window, one astrological point on either side is enough for a moving year
  const stage = pairStage(a, status, year, meetingYear)
  if (theme === 'quiet' && stage && !(status === 'married' && stage.kind === 'dating') && (relSelf >= 1 || relPartner >= 1)) theme = relSelf >= 1 && relPartner >= 1 ? 'both' : relSelf >= relPartner ? 'self' : 'partner'
  const strength = theme === 'both' || (theme === 'trust' && Math.max(relSelf, relPartner) >= 4) ? 'major' : theme === 'quiet' || theme === 'friend' ? 'quiet' : 'active'
  const adults = sa.age >= 18 && sb.age >= 18
  const marriage = year !== meetingYear && adults && (status === 'partnered' || status === 'engaged') && stage?.kind !== 'married' && (theme === 'both' || ((theme === 'self' || theme === 'partner') && relSelf + relPartner >= (stage?.kind === 'dating' ? 3 : 5)))
  return { d: { theme, strength, relSelf, relPartner, marriage, meeting: year === meetingYear, chapterSelf: sa.chapterStarts.length > 0, chapterPartner: sb.chapterStarts.length > 0, stage }, sa, sb }
}

/**
 * v2.21: the pair decision is the v2.16 pair scoring as is. The v2.19 guarantee (one 婚期 year picked by the signals
 * inside meeting + 1..4) was dropped: on 180 celebrity couples with a known dating start, the picked year matched the
 * marriage / breakup year no better than chance (VALIDATION.md §1m). The life-stage window itself is shown instead
 * (2–3 years after the meeting are the peak).
 */
export function decidePairYear(a: TimelineContext, b: TimelineContext, status: PairStatus, year: number, meetingYear: number | null): { d: PairDecision; sa: YearSignals; sb: YearSignals } {
  return pairBase(a, b, status, year, meetingYear)
}

/** v2.20: each person's context for the pair view — the relationship status of the pair and the meeting year as partnerSince. */
export function pairContexts(self: TimelineV3Input, partner: TimelineV3Input, status: PairStatus, meetingYear: number | null): [TimelineContext | null, TimelineContext | null] {
  const st: TimelineV3Input['relationshipStatus'] = status === 'partnered' || status === 'engaged' ? 'partnered' : status === 'married' ? 'married' : status === 'crush' || status === 'former' ? 'single' : undefined
  // v2.23: every romantic label carries the meeting year with its kind (wording only); friend / family do not
  const kind: PartnerKind | undefined = status === 'partnered' || status === 'engaged' ? 'partnered' : status === 'crush' ? 'crush' : status === 'former' ? 'former' : status === 'married' ? 'married' : undefined
  const since = kind && meetingYear !== null ? meetingYear : undefined
  const mk = (x: TimelineV3Input) => timelineContext({ ...x, ...(st ? { relationshipStatus: st } : {}), ...(since !== undefined ? { partnerSince: since, partnerKind: kind } : {}) })
  return [mk(self), mk(partner)]
}

/** v2.24: the two people's fortune for a relationship-window line (進む・見直す・両方・穏やか). Shared with the single timeline. */
export function pairTone(a: TimelineContext, b: TimelineContext, status: PairStatus, year: number, meetingYear: number | null): StageTone {
  const { d, sa, sb } = decidePairYear(a, b, status, year, meetingYear)
  const movingHits = d.theme === 'both' ? [...sa.relationship.hits, ...sb.relationship.hits] : d.theme === 'self' ? sa.relationship.hits : d.theme === 'partner' ? sb.relationship.hits : []
  const quality = !movingHits.length ? null : d.strength === 'major' && !d.marriage ? 'mixed' : movementQuality(movingHits.map(h => h.id))
  return toneOf(movingHits.length ? 'moving' : d.theme === 'trust' ? 'trust' : 'quiet', quality, d.marriage, d.strength === 'major')
}

setPairToneResolver((a, b, kind, year, meeting) => pairTone(a, b, kind, year, meeting))

export function composePairYear(a: TimelineContext, b: TimelineContext, status: PairStatus, year: number, meetingYear: number | null, nowYear: number, style: TimelineStyle = 'detailed'): ReportCard {
  const P = parts(), Q = pairParts(), E = eventParts()
  const { d, sa, sb } = decidePairYear(a, b, status, year, meetingYear)
  const i = Math.floor(year / 10) % 3, j = ((year % 3) + 3) % 3
  const past = year < nowYear
  const ga = P.tenGods[sa.tenGod]
  // crush / former: the two are not together; quiet and trust years use the 'apart' wording, and advice never assumes a shared life.
  const apart = status === 'crush' || status === 'former'
  const A = Q.apart
  const movingHits = d.theme === 'both' ? [...sa.relationship.hits, ...sb.relationship.hits] : d.theme === 'self' ? sa.relationship.hits : d.theme === 'partner' ? sb.relationship.hits : []
  // a major pair year (both moving) reads both ways unless it is a 婚期 year
  const quality = !movingHits.length ? null : d.strength === 'major' && !d.marriage ? 'mixed' : movementQuality(movingHits.map(h => h.id))
  const leadSet = apart && (d.theme === 'quiet' || d.theme === 'trust') ? A.leads[d.theme] : Q.leads[d.theme]
  const tailSet = apart && (d.theme === 'quiet' || d.theme === 'trust') ? A.tails[d.theme] : Q.tails[d.theme]

  // headline
  // the meeting year reads as a beginning, whatever the year's pair theme is
  const meetingRomantic = d.meeting && romantic(status)
  const title = `${ga.leads[i]}、${meetingRomantic ? depthParts().pair.meeting.tails[j] : tailSet[j]}`

  // 1. flow
  const flow: string[] = []
  if (d.meeting) flow.push(Q.meeting)
  const lead = leadSet[j]
  // Meeting year: "二人が出会った年です。" replaces the theme lead ("関わり方が変わる" does not fit a first meeting).
  if (!d.meeting) flow.push(lead)
  if (!d.meeting && quality) flow.push(Q.qualitySentence[quality][j])
  const color = sa.tenGod === sb.tenGod ? fill(Q.colorSentence.same, { a: Q.colorNoun[sa.tenGod] }) : fill(Q.colorSentence.different, { a: Q.colorNoun[sa.tenGod], b: Q.colorNoun[sb.tenGod] })
  flow.push(color)
  // both adults: how the year's elements meet each chart
  const DP = depthParts().pair
  const adultA = sa.age >= 18, adultB = sb.age >= 18
  if (adultA && adultB) {
    const ta = yearTone(a, year, sa.pillar).tone, tb = yearTone(b, year, sb.pillar).tone
    flow.push(ta === tb ? fill(DP.toneSameLine, { a: DP.toneWord[ta] }) : fill(DP.toneLine, { a: DP.toneWord[ta], b: DP.toneWord[tb] }))
    // the pair sentence is advice-like; past years keep only the factual tone line
    if (!past) flow.push((ta !== tb ? DP.tonePair.different : ta === 'tailwind' ? DP.tonePair.bothTail : ta === 'headwind' ? DP.tonePair.bothHead : DP.tonePair.bothMixed)[j])
  }
  // The meeting-year reading is an interpretation ("〜と読むことができます"), so it is appended after tense conversion.
  const meetingReading = d.meeting && romantic(status) ? E.readings[sa.tenGod].begin.split('。')[1] + '。' : ''

  // how many earlier years (both adults) had the same pair theme: rotates the manifestation sets and the theme lines
  // (both / self / partner share one manifestation list, so they are counted together for the sets)
  const listOf = (t: PairTheme) => t === 'self' || t === 'partner' || t === 'both' ? 'move' : t
  let themeSeen = 0, listSeen = 0
  for (let y = Math.max(a.birthYear, b.birthYear) + 18; y < year; y++) {
    const t = decidePairYear(a, b, status, y, meetingYear).d.theme
    if (t === d.theme) themeSeen++
    if (listOf(t) === listOf(d.theme)) listSeen++
  }

  // 2. manifestations
  const manifest: string[] = []
  const strength = d.strength === 'major' ? 'major' : 'active'
  // Meeting year: always read as a beginning (the label describes the present, not the meeting).
  // Former couples: the breakup year is unknown, so past moving/trust years use the neutral individual lists.
  const formerPast = status === 'former' && past
  const together = ['partnered', 'engaged', 'married'].includes(status) && adultA && adultB
  const partnerSide = d.theme === 'partner' || (d.theme === 'trust' && decideYear(a, year).theme !== 'trust')
  const ownLines = together ? (partnerSide ? composeYear(b, year, nowYear).relLines.map(x => x.replaceAll('あなた', '相手')) : composeYear(a, year, nowYear).relLines) : []
  if (d.meeting && romantic(status)) manifest.push(...pickPossibilities(Q.manifestations.meeting, year, strength, undefined, listSeen))
  else if (formerPast && (d.theme === 'trust' || d.theme === 'both' || d.theme === 'self' || d.theme === 'partner')) manifest.push(...pickPossibilities(P.manifestations[d.theme === 'trust' ? 'trust' : 'relationship'].unknown, year, strength))
  else if (d.theme === 'friend') manifest.push(...pickPossibilities(Q.manifestations.friend, year, 'active', undefined, listSeen))
  // v2.20: two people who are together: the year shows the way the person's own timeline reads it (the partner's
  // lines when only the partner moves or reviews trust), so the pair view never contradicts ひとりの時系列
  else if (together && ownLines.length) manifest.push(...ownLines)
  else if (d.theme === 'trust') manifest.push(...pickPossibilities(Q.manifestations.trust[manifestKey(status)], year, strength, undefined, listSeen))
  else if (d.theme === 'quiet') manifest.push(...pickPossibilities(apart ? A.manifestations[status] : Q.manifestations.quiet, year, 'active', undefined, listSeen))
  else manifest.push(...pickPossibilities(Q.manifestations.move[manifestKey(status)], year, strength, quality ? P.qualities[quality].order : undefined, listSeen))
  const manifestText = manifest.map((s, k) => k === 0 ? s.replace(/こともあります。$/, 'ことがあります。') : s.replace(/ことがあります。$/, 'こともあります。')).join('')
  const milestones: string[] = []
  if (d.marriage) milestones.push(P.milestones.marriage[j])
  if (d.chapterSelf) milestones.push(past ? pastizeAll(Q.chapter.self) : Q.chapter.self)
  if (d.chapterPartner) milestones.push(past ? pastizeAll(Q.chapter.partner) : Q.chapter.partner)

  // 3. advice
  const moving = d.theme === 'both' || d.theme === 'self' || d.theme === 'partner'
  // advice / reflection rotate with the year (not the decade), so consecutive quiet years never repeat
  const tense = (t: string) => past ? pastizeAll(t) : t
  let adviceExtra = ''
  // v2.14: your 年表 from the meeting year on (wording only)
  const life = pairLifeLines(a, status, meetingYear, moving || d.theme === 'trust', year, nowYear)
  const lifeText = life ? [life.inYear, life.anchor && !d.stage ? tense(life.anchor) : null].filter(Boolean).join('') : ''
  // v2.15: for two people who are together, a moving / trust year is named a 「関係が揺れやすい年」 (VALIDATION.md §1g–1h:
  // divorce years fall in these years about 1.8x as often as in the other years of the same marriage, 75 couples).
  // Not for the meeting year, a 婚期 year, or a year with an entered event (those already say what the year is).
  const SW = depthParts().pair.sway
  // v2.21: married couples only — divorce years gather in these years (1.77x), breakups of dating couples do not (0.89x, §1m)
  // v2.22: the evidence is for years inside the marriage, so with a 年表 marriage after the meeting, years up to it are left out
  const wedYear = (a.input.lifeEvents ?? []).find(e => e.kind === 'marriage' && meetingYear !== null && e.year >= meetingYear)?.year
  // married couples: the meeting-year window is mostly before the wedding, so no 揺れやすい年 there (v2.23)
  const sway = status === 'married' && d.stage?.kind !== 'dating' && (moving || d.theme === 'trust') && !d.meeting && !d.marriage && !life?.inYear && !(wedYear !== undefined && year <= wedYear)
  let swaySeen = 0
  if (sway) for (let y = Math.max((meetingYear ?? year), wedYear ?? -Infinity) + 1; y < year; y++) { const x = decidePairYear(a, b, status, y, meetingYear).d; if (x.stage?.kind !== 'dating' && (x.theme === 'both' || x.theme === 'self' || x.theme === 'partner' || x.theme === 'trust') && !x.meeting && !x.marriage) swaySeen++ }
  const swaySentence = sway ? SW.sentences[swaySeen % SW.sentences.length] : ''
  if (sway) flow.splice(1, 0, swaySentence)
  const STG = depthParts().stage
  // v2.23: crush / former / married wording for the meeting-year window
  const byLabel = status === 'crush' || status === 'former' || status === 'married' ? status : null
  // v2.24: the window line and the 2〜3年目 hint follow the two people's fortune that year (進む・見直す・両方・穏やか)
  const tone = pairTone(a, b, status, year, meetingYear)
  const pairStageLine = d.stage && adultA && adultB ? (d.stage.kind === 'dating' ? fill(STG.toned.prefix.pair[d.stage.k === 1 ? 0 : 1], { k: d.stage.k }) + STG.toned.body[byLabel ?? 'partnered'][tone][d.stage.k === 1 ? 0 : 1] : (status === 'married' ? STG.pairMarried[d.stage.k % 2] : 'この年は、それぞれの暮らしや気持ちを見直し、関わり方を考えやすい時期です。').replace(/^結婚から\{k\}年がたつこの年は、/, 'この年は、')) : ''
  if (pairStageLine) flow.splice(sway ? 2 : 1, 0, pairStageLine)
  // v2.20: the 婚期 year inside the dating window is the year the pair decides either way (進むか、区切るか)
  // v2.21: the peak of the window (2–3 years after the meeting) is the year the pair decides either way
  const decisionYear = d.stage?.kind === 'dating' && (d.stage.k === 2 || d.stage.k === 3)
  // v2.21: 1年目 is about the meeting itself
  const firstYear = d.stage?.kind === 'dating' && d.stage.k === 1
  const advice = life?.reflection ?? (decisionYear ? (byLabel ? STG.toned.decisionBy[byLabel][tone] : STG.toned.decision[tone])[past ? 'reflection' : 'advice'] : firstYear ? (byLabel ? STG.pairFirstBy[byLabel] : STG.pairFirst)[past ? 'reflection' : 'advice'] : null) ?? (sway ? SW[past ? 'reflection' : 'advice'][swaySeen % 3] : null) ?? (past
    ? (apart ? A.reflection[d.theme === 'quiet' ? 'quiet' : d.theme === 'trust' ? 'trust' : 'move'][j] : Q.reflection[d.theme][j])
    : (apart && d.theme === 'quiet' ? A.advice.quiet[j] : apart && moving ? A.advice.move[j] : Q.advice[d.theme][j]))

  // 3b. theme line under the advice: rotated by how many earlier adult years had the same pair theme (range-independent)
  if (adultA && adultB) {
    const seen = themeSeen
    const lines: string[] | undefined = apart && d.theme !== 'friend'
      ? DP.themeApart[past ? 'reflection' : 'advice']
      : DP[past ? 'themeReflection' : 'themeAdvice'][d.theme]
    if (lines) adviceExtra = lines[seen % lines.length]
  }
  // 3c. each person's year in relationships (their own ten-god, first sentence of the individual area text)
  const eachLines: string[] = []
  const A2 = areaParts()
  for (const [ctx, sx, who, adult, k] of [[a, sa, 'あなた', adultA, i], [b, sb, '相手', adultB, (i + 1) % 3]] as const) {
    if (!adult) continue
    const god = sx.tenGod === '印綬' ? '正印' : sx.tenGod
    const first = A2.rel[god][k].split(/(?<=。)/)[0]
    // v2.11: each person's own nature first (the partner's line speaks of 「相手」), then how they meet people this year
    const own = personalLines(ctx, year)
    if (own) eachLines.push(tense((who === '相手' ? own.stem.replaceAll('あなた', '相手') : own.stem) + first))
    else eachLines.push(fill(DP.eachLine, { who, text: tense(first) }))
  }

  // 4. chapter texts
  const chapterTexts: string[] = []
  for (const [ctx, s, who] of [[a, sa, 'あなた'], [b, sb, '相手']] as const) {
    for (const c of s.chapterStarts) {
      if (c.kind === 'daiun' && c.pillar) { const ch = P.chapters.daiun[tenGod(ctx.natal.natal.day![0], c.pillar[0])]; chapterTexts.push(`${who}：${ch.title}。${ch.body}`) }
      else if (c.kind === 'mahadasha' && c.lord) { const ch = P.chapters.mahadasha[c.lord]; chapterTexts.push(`${who}：${ch.title}。${ch.body}`) }
    }
  }

  // 4b. depth: both 10-year flows, months inside the year for each person, continuity of the pair
  const decadeLines: string[] = []
  const infos = ([[a, 'あなた', adultA], [b, '相手', adultB]] as const).map(([ctx, who, adult]) => ({ who, info: adult ? decadeInfo(ctx, year, P.chapters.daiun) : null }))
  for (const [k, x] of infos.entries()) decadeLines.push(x.info ? fill(DP.decadeLine, { who: x.who, title: x.info.title, ordinal: x.info.ordinal }) : fill((k === 0 ? a : b).gender ? DP.decadeOneNoTime : DP.decadeOne, { who: x.who }))
  if (infos[0].info && infos[1].info) decadeLines.push(keepForTense((infos[0].info.group === infos[1].info.group ? DP.decadeSame : DP.decadeDifferent)[j], past))
  const decadeText = infos.some(x => x.info) ? tense(decadeLines.filter(l => !l.includes('読めるようになります')).join('')) + decadeLines.filter(l => l.includes('読めるようになります')).join('') : ''
  const timingLines: string[] = []
  const turns: number[] = []
  for (const [ctx, who, adult] of [[a, 'あなた', adultA], [b, '相手', adultB]] as const) {
    if (!adult) continue
    if (!ctx.vedic) { timingLines.push(fill(DP.timingNoTime, { who })); continue }
    const t = timingParagraph(ctx, decideYear(ctx, year), P.chapters)
    if (t.text) timingLines.push(fill(DP.timingLine, { who, text: tense(t.text) }))
    if (t.turnMonth) turns.push(t.turnMonth)
  }
  if (turns.length === 2 && Math.abs(turns[0] - turns[1]) <= 1) timingLines.push(tense(fill(DP.timingOverlap[j], { month: `${Math.min(...turns)}月` })))
  let continuityText = ''
  if (romantic(status) && adultA && adultB) {
    const cat = (t: PairTheme) => t === 'trust' ? 'trust' : t === 'quiet' ? 'quiet' : 'move'
    const prev = decidePairYear(a, b, status, year - 1, meetingYear).d.theme
    const key = `${cat(prev)}>${cat(d.theme)}`
    let seen = 0
    for (let y = Math.max(a.birthYear, b.birthYear) + 19; y < year; y++) {
      if (`${cat(decidePairYear(a, b, status, y - 1, meetingYear).d.theme)}>${cat(decidePairYear(a, b, status, y, meetingYear).d.theme)}` === key) seen++
    }
    const list: string[] = DP.continuity[key]
    continuityText = tense(meetingRomantic ? DP.meeting.continuity : keepForTense(list[seen % list.length], past))
    for (let y = year + 1; y <= Math.min(2100, year + 12); y++) {
      if (cat(decidePairYear(a, b, status, y, meetingYear).d.theme) !== 'quiet') {
        continuityText += fill(year < nowYear ? (y < nowYear ? DP.next.past : DP.next.fromPast) : DP.next.future, { year: y })
        break
      }
    }
  }

  // 5. basis
  const QE = Q.evidence
  const basis: string[] = [QE.color]
  const evidence: ReportCardEvidence[] = [
    { family: 'timeline-v3-couple', system: '四柱推命', detail: `あなた：年干${sa.pillar[0]}＝${sa.tenGod}` },
    { family: 'timeline-v3-couple', system: '四柱推命', detail: `相手：年干${sb.pillar[0]}＝${sb.tenGod}` },
  ]
  if (romantic(status)) {
    for (const [ctx, s, who, tag] of [[a, sa, 'あなた', 'A'], [b, sb, '相手', 'B']] as const) {
      for (const h of s.relationship.hits) {
        if (h.id === 'TL3-R1') {
          const p = s.relationship.r1Periods
          basis.push(fill(QE[ctx.gender === 'female' ? 'R1_female' : 'R1_male'], { who, start: formatMonth(p[0].start), end: formatMonth(p.at(-1)!.end) }))
        } else basis.push(fill(QE[h.id.replace('TL3-', '')], { who }))
        evidence.push({ family: 'timeline-v3-couple', system: h.system, detail: `${tag}:${h.id}：${h.detail}` })
      }
    }
    if (!b.vedic) basis.push(QE.noTime)
  } else basis.push(QE.friendNote)
  if (life) evidence.push(...life.evidence)
  if (lifeText) basis.push(eventTimeline().evidence)
  for (const [ctx, tag, adult] of [[a, 'A', adultA], [b, 'B', adultB]] as const) if (adult) for (const e of personalLines(ctx, year)?.evidence ?? []) evidence.push({ ...e, family: 'timeline-v3-couple', detail: `${tag}:${e.detail}` })
  for (const [s, tag] of [[sa, 'A'], [sb, 'B']] as const) for (const c of s.chapterStarts) evidence.push({ family: 'timeline-v3-couple', system: c.kind === 'daiun' ? '四柱推命' : 'インド占星術', detail: `${tag}:${c.label}開始（${formatMonth(c.start)}）` })
  if (decadeText || timingLines.length || continuityText) basis.push(DP.evidence)
  if (sway) basis.push(SW.evidence)
  if (pairStageLine) basis.push(STG.evidence)
  basis.push(fill(P.evidencePlain.period, { year }), P.evidencePlain.note)

  const H = Q.headings
  const sections: ReportSection[] = [
    { heading: H.flow, body: (past ? pastizeAll(flow.join('')) : flow.join('')) + meetingReading, evidence: [], termGloss: [] },
    { heading: H.manifest, body: past ? pastizeAll(manifestText + milestones.join('')) : manifestText + milestones.join(''), evidence: [], termGloss: [] },
    ...[
      { heading: eventTimeline().heading, body: lifeText },
      { heading: DP.headings.each, body: eachLines.join('\n\n') },
      { heading: DP.headings.decade, body: decadeText },
      { heading: DP.headings.timing, body: timingLines.join('\n\n') },
      { heading: DP.headings.continuity, body: continuityText },
    ].filter(x => x.body).map(x => ({ ...x, evidence: [], termGloss: [] })),
    { heading: apart ? (past ? H.adviceApartPast : H.adviceApart) : (past ? H.advicePast : H.advice), body: meetingRomantic ? DP.meeting[past ? 'reflection' : 'advice'].join('') : advice + adviceExtra, evidence: [], termGloss: [] },
    ...(chapterTexts.length ? [{ heading: H.chapter, body: chapterTexts.join(''), evidence: [], termGloss: [] }] : []),
    { heading: H.basis, body: basis.join('\n\n'), evidence, termGloss: [] },
  ]

  // tags
  const T = Q.tags
  const tags: TimelineTag[] = []
  const add = (id: string, label: string, actor: TimelineTag['actor'], rules: string[], text: string) => tags.push(candidate(id, label, actor, year, rules, [TIMELINE_V3_VERSION], text))
  if (d.meeting) tags.push({ id: 'met-year', label: T.meeting, source: 'user_reported', actor: 'pair', targetYear: year, ruleIds: ['MEETING-INPUT-1'], evidenceIds: ['user:meeting-year'], evidenceText: Q.meeting, state: 'reported' })
  if (sway) add('pair-sway', SW.tag, 'pair', ['PAIR-MOVING'], swaySentence)
  if (pairStageLine) add('pair-stage', d.stage!.kind === 'dating' && d.stage!.k === 1 ? STG.tags.pairStart : d.stage!.kind === 'dating' && status === 'married' ? STG.tags.pairMarried : d.stage!.kind === 'dating' && d.stage!.k <= 3 ? STG.tags.pairPeak : STG.tags[d.stage!.kind], 'pair', ['PAIR-STAGE'], pairStageLine)
  if (!meetingRomantic && d.theme === 'both') add('pair-move', T.both, 'pair', ['A:REL>=2', 'B:REL>=2'], lead)
  if (!meetingRomantic && d.theme === 'self') add('pair-move', T.one, 'A', ['A:REL>=2'], lead)
  if (!meetingRomantic && d.theme === 'partner') add('pair-move', T.one, 'B', ['B:REL>=2'], lead)
  if (!meetingRomantic && d.theme === 'trust') add('pair-trust', T.trust, 'pair', ['TRUST'], lead)
  if (d.marriage) add('pair-marriage', T.marriage, 'pair', ['PAIR-MARRIAGE-V3'], P.milestones.marriage[j])
  if (d.chapterSelf || d.chapterPartner) add('pair-life-turn', T.lifeTurn, d.chapterSelf && d.chapterPartner ? 'pair' : d.chapterSelf ? 'A' : 'B', ['CHAPTER'], d.chapterSelf ? Q.chapter.self : Q.chapter.partner)

  // ---- simple paragraph (one paragraph per year) built from the same pieces
  const firstOf = (t: string) => t.split(/(?<=。)/)[0] ?? ''
  const sp: string[] = []
  // 1年目: the meeting line opens the paragraph instead of the theme lead (two 「この年は」 openings read oddly)
  if (!(firstYear && pairStageLine && !sway)) sp.push(tense(d.meeting ? Q.meeting : lead))
  if (sway) sp.push(tense(swaySentence))
  if (pairStageLine) sp.push(tense(pairStageLine))
  if (lifeText) sp.push(...lifeText.split(/(?<=。)/).filter(Boolean))
  // a 揺れやすい年 already reads both ways: no one-direction quality sentence after it
  // the toned window line already says how the year moves: no second quality sentence after it (v2.24)
  const qualIdx = !d.meeting && quality && !sway && d.stage?.kind !== 'dating' ? sp.length : -1
  if (qualIdx >= 0) sp.push(tense(Q.qualitySentence[quality!][j]))
  const colorIdx = sp.length
  sp.push(tense(color))
  const personalA = adultA ? personalLines(a, year) : null, personalB = adultB ? personalLines(b, year) : null
  if (personalA) sp.push(tense(personalA.stem))
  if (personalB) sp.push(tense(personalB.stem.replaceAll('あなた', '相手')))
  const manIdx = sp.length
  // an entered event already says what happened this year: no 「〜形で表れることがあります」
  if (!life?.inYear) sp.push(...manifest.slice(0, personalA && personalB ? 1 : 2))
  if (d.marriage) sp.push(firstOf(P.milestones.marriage[j]))
  if (d.chapterSelf) sp.push(past ? pastizeAll(Q.chapter.self) : Q.chapter.self)
  if (d.chapterPartner) sp.push(past ? pastizeAll(Q.chapter.partner) : Q.chapter.partner)
  if (turns.length === 2 && Math.abs(turns[0] - turns[1]) <= 1) sp.push(tense(fill(DP.timingOverlap[j], { month: `${Math.min(...turns)}月` })))
  sp.push(meetingRomantic ? DP.meeting[past ? 'reflection' : 'advice'][0] : advice)
  let seenPossibility = false
  const fixedSp = sp.filter(Boolean).map(x => {
    if (!/ことがあります。$|こともあります。$/.test(x)) return x
    const y = seenPossibility ? x.replace(/ことがあります。$/, 'こともあります。') : x.replace(/こともあります。$/, 'ことがあります。')
    seenPossibility = true
    return y
  })
  const plain = (t: string) => (depthParts().simple.plain as [string, string][]).reduce((x, [p1, p2]) => x.split(p1).join(p2), t)
  let simple = plain(fixedSp.join(''))
  // with both natures in, the second possibility was left out; short years take it back
  if ([...simple].length < 190 && personalA && personalB && manifest.length > 1 && !life?.inYear) {
    const k = manIdx
    if (fixedSp[k]) simple = plain([...fixedSp.slice(0, k + 1), manifest[1].replace(/ことがあります。$/, 'こともあります。'), ...fixedSp.slice(k + 1)].join(''))
  }
  // long years (e.g. a 揺れやすい年 with a 年表 line): the possibility goes first, then the two-themes line
  if ([...simple].length > 300) {
    const drop = new Set<number>()
    // v2.20: together, the possibility comes from the person's own timeline and is kept; the two-themes line and the
    // quality line go first
    const order = together ? [colorIdx, qualIdx, manIdx] : [manIdx, colorIdx]
    for (const k of order) {
      if (k < 0 || !fixedSp[k] || (k === manIdx && life?.inYear)) continue
      if ([...plain(fixedSp.filter((_, x) => !drop.has(x)).join(''))].length <= 300) break
      drop.add(k)
    }
    simple = plain(fixedSp.filter((_, k) => !drop.has(k)).join(''))
  }
  // short years: add how each of the two meets people this year
  if ([...simple].length < 190 && eachLines.length && !personalA && !personalB) simple = plain([...fixedSp.slice(0, -1), ...eachLines.map(x => x.replace(/^(あなた|相手)：/, (_m, w) => `${w}は、`)), fixedSp.at(-1)!].join(''))

  const card = {
    id: `couple-v3-${year}`, kind: 'timing', scope: 'couple', tab: 'timing',
    title, summary: past ? pastize(lead) : lead,
    tags: ['ふたりの時系列', ...new Set(tags.map(t => t.label))], timelineTags: tags,
    period: { label: `${year}年` }, sections,
    pages: sections.map((s, k) => ({ role: k === 0 ? 'opening' as const : 'core' as const, label: s.heading, text: s.body })),
    evidence, metadataRefs: [TIMELINE_V3_VERSION, P.version, Q.version, depthParts().version], generator: 'deterministic',
    ...({ coupleV3Calculation: { version: TIMELINE_V3_VERSION, status, decision: { ...d, quality } } } as object),
  } as ReportCard
  // simple style: the title is the pair theme alone (no ten-god opening)
  // quiet years take their title from your ten-god, so calm years do not all read the same
  const godA = sa.tenGod === '印綬' ? '正印' : sa.tenGod
  const simpleTitle = sway ? SW.titles[swaySeen % SW.titles.length] : meetingRomantic ? depthParts().pair.meeting.tails[j] : d.theme === 'quiet' && apart ? tailSet[j] : d.theme === 'quiet' && romantic(status) ? depthParts().pair.quietTitles[godA] : tailSet[j]
  return style === 'simple' ? toSimpleCard(card, past ? pastizeAll(simple) : simple, simpleTitle) : card
}

/** Same response shape as coupleAllYears/snapshot.ts#snapshotTimeline (entries without `reading`). */
export function buildCoupleTimelineV3(input: CoupleV3Input) {
  const birthYearA = Number(input.self.birthDate?.slice(0, 4)), birthYearB = Number(input.partner.birthDate?.slice(0, 4))
  const layout = timelineLayout({ meetingYear: input.meetingYear, birthYearA, birthYearB, referenceYear: input.referenceYear, endYear: input.endYear })
  const [a, b] = pairContexts(input.self, input.partner, pairStatus(input.relationshipLabel), layout.meetingYear ?? null)
  if (!a || !b) return { ...layout, status: 'invalid_context', entries: [], engineVersion: TIMELINE_V3_VERSION, relationshipStatus: pairStatus(input.relationshipLabel) }
  const status = pairStatus(input.relationshipLabel)
  const entries = layout.years.map(year => {
    const label = year === layout.meetingYear ? '出会った年' : null
    if (year < 1952 || year > 2100) return { year, label, contentStatus: 'unsupported_year' as const, card: null }
    return { year, label, contentStatus: 'ready' as const, card: composePairYear(a, b, status, year, layout.meetingYear, input.referenceYear, input.style ?? 'simple') }
  })
  return { ...layout, status: entries.some(e => e.contentStatus !== 'ready') ? 'partial' : layout.status, entries, engineVersion: TIMELINE_V3_VERSION, relationshipStatus: status }
}
