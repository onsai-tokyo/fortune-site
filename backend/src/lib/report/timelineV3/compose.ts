/**
 * Timeline v3 — composes one ReportCard per calendar year from signals + manuscript parts.
 * Output must be deterministic for (input, year, nowYear). Never depends on the display range.
 */
import { readFileSync } from 'node:fs'
import type { ReportCard, ReportCardEvidence, ReportSection } from '../../reportCards.js'
import { withCardProvenance } from '../provenance.js'
import { glossFor } from '../jargon.js'
import { candidate, type TimelineTag } from '../timelineTags.js'
import './couple.js' // v2.24: registers the two-person tone resolver used by timelineContext
import { decideYear, timelineContext, tenGod, branchRelations, movementQuality, wordingQuality, stageTone, type StageTone, type TimelineContext, type TimelineV3Input, type YearDecision } from './signals.js'
import { formatMonth } from './vedic.js'
import { areaParts, areaTexts, palaceParagraph } from './areas.js'
import { continuityParagraph, decadeParagraph, depthParts, shortTitle, timingParagraph, toneSentence } from './depth.js'
import { TIMELINE_V3_VERSION } from './version.js'
import { personalLines, personalParts } from './personal.js'
import { lifeLines, eventTimeline } from './lifeline.js'

type Parts = typeof import('./data/parts.json')
let PARTS: any
export function parts(): any {
  PARTS ??= JSON.parse(readFileSync(new URL('./data/parts.json', import.meta.url), 'utf8'))
  return PARTS
}

const pick3 = (year: number) => Math.floor(year / 10) % 3   // lead / quiet headline variant: differs for same ten-god 10 years apart
const tail3 = (year: number) => ((year % 3) + 3) % 3         // tail variant
/**
 * Six-slot possibility lists: slots 0/3 = beginning or moving forward, 1/4 = deepening or reviewing, 2/5 = pause or closure.
 * active years take 2 sentences in different directions, major years take one of each direction.
 * Adjacent years get different selections; the same ten-god year (10 years later) also differs.
 */
export function pickPossibilities(list: string[], year: number, strength: 'active' | 'major', order?: number[], setSeed?: number): string[] {
  const k = ((year % 6) + 6) % 6
  // lists hold 3 directions × n sets (6 = 2 sets, 9 = 3 sets). With a setSeed (e.g. how many times the same theme came
  // before), the n-th sentence comes from set (setSeed + n), so consecutive occurrences never share a sentence.
  const sets = Math.max(1, Math.floor(list.length / 3))
  let pick = 0
  const slot = (dir: number, set: number) => list[((setSeed === undefined ? set : setSeed + pick++) % sets) * 3 + dir]
  if (!order) {
    // default rotation (no movement quality): directions rotate with the year
    if (strength === 'major') return [0, 1, 2].map(dir => slot((dir + k) % 3, k + dir))
    const a = k % 3, b = (a + 1 + (Math.floor(year / 6) % 2)) % 3
    return [slot(a, Math.floor(k / 3)), slot(b, Math.floor(k / 3) + 1)]
  }
  // movement quality given: the leading direction always comes first. year % 8 chooses the set for each sentence
  // (and, for active years, which secondary direction), so relationship years up to 7 years apart never repeat.
  const v = ((year % 8) + 8) % 8, bit = (n: number) => (v >> n) & 1
  if (strength === 'major') return [slot(order[0], bit(0)), slot(order[1], bit(1)), slot(order[2], bit(2))]
  return [slot(order[0], bit(0)), slot(bit(2) ? order[2] : order[1], bit(1))]
}
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))

/** First listed possibility says "ことがあります", later ones "こともあります". */
function possibilityList(sentences: string[]): string {
  return sentences.map((s, i) => i === 0 ? s.replace(/こともあります。$/, 'ことがあります。') : s.replace(/ことがあります。$/, 'こともあります。')).join('')
}
const pastize = (s: string) => s.replace(/時期です。$/, '時期でした。').replace(/年です。$/, '年でした。')
/** Past years: every sentence of a descriptive paragraph moves to the past tense (です→でした、ます→ました). */
export const pastizeAll = (text: string) => text.replace(/ことがあり(?:ます|ました)。/g, 'ことがあったかもしれません。').replace(/こともあり(?:ます|ました)。/g, 'こともあったかもしれません。').split(/(?<=。)/).map(x => x.replace(/です。$/, 'でした。').replace(/ます。$/, 'ました。')).join('')

/** Self timeline speaks about the individual; pair wording is kept in relLines. */
export const selfVoice = (text: string) => text.replaceAll('二人の将来', '自分の将来').replaceAll('二人の約束', '人との約束').replaceAll('二人の関係', '大切な人との関わり').replaceAll('二人で', '大切な人と').replaceAll('二人の', '身近な人との')

function careerKey(ctx: TimelineContext): 'work' | 'study' | 'other' {
  const w = ctx.input.workContext
  return w === 'employed' || w === 'independent' ? 'work' : w === 'student' ? 'study' : 'other'
}
function careerMilestoneKey(ctx: TimelineContext): 'employed' | 'independent' | 'student' | 'other' {
  const w = ctx.input.workContext
  return w === 'employed' || w === 'independent' || w === 'student' ? w : 'other'
}

export interface ComposedYear {
  card: ReportCard; decision: YearDecision; simple: string; simpleTitle: string
  /** v2.20: how the year shows in relationships (the lines the simple paragraph uses); the couple timeline reuses them */
  relLines: string[]
}

/** v2.24: the two people's tone for a window year (computed in timelineContext from partnerBirth), else null. */
function partnerWindowTone(ctx: TimelineContext, year: number): StageTone | null {
  return ctx.input.partnerTones?.[String(year)] ?? null
}

export function composeYear(ctx: TimelineContext, year: number, nowYear: number): ComposedYear {
  const P = parts()
  const d = decideYear(ctx, year)
  const s = d.signals
  const g = P.tenGods[s.tenGod]
  const i = pick3(year), j = tail3(year)
  const youth = d.ageBand !== 'adult' && (d.theme === 'relationship' || d.theme === 'trust')
  const status = ctx.input.relationshipStatus ?? 'unknown'
  const ck = careerKey(ctx)
  const past = year < nowYear
  // v2.13: the person's own 年表 (wording only; never changes the judgement)
  const life = lifeLines(ctx, d, year, nowYear)
  // the current status says nothing about past years: past hint years use the neutral wording
  const partneredHint = !past && (status === 'partnered' || status === 'married')
  const quality = d.theme === 'relationship' && !youth ? wordingQuality(d, year < nowYear) : null
  const Qy = quality ? P.qualities[quality] : null

  // ---- headline
  let title: string
  if (youth) title = `${g.leads[i]}、${P.tails.youth[d.strength === 'major' ? 'major' : 'active'][j]}`
  else if (d.theme === 'trust') title = `${g.leads[i]}、${P.tails.trust.major[j]}`
  else if (d.theme === 'relationship') title = `${g.leads[i]}、${(Qy ? Qy.tails : P.tails.relationship)[d.strength === 'major' ? 'major' : 'active'][j]}`
  else if (d.theme === 'career') title = `${g.leads[i]}、${P.tails.career[ck][j]}`
  else if (d.theme === 'move') title = `${g.leads[i]}、${P.tails.move[j]}`
  else if (d.theme === 'hint') title = `${g.leads[i]}、${P.tails[partneredHint ? 'hintPartnered' : 'hint'][j]}`
  else title = g.quietHeadlines[i]

  // ---- section 1: flow
  let lead: string
  if (youth) lead = P.leads.youth[d.strength === 'major' ? 'major' : 'active'][j]
  else if (d.theme === 'trust') lead = P.leads.trust.major[j]
  else if (d.theme === 'relationship') lead = P.leads.relationship[d.strength === 'major' ? 'major' : 'active'][j]
  else if (d.theme === 'career') lead = P.leads.career[ck][j]
  else if (d.theme === 'move') lead = P.leads.move[j]
  else if (d.theme === 'hint') lead = P.leads[partneredHint ? 'hintPartnered' : 'hint'][j]
  else lead = g.light[i]
  if (past) lead = pastize(lead)
  const flowParts = [lead]
  if (Qy) flowParts.push(Qy.sentence[j])
  if (d.theme === 'quiet') { /* light already used */ } else if (d.theme === 'hint') flowParts.push(g.light[i])
  else flowParts.push(g.undertone[i])
  const partnerNote = ctx.gender ? g.partnerNote?.[ctx.gender] : undefined
  if (partnerNote && d.ageBand === 'adult') flowParts.push(partnerNote)
  // adults: how the year's elements meet the chart (tailwind / mixed / headwind)
  const tone = d.ageBand === 'adult' ? toneSentence(ctx, year, s.pillar) : null
  if (tone) flowParts.push(tone.text)
  const flow = past ? pastizeAll(flowParts.join('')) : flowParts.join('')

  // ---- section 2: manifestations + milestones
  const manifest: string[] = []
  if (youth) {
    manifest.push(possibilityList(pickPossibilities(P.manifestations.youth[d.ageBand], year, d.strength === 'major' ? 'major' : 'active')))
  } else if (d.theme === 'trust' || d.theme === 'relationship') {
    // past years: the current status says nothing about who the person was with then, so the neutral list is used
    manifest.push(possibilityList(pickPossibilities(P.manifestations[d.theme][past ? 'unknown' : status], year, d.strength === 'major' ? 'major' : 'active', Qy?.order)))
  }
  const marriageNow = d.marriage && !past
  if (marriageNow) manifest.push(P.milestones.marriage[j])
  if (d.career) manifest.push(P.milestones.career[careerMilestoneKey(ctx)][j])
  if (d.move) manifest.push(P.milestones.move[j])
  // Non-relationship years: concrete milestones first, then the ten-god's shadow side introduced with 「一方で、」.
  if (!(youth || d.theme === 'trust' || d.theme === 'relationship')) manifest.push(P.shadowLead + g.shadow[i])
  if (d.lifeTurn) manifest.push(past ? pastizeAll(P.milestones.lifeTurn[d.lifeTurn]) : P.milestones.lifeTurn[d.lifeTurn])

  // ---- section 3: advice
  // Past years get a reflection question instead of forward-looking advice.
  const baseAdvice0 = past ? (d.theme === 'trust' && !youth ? P.trustReflection[i] : g.reflection[i]) : (d.theme === 'trust' && !youth ? P.trustAdvice[i] : g.advice[i])
  // a past year with an entered event asks about that event
  const baseAdvice = life?.reflection ?? baseAdvice0
  // adults: one more line tied to the year's theme (advice from now on, a second reflection question for past years).
  // The trust theme already uses trust-specific lines above, so it takes the next variant to avoid restating them.
  const themeLines = depthParts()[past ? 'themeReflection' : 'themeAdvice'][d.theme]
  // rotate by how many earlier adult years had the same theme (range-independent), so neighbouring same-theme years differ
  let themeSeen = 0
  if (d.ageBand === 'adult') for (let y = ctx.birthYear + 18; y < year; y++) if (decideYear(ctx, y).theme === d.theme) themeSeen++
  const advice = baseAdvice + (d.ageBand === 'adult' && themeLines ? themeLines[(themeSeen + (d.theme === 'trust' ? 1 : 0)) % themeLines.length] : '')

  // ---- depth paragraphs (adults only): 10-year flow, months inside the year, continuity with neighbouring years
  const adult = d.ageBand === 'adult'
  const decade = adult ? decadeParagraph(ctx, d, P.chapters.daiun, past) : null
  const timing = adult ? timingParagraph(ctx, d, P.chapters) : null
  const continuity = adult ? continuityParagraph(ctx, d, nowYear) : null
  const palace = adult ? palaceParagraph(ctx, year, past) : null
  // v2.11: how the year meets the person's own nature (day stem × year, month structure × year)
  const personal = adult ? personalLines(ctx, year) : null
  const tense = (t: string) => past ? pastizeAll(t) : t
  // v2.16 life-stage line (age / years of the relationship / years of marriage)
  const ST = depthParts().stage
  // past years: the current status says nothing about that time, so the age line uses the neutral (single) wording;
  // an age line is left out when the 年表 already gives a "years since" line
  let ageLineSeen = 0
  if (d.stage?.kind === 'age') for (let y = ctx.birthYear + 26; y < year; y++) { const x = decideYear(ctx, y); if (x.stage?.kind === 'age' && (x.stage.k === 26 || ['relationship', 'trust', 'hint'].includes(x.theme))) ageLineSeen++ }
  // the age window lasts 9 years: its line is shown on the first year and on relationship / trust / hint years only,
  // so neighbouring years do not repeat it (the window still counts in the judgement every year)
  const ageLineYear = d.stage?.kind === 'age' && (d.stage.k === 26 || ['relationship', 'trust', 'hint'].includes(d.theme))
  const stageLine = d.stage && d.ageBand === 'adult' && (d.stage.kind !== 'age' || ageLineYear) && !(d.stage.kind === 'age' && life?.anchor) ? tense(d.stage.kind === 'age'
    ? ST.age[past ? 'single' : status === 'married' ? 'married' : status === 'partnered' ? 'partnered' : 'single'][ageLineSeen % 3]
    : d.stage.kind === 'dating'
      // v2.24: the dating-window line follows the year's fortune (進む・見直す・両方・穏やか) instead of a fixed both-ways sentence
      ? (() => { const n = d.stage!.k === 1 ? 0 : 1
          // with the registered partner's birth data, the two people's fortune decides the tone (same as ふたりの時系列)
          const pairT = d.stage!.via ? partnerWindowTone(ctx, year) : null
          // the person's own 婚期 year never reads as only 見直す / 穏やか
          const tone = pairT === null ? stageTone(d, past) : d.marriage && pairT === 'review' ? 'both' : d.marriage && pairT === 'steady' ? 'forward' : pairT
          return ST.selfDating[tone][n] })()
      : ST.selfMarried[d.stage.k % 2]) : ''
  // Keep the original anchor selection; the stage now describes the individual without relationship duration.
  const anchorText = life?.anchor && !(d.stage && d.stage.kind !== 'age') ? tense(life.anchor) : null
  const lifeText = life ? [life.inYear, life.reading, anchorText].filter(Boolean).join('') : ''
  const turnSentence = (m?: number) => m ? fill(depthParts().turn[past ? 'past' : 'future'][(year + m) % 3], { month: `${m}月` }) : ''

  // ---- section 4: basis (plain) + evidence (technical)
  const E = P.evidencePlain
  const basis: string[] = [E.color]
  const evidence: ReportCardEvidence[] = [{ family: 'timeline-v3', system: '四柱推命', detail: `年干${s.pillar[0]}＝${s.tenGod}（年柱${s.pillar}）` }]
  const terms = new Set<string>([s.tenGod === '正印' ? '印綬' : s.tenGod])
  const periodText = s.relationship.r1Periods.map(p => `${formatMonth(p.start)}〜${formatMonth(p.end)}`)
  for (const h of s.relationship.hits) {
    if (h.id === 'TL3-R1') basis.push(fill(E[ctx.gender === 'female' ? 'R1_female' : 'R1_male'], { start: periodText[0]?.split('〜')[0] ?? '', end: periodText.at(-1)?.split('〜')[1] ?? '' }))
    if (h.id === 'TL3-R2') basis.push(E.R2)
    if (h.id === 'TL3-R3') basis.push(E.R3)
    if (h.id === 'TL3-R4') basis.push(E.R4)
    if (h.id === 'TL3-R5') basis.push(E.R5)
    evidence.push({ family: 'timeline-v3', system: h.system, detail: `${h.id}：${h.detail}` })
    h.terms.forEach(t => terms.add(t))
  }
  if (d.marriage && s.relationship.dt7) { basis.push(E.dt7); evidence.push({ family: 'timeline-v3', system: 'インド占星術', detail: 'TL3-DT7：木星と土星のダブルトランジット：7室' }) }
  if (d.career) { basis.push(fill(E.career, { count: s.career.hits.length })); for (const h of s.career.hits) { evidence.push({ family: 'timeline-v3', system: h.system, detail: `${h.id}：${h.detail}` }); h.terms.forEach(t => terms.add(t)) } }
  if (d.move) { basis.push(fill(E.move, { count: s.move.hits.length })); for (const h of s.move.hits) { evidence.push({ family: 'timeline-v3', system: h.system, detail: `${h.id}：${h.detail}` }); h.terms.forEach(t => terms.add(t)) } }
  for (const c of s.chapterStarts) {
    basis.push(fill(c.kind === 'daiun' ? E.chapterDaiun : E.chapterMahadasha, { month: formatMonth(c.start) }))
    evidence.push({ family: 'timeline-v3', system: c.kind === 'daiun' ? '四柱推命' : 'インド占星術', detail: `${c.label}開始（${formatMonth(c.start)}）` })
    if (c.kind === 'daiun') terms.add('大運')
  }
  // adults: one plain summary line replaces the per-paragraph basis lines (technical details stay in evidence)
  for (const x of [decade, timing, palace]) if (x) { evidence.push(...x.evidence); x.terms.forEach(t => terms.add(t)) }
  if (personal) evidence.push(...personal.evidence)
  if (life) evidence.push(...life.evidence)
  if (adult) basis[0] = depthParts().evidence[ctx.vedic ? 'combined' : 'combinedNoTime']
  if (tone) { basis.push(depthParts().evidence.tone); evidence.push({ family: 'timeline-v3', system: '四柱推命', detail: `強弱：${tone.detail}` }) }
  if (personal) basis.push(personalParts().evidence)
  if (lifeText) basis.push(eventTimeline().evidence)
  if (stageLine) { basis.push(ST.evidence); evidence.push({ family: 'timeline-v3', system: '四柱推命', detail: `時期：${d.stage!.kind}（${d.stage!.kind === 'age' ? `${d.stage!.k}歳` : `${d.stage!.since}年から${d.stage!.k}年目`}）` }) }
  if (continuity) basis.push(depthParts().evidence.continuity)
  basis.push(fill(E.period, { year }), E.note)
  const termGloss = [...terms].map(t => glossFor(t)).filter((x): x is NonNullable<typeof x> => !!x).map(x => ({ term: x.term, plain: x.plain, system: x.system }))

  // ---- section 5 (only in chapter-start years): chapter
  const chapterTexts: string[] = []
  // a chapter that already ended before this year's display reference is told in the past tense
  const nowStart = Date.UTC(nowYear, 0, 1, -9)
  for (const c of s.chapterStarts) {
    if (c.kind === 'daiun' && c.pillar) {
      const dg = tenGod(ctx.natal.natal.day![0], c.pillar[0])
      const ch = P.chapters.daiun[dg]
      const parts: string[] = [`${ch.title}。${ch.body}`]
      if (c.pillar === ctx.natal.natal.day) parts.push(P.chapters.daiunSpecial.sameAsDay)
      else if (branchRelations(ctx.natal.natal.day![1], c.pillar[1]).includes('冲')) parts.push(P.chapters.daiunSpecial.clashDay)
      const end = ctx.natal.decades.find(x => x.start === c.start)?.end ?? Infinity
      chapterTexts.push(end < nowStart ? pastizeAll(parts.join('')) : parts.join(''))
    } else if (c.kind === 'mahadasha' && c.lord) {
      const ch = P.chapters.mahadasha[c.lord]
      const end = Math.max(...(ctx.vedic?.dashas.filter(x => x.md === c.lord && x.start >= c.start && x.start < c.start + 21 * 365.25 * 86_400_000).map(x => x.end) ?? [Infinity]))
      const text = `${ch.title}。${ch.body}`
      chapterTexts.push(end < nowStart ? pastizeAll(text) : text)
    }
  }

  // ---- per-area paragraphs (adults only)
  const areas = adult ? areaTexts(ctx, d, i, past) : null

  const H = P.sectionHeadings
  const DH = depthParts().headings
  const sections: ReportSection[] = [
    { heading: H.flow, body: flow, evidence: [], termGloss: [] },
    { heading: H.manifest, body: past ? pastizeAll(manifest.join('')) : manifest.join(''), evidence: [], termGloss: [] },
    ...(stageLine ? [{ heading: ST.heading, body: stageLine, evidence: [], termGloss: [] }] : []),
    ...(lifeText ? [{ heading: eventTimeline().heading, body: lifeText, evidence: [], termGloss: [] }] : []),
    ...(personal ? [{ heading: personalParts().heading, body: tense(personal.stem + (personal.structure ?? '')), evidence: [], termGloss: [] }] : []),
    ...[
      { heading: DH.decade, body: decade ? tense(decade.text) : '' },
      { heading: DH.timing, body: timing ? tense(timing.text) + (timing.note ?? '') + turnSentence(timing.turnMonth) : '' },
      { heading: areaParts().headings.palace, body: palace ? tense(palace.text) : '' },
    ].filter(x => x.body).map(x => ({ ...x, evidence: [], termGloss: [] })),
    ...(areas ? [
      { heading: H.areaRelationship, body: areas.relationship },
      { heading: H.areaCareer, body: areas.career },
      { heading: H.areaLife, body: areas.life },
    ].filter(x => x.body).map(x => ({ ...x, evidence: [], termGloss: [] })) : []),
    ...(continuity ? [{ heading: DH.continuity, body: tense(continuity.transition) + continuity.next, evidence: [], termGloss: [] }] : []),
    { heading: past ? H.advicePast : H.advice, body: advice, evidence: [], termGloss: [] },
    ...(chapterTexts.length ? [{ heading: H.chapter, body: chapterTexts.join(''), evidence: [], termGloss: [] }] : []),
    { heading: H.basis, body: basis.join('\n\n'), evidence, termGloss },
  ]

  // ---- tags
  const T = P.tags
  const tags: TimelineTag[] = []
  const add = (id: string, label: string, ruleIds: string[], text: string, period?: { start: string; endExclusive: string }) => {
    const t = candidate(id, label, 'self', year, ruleIds, [TIMELINE_V3_VERSION], text); if (period) t.period = period; tags.push(t)
  }
  const r1 = s.relationship.r1Periods[0]
  const r1Period = r1 ? { start: new Date(r1.start + 9 * 3600_000).toISOString().replace('Z', '+09:00'), endExclusive: new Date(s.relationship.r1Periods.at(-1)!.end + 9 * 3600_000).toISOString().replace('Z', '+09:00') } : undefined
  const relIds = s.relationship.hits.map(h => h.id)
  if (youth) add('tl3-youth', T.youth, relIds, lead, r1Period)
  else if (d.theme === 'trust') add('tl3-trust', T.trust, relIds, lead, r1Period)
  else if (d.theme === 'relationship') add('tl3-relationship', T.relationship, relIds, lead, r1Period)
  if (marriageNow) add('tl3-marriage', T.marriage, [...relIds, ...(s.relationship.dt7 ? ['TL3-DT7'] : [])], P.milestones.marriage[j], r1Period)
  if (d.career) add('tl3-career', ck === 'work' ? T.careerWork : ck === 'study' ? T.careerStudy : T.careerOther, s.career.hits.map(h => h.id), P.milestones.career[careerMilestoneKey(ctx)][j])
  if (d.move) add('tl3-move', T.move, s.move.hits.map(h => h.id), P.milestones.move[j])
  if (stageLine) add('tl3-stage', d.stage!.kind === 'dating' ? '#関わり方を考える時期' : ST.tags[d.stage!.kind], ['TL3-STAGE'], stageLine)
  if (d.lifeTurn) add('tl3-life-turn', T.lifeTurn, d.lifeTurn === 'chapter' ? s.chapterStarts.map(c => c.label) : ['TL3-CONVERGENCE'], P.milestones.lifeTurn[d.lifeTurn])

  const card = withCardProvenance({
    id: `turning-year-${year}`, kind: 'timing', scope: 'self', tab: 'timing',
    title, summary: lead,
    tags: ['時期', ...new Set(tags.map(t => t.label))], timelineTags: tags,
    period: { label: `${year}年（立春から翌年の立春まで）` },
    sections,
    pages: sections.map((x, k) => ({ role: k === 0 ? 'opening' as const : 'core' as const, label: x.heading, text: x.body })),
    evidence,
    metadataRefs: [TIMELINE_V3_VERSION, P.version, depthParts().version, areaParts().version],
    ...({ timelineV3Calculation: { version: TIMELINE_V3_VERSION, partsVersion: P.version, input: ctx.input, nowYear,
      decision: { theme: d.theme, quality, strength: d.strength, career: d.career, move: d.move, lifeTurn: d.lifeTurn, marriage: d.marriage, ageBand: d.ageBand,
        relationshipScore: s.relationship.score, careerScore: s.career.score, moveScore: s.move.score, hits: [...s.relationship.hits, ...s.career.hits, ...s.move.hits].map(h => h.id) } } } as object),
  } as ReportCard, 'deterministic')
  // ---- simple paragraph (one paragraph per year, about 200-300 characters) built from the same pieces
  const SP = depthParts().simple
  const firstOf = (t: string) => t.split(/(?<=。)/)[0] ?? ''
  const sp: string[] = []
  let areaIdx = -1
  const relYear = youth || d.theme === 'trust' || d.theme === 'relationship'
  sp.push(tense(lead))
  // a major year reads both ways: say so in the paragraph too (始まり・深まり と 区切り が重なりうる)
  // (a dating-window year: the toned window line already reads both ways, v2.24)
  if (quality === 'mixed' && d.strength === 'major' && Qy && !(stageLine && d.stage?.kind === 'dating')) sp.push(tense(Qy.sentence[j]))
  if (lifeText) sp.push(...lifeText.split(/(?<=。)/).filter(Boolean))
  if (stageLine) sp.push(stageLine)
  // the line after the lead / 年表 / stage lines (personal or undertone): trimmed before the stage line when long
  const coreIdx = sp.length
  if (personal) sp.push(tense(personal.stem))
  else if (d.theme !== 'quiet' && d.theme !== 'hint') sp.push(tense(g.undertone[i]))
  else if (d.theme === 'hint') sp.push(tense(g.light[i]))
  // 「この年は」 already opens the paragraph: the 10-year line starts from the long flow instead
  // what the year means inside the current 10-year flow (the combination sentence, not the 「n年目」 label)
  const decIdx = decade?.comboText ? sp.length : -1
  if (decade?.comboText) sp.push(tense(firstOf(decade.comboText)))
  // an entered relationship event already says what happened: no 「〜形で表れることがあります」 for that year
  if (relYear && !life?.hasRelationship) sp.push(...(manifest[0] ?? '').split(/(?<=。)/).filter(Boolean).slice(0, 2))
  const milestone = marriageNow ? P.milestones.marriage[j] : d.career && !life?.hasCareer ? P.milestones.career[careerMilestoneKey(ctx)][j] : d.move ? P.milestones.move[j] : ''
  if (milestone) sp.push(firstOf(milestone))
  if (!relYear) {
    if (!milestone) sp.push(personal?.structure ? tense(personal.structure) : palace && palace.evidence.length ? tense(firstOf(palace.text)) : P.shadowLead + g.shadow[i])
    if (areas) { areaIdx = sp.length; sp.push(firstOf(areas.relationship)) }
  }
  if (d.lifeTurn) sp.push(past ? pastizeAll(P.milestones.lifeTurn[d.lifeTurn]) : P.milestones.lifeTurn[d.lifeTurn])
  // the year's turning point with what changes (e.g. 「11月ごろには、〜時期に入ります。」); without a birth time, just the month
  else if (timing?.turnText) sp.push(tense(timing.turnText))
  else if (timing?.turnMonth) sp.push(fill(past ? SP.turnPast : SP.turnFuture, { month: `${timing.turnMonth}月` }))
  sp.push(baseAdvice)
  // possibility sentences: the first says 「〜ことがあります」, later ones 「〜こともあります」
  let seenPossibility = false
  const fixed = sp.filter(Boolean).map(x => {
    if (!/(こと|場面)(が|も)あります。$/.test(x) || /でもあります。$/.test(x)) return x
    const y = seenPossibility ? x.replace(/ことがあります。$/, 'こともあります。') : x.replace(/こともあります。$/, 'ことがあります。')
    seenPossibility = true
    return y
  })
  const plain = (t: string) => (SP.plain as [string, string][]).reduce((x, [a, b2]) => x.split(a).join(b2), t)
  let simple = plain(fixed.join(''))
  // short years get the tailwind / headwind line before the advice
  if ([...simple].length < 190 && tone) simple = plain([...fixed.slice(0, -1), tense(tone.text), fixed.at(-1)!].join(''))
  // keep it to one screen: when the paragraph runs long, drop the generic relationship-area line first, then the line
  // after the lead (the personal line is kept whenever the generic one can go instead)
  // a year with an entered event carries two more sentences: the 10-year line goes first when it runs long
  if (life?.inYear && [...simple].length > 280 && decIdx >= 0) { fixed.splice(decIdx, 1); if (areaIdx > decIdx) areaIdx--; simple = plain(fixed.join('')) }
  if ([...simple].length > 320) {
    // v2.19: the stage line (交際・結婚の年数) is kept; the 10-year line goes before the personal line
    const first = stageLine ? coreIdx : 1
    const k0 = areaIdx >= 0 ? areaIdx : stageLine && decIdx >= 0 ? decIdx : first
    simple = plain(fixed.filter((_, k) => k !== k0).join(''))
    if ([...simple].length > 320 && k0 !== first && !personal) simple = plain(fixed.filter((_, k) => k !== k0 && k !== first).join(''))
  }
  const relLines = relYear && !life?.hasRelationship ? (manifest[0] ?? '').split(/(?<=。)/).filter(Boolean).slice(0, 2) : areas ? [firstOf(areas.relationship)] : []
  // Preserve the original relationship lines for pair composition; only the self-facing voice changes.
  card.title = selfVoice(card.title)
  card.summary = selfVoice(card.summary)
  for (const section of card.sections ?? []) section.body = selfVoice(section.body)
  for (const page of card.pages ?? []) page.text = selfVoice(page.text)
  for (const tag of card.timelineTags ?? []) tag.evidenceText = selfVoice(tag.evidenceText ?? '')
  return { card, decision: d, simple: selfVoice(past ? pastizeAll(simple) : simple), simpleTitle: selfVoice(shortTitle(ctx, d, nowYear)), relLines }
}

export type TimelineStyle = 'simple' | 'detailed'
/**
 * Simple style (default in the app): the card keeps title / tags / basis, and its reading becomes one paragraph
 * (summary = the paragraph). The calculation meta records style: 'simple' so saved cards can be re-rendered the same way.
 */
export function toSimpleCard(card: ReportCard, simple: string, title?: string): ReportCard {
  const basis = (card.sections ?? []).find(x => x.heading === parts().sectionHeadings.basis)
  const main: ReportSection = { heading: depthParts().simple.heading, body: simple, evidence: [], termGloss: [] }
  const sections = basis ? [main, basis] : [main]
  const withStyle = (meta: unknown) => meta && typeof meta === 'object' ? { ...(meta as object), style: 'simple' } : meta
  const c: any = card
  return {
    ...card, ...(title ? { title } : {}), summary: simple, sections, pages: sections.map((x, k) => ({ role: k === 0 ? 'opening' as const : 'core' as const, label: x.heading, text: x.body })),
    ...(c.timelineV3Calculation ? { timelineV3Calculation: withStyle(c.timelineV3Calculation) } : {}),
    ...(c.coupleV3Calculation ? { coupleV3Calculation: withStyle(c.coupleV3Calculation) } : {}),
  } as ReportCard
}
export function timelineV3Cards(input: TimelineV3Input, from: number, to: number, nowYear: number, style: TimelineStyle = 'detailed'): ReportCard[] {
  const ctx = timelineContext(input)
  if (!ctx) return []
  const start = Math.max(1952, ctx.birthYear, from), end = Math.min(2100, to)
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, k) => {
    const y = composeYear(ctx, start + k, nowYear)
    return style === 'simple' ? toSimpleCard(y.card, y.simple, y.simpleTitle) : y.card
  })
}
