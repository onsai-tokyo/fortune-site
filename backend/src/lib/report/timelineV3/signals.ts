/**
 * Timeline v3 — per-year signals and scoring.
 * Spec: docs/timeline-v3/IMPLEMENTATION.md §3–§5. Do not add or re-weight rules without the
 * validation procedure in §9 (rules must be fixed BEFORE looking at new event data).
 */
import { canonicalLifeEvents, type LifeEvent } from './eventKinds.js'
import { natalContext, pillars, type AnnualContext, type NatalContext } from '../annual3600/engine.js'
import { resolveAnnualInput } from '../annual3600/inputPolicy.js'
import { cycleIndex } from '../annual3600/catalog.js'
import { calcTenGod } from '../../divination/index.js'
import { resolveSpouseTimeZone } from '../personality/birthContext.js'
import { antardashaOverlap, doubleTransitMonths, mahadashaStarts, vedicNatal, type DashaLord, type DashaPeriod, type VedicNatal } from './vedic.js'

export type RelationshipStatus = 'partnered' | 'single' | 'married'
/** v2.23: what the person registered with the meeting year is to them (the couple label). Only the wording changes. */
export type PartnerKind = 'partnered' | 'crush' | 'former' | 'married'
export const PARTNER_KINDS: PartnerKind[] = ['partnered', 'crush', 'former', 'married']
export interface TimelineV3Input extends AnnualContext {
  relationshipStatus?: RelationshipStatus
  /** v2.13: the person's own past events (年表). v2.16: starts and marriages also open life-stage windows. */
  lifeEvents?: LifeEvent[]
  /** v2.19: year the current relationship began (e.g. the meeting year of the registered partner). Used with relationshipStatus 'partnered'. */
  partnerSince?: number
  /** v2.23: the kind of that relationship (片思い crush・お付き合い中/婚約中 partnered・復縁希望/元恋人 former・夫婦 married). Without it, partnerSince counts only when relationshipStatus is partnered. */
  partnerKind?: PartnerKind
  /** v2.24: the registered partner's birth data (same fields as the couple timeline). With partnerSince, the dating-window line follows the two people's fortune. */
  partnerBirth?: { birthDate?: string; birthTime?: string; birthplace?: string; gender?: string; birthTimeZone?: string }
  /**
   * v2.24: what is stored instead of partnerBirth — the two people's fortune for each window year (year → tone).
   * timelineContext() computes it from partnerBirth and drops the partner's birth data, so saved cards carry no
   * personal data of the partner. Passing it back (card meta) reproduces the same text.
   */
  partnerTones?: Record<string, StageTone>
}
export type Strength = 'quiet' | 'hint' | 'active' | 'major'
export type Theme = 'trust' | 'relationship' | 'career' | 'move' | 'hint' | 'quiet'
export type BranchRelation = '冲' | '破' | '害' | '刑' | '自刑' | '六合' | '三合'

const STEMS = '甲乙丙丁戊己庚辛壬癸'
const pair = (t: string[], a: string, b: string) => t.includes(a + b) || t.includes(b + a)
const CLASH = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']
const BREAK = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌']
const HARM = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌']
const PUNISH = ['寅巳', '巳申', '丑戌', '戌未', '子卯']
const SELF_PUNISH = ['辰', '午', '酉', '亥']
const SIX_COMBINE = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']
const TRINES = ['申子辰', '寅午戌', '亥卯未', '巳酉丑']
const STEM_COMBINE = ['甲己', '乙庚', '丙辛', '丁壬', '戊癸']
/** 駅馬: key = natal branch, value = annual branch that is the travelling horse. */
const HORSE: Record<string, string> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' }

/** Branch relations of annual branch `b` against natal branch `a`, in fixed priority order. */
export function branchRelations(a: string, b: string): BranchRelation[] {
  const out: BranchRelation[] = []
  if (pair(CLASH, a, b)) out.push('冲')
  if (pair(BREAK, a, b)) out.push('破')
  if (pair(HARM, a, b)) out.push('害')
  if (pair(PUNISH, a, b)) out.push('刑')
  if (a === b && SELF_PUNISH.includes(a)) out.push('自刑')
  if (pair(SIX_COMBINE, a, b)) out.push('六合')
  if (a !== b && TRINES.some(g => g.includes(a) && g.includes(b))) out.push('三合')
  return out
}
const DISRUPT: BranchRelation[] = ['冲', '破', '害', '刑', '自刑']
export const tenGod = (dayStem: string, stem: string) => calcTenGod(STEMS.indexOf(dayStem), STEMS.indexOf(stem))

export interface SignalHit { id: string; points: number; tier: 'A' | 'B' | 'C'; system: '四柱推命' | 'インド占星術'; detail: string; terms: string[] }
export interface YearSignals {
  year: number; age: number; pillar: string; tenGod: string
  relationship: { score: number; hits: SignalHit[]; r1Periods: DashaPeriod[]; dt7: boolean }
  career: { score: number; hits: SignalHit[] }
  move: { score: number; hits: SignalHit[] }
  chapterStarts: Array<{ kind: 'daiun' | 'mahadasha'; label: string; start: number; pillar?: string; lord?: DashaLord }>
}
export interface TimelineContext {
  input: TimelineV3Input
  gender: 'female' | 'male' | null
  birthYear: number
  natal: NatalContext
  vedic: VedicNatal | null
  partnerGods: string[] | null
  /** true when the 大運 decades were computed from a noon approximation (no birth time); start dates are ±2 months. */
  decadesApprox?: boolean
}

export function timelineContext(raw: TimelineV3Input): TimelineContext | null {
  // Drop undefined keys so the stored input (card meta) is canonical and JSON-stable.
  const events = canonicalLifeEvents(raw.lifeEvents, Number(raw.birthDate?.slice(0, 4)))
  const since = Number.isInteger(raw.partnerSince) && raw.partnerSince! >= Number(raw.birthDate?.slice(0, 4)) && raw.partnerSince! <= 2100 ? raw.partnerSince : undefined
  // partnerBirth is never kept (v2.24: only the derived window tones are stored)
  const input = Object.fromEntries(Object.entries({ ...resolveAnnualInput(raw), partnerBirth: undefined, relationshipStatus: raw.relationshipStatus, lifeEvents: events.length ? events : undefined, partnerSince: since, partnerKind: since !== undefined && PARTNER_KINDS.includes(raw.partnerKind as PartnerKind) ? raw.partnerKind : undefined, partnerTones: since !== undefined ? validTones(raw.partnerTones, since) : undefined }).filter(([, v]) => v !== undefined)) as TimelineV3Input
  let natal = natalContext(input)
  if (!natal || natal.dayIndex < 0 || !natal.natal.day) return null
  const gender = input.gender === 'female' || input.gender === 'male' ? input.gender : null
  const hasTime = typeof input.birthTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)
  // v2.10: without a birth time the 大運 pillars are still fixed by the month pillar; only the start date moves
  // (about 4 months between 00:00 and 23:59). The v3 timeline computes them from noon (±2 months) and marks them
  // approximate, so the 10-year flow is shown and change years are worded as "この年の前後". annual3600 is unchanged.
  let decadesApprox = false
  if (!hasTime && !natal.decades.length && natal.natal.month && gender) {
    const noon = natalContext({ ...input, birthTime: '12:00' })
    if (noon?.decades.length && noon.natal.month === natal.natal.month) { natal = { ...natal, decades: noon.decades }; decadesApprox = true }
  }
  let vedic: VedicNatal | null = null
  if (hasTime && resolveSpouseTimeZone(input) === 'Asia/Tokyo') {
    const [y, m, d] = input.birthDate!.split('-').map(Number)
    const [h, mi] = input.birthTime!.split(':').map(Number)
    vedic = vedicNatal(new Date(Date.UTC(y, m - 1, d, h - 9, mi)), input.birthplace)
  }
  const partnerGods = gender === 'female' ? ['正官', '偏官'] : gender === 'male' ? ['正財', '偏財'] : null
  const ctx: TimelineContext = { input, gender, birthYear: Number(input.birthDate!.slice(0, 4)), natal, vedic, partnerGods, decadesApprox }
  // v2.24: the partner's birth data is used once, here, to fix the window tones; it is not kept in the stored input
  if (since !== undefined && !input.partnerTones && typeof raw.partnerBirth?.birthDate === 'string' && !pairToneResolver) {
    throw new Error('timelineV3: partnerBirth needs the pair-tone resolver — import the v3 functions from timelineV3/index.ts (or load couple.ts) before building the context')
  }
  if (since !== undefined && !input.partnerTones && typeof raw.partnerBirth?.birthDate === 'string' && pairToneResolver) {
    const pb = raw.partnerBirth
    const via: PartnerKind = input.partnerKind ?? 'partnered'
    if (input.partnerKind || input.relationshipStatus === 'partnered') {
      const b = timelineContext({ birthDate: pb.birthDate, ...(pb.birthTime ? { birthTime: pb.birthTime } : {}), ...(pb.birthplace ? { birthplace: pb.birthplace } : {}), ...(pb.gender ? { gender: pb.gender } : {}), ...(pb.birthTimeZone ? { birthTimeZone: pb.birthTimeZone } : {}), relationshipStatus: via === 'partnered' ? 'partnered' : via === 'married' ? 'married' : 'single', partnerSince: since, partnerKind: via } as TimelineV3Input)
      if (b) {
        const tones: Record<string, StageTone> = {}
        for (let k = 1; k <= 4; k++) tones[String(since + k)] = pairToneResolver(ctx, b, via, since + k, since)
        ctx.input = { ...input, partnerTones: tones }
      }
    }
  }
  return ctx
}

/** v2.24: set by couple.ts (pairTone), so the single timeline can use the two-person fortune without importing couple.ts. */
let pairToneResolver: ((a: TimelineContext, b: TimelineContext, status: PartnerKind, year: number, meetingYear: number) => StageTone) | null = null
export function setPairToneResolver(fn: typeof pairToneResolver) { pairToneResolver = fn }
const TONES: StageTone[] = ['forward', 'review', 'both', 'steady']
function validTones(t: unknown, since: number): Record<string, StageTone> | undefined {
  if (!t || typeof t !== 'object') return undefined
  const out: Record<string, StageTone> = {}
  for (let k = 1; k <= 4; k++) { const v = (t as Record<string, unknown>)[String(since + k)]; if (TONES.includes(v as StageTone)) out[String(since + k)] = v as StageTone }
  return Object.keys(out).length ? out : undefined
}

const COLUMN_LABEL: Record<string, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '時柱' }

const SIGNAL_CACHE = new WeakMap<TimelineContext, Map<number, YearSignals>>()
const BASE_CACHE = new WeakMap<TimelineContext, Map<number, ReturnType<typeof baseDecisionUncached>>>()
export function yearSignals(ctx: TimelineContext, year: number): YearSignals {
  let m = SIGNAL_CACHE.get(ctx); if (!m) SIGNAL_CACHE.set(ctx, m = new Map())
  let v = m.get(year); if (!v) m.set(year, v = yearSignalsUncached(ctx, year))
  return v
}
function yearSignalsUncached(ctx: TimelineContext, year: number): YearSignals {
  const n = ctx.natal.natal
  const day = n.day!
  const pillar = pillars[cycleIndex(year)]
  const god = tenGod(day[0], pillar[0])
  const rel: SignalHit[] = [], car: SignalHit[] = [], mov: SignalHit[] = []
  let r1Periods: DashaPeriod[] = []

  // R1 (A, +3 / male +2 tier B): partner-karaka antardasha overlapping >= 90 days of the calendar year.
  // v2.8 celebrity back-test: R1 1.7x vs chance. Raising it to +4 turned every such year into a 'major' year and
  // halved the lift of major years (3.1x -> 2.0x), so its points stay; see docs/timeline-v3/VALIDATION.md.
  if (ctx.vedic && ctx.gender) {
    const lord: DashaLord = ctx.gender === 'female' ? 'Jupiter' : 'Venus'
    const o = antardashaOverlap(ctx.vedic, lord, year)
    if (o.days >= 90) {
      r1Periods = o.periods
      rel.push({ id: 'TL3-R1', points: ctx.gender === 'female' ? 3 : 2, tier: ctx.gender === 'female' ? 'A' : 'B', system: 'インド占星術',
        detail: `ヴィムショッタリ・ダシャー：${lord === 'Jupiter' ? '木星' : '金星'}のアンタルダシャー`, terms: [] })
    }
  }
  // R2 (C, +1; was B, +2 before v2.9): annual branch disrupts the day branch (spouse palace).
  // v2.9 celebrity back-test: 1.1x (first 24 people) and 0.75x (48 new people) vs chance, so on its own it only gives a hint year.
  const r2 = branchRelations(day[1], pillar[1]).filter(r => DISRUPT.includes(r))
  if (r2.length) rel.push({ id: 'TL3-R2', points: 1, tier: 'C', system: '四柱推命', detail: `年支${pillar[1]}が日支${day[1]}と${r2.join('・')}`, terms: ['年支', '日支', ...r2.filter(r => r !== '自刑')] })
  // R3 (A, +3; was B, +2 before v2.8): annual stem combines away a visible natal partner star (day stem excluded).
  // v2.8 celebrity back-test: 2.1x vs chance (p≈0.03), the strongest single rule.
  if (ctx.partnerGods) {
    for (const col of ['year', 'month', 'hour'] as const) {
      const p = n[col]
      if (!p) continue
      const g = tenGod(day[0], p[0])
      if (ctx.partnerGods.includes(g) && pair(STEM_COMBINE, p[0], pillar[0])) {
        rel.push({ id: 'TL3-R3', points: 3, tier: 'A', system: '四柱推命', detail: `年干${pillar[0]}が${COLUMN_LABEL[col]}の${g}${p[0]}と干合`, terms: ['干合', g] })
        break
      }
    }
    // R4 (annual stem is the partner star) was removed from the score in v2.9: 1.1x and 0.64x vs chance in the two
    // celebrity sets. The year's ten-god texts still mention the partner star (tenGods.*.partnerNote).
  }
  // R5 (C, +2; added in v2.10): the year branch is 天喜 (喜びごとの星) of the birth-year branch. Time-independent.
  // Chosen from 15 time-independent candidates as the only one that held in both celebrity sets (1.65x, 1.45x);
  // provisional until confirmed on a third data set (docs/timeline-v3/VALIDATION.md §1d).
  if (n.year) {
    const BRS = '子丑寅卯辰巳午未申酉戌亥'
    const hl = BRS[(15 - BRS.indexOf(n.year[1])) % 12], tx = BRS[(BRS.indexOf(hl) + 6) % 12]
    if (pillar[1] === tx) rel.push({ id: 'TL3-R5', points: 2, tier: 'C', system: '四柱推命', detail: `年支${pillar[1]}が天喜`, terms: [] })
  }
  const dt7 = ctx.vedic ? doubleTransitMonths(ctx.vedic, 7, year) >= 3 : false

  // Career (B, candidate): C1 officer/resource year, C2 month-branch interaction, C3 double transit on 10th.
  if (['正官', '偏官', '正印', '偏印'].includes(god)) car.push({ id: 'TL3-C1', points: 1, tier: 'B', system: '四柱推命', detail: `年干${pillar[0]}が${god}`, terms: [god === '正印' ? '印綬' : god] })
  if (n.month) {
    const c2 = branchRelations(n.month[1], pillar[1])
    if (c2.length) car.push({ id: 'TL3-C2', points: 1, tier: 'B', system: '四柱推命', detail: `年支${pillar[1]}が月支${n.month[1]}と${c2.join('・')}`, terms: ['年支', '月支'] })
  }
  if (ctx.vedic && doubleTransitMonths(ctx.vedic, 10, year) >= 3) car.push({ id: 'TL3-C3', points: 1, tier: 'B', system: 'インド占星術', detail: '木星と土星のダブルトランジット：10室', terms: ['ハウス'] })

  // Move (B, candidate): M1 travelling horse, M2 clash with day/year branch, M3 double transit on 4th.
  const horse = [HORSE[day[1]], n.year ? HORSE[n.year[1]] : undefined].includes(pillar[1])
  if (horse) mov.push({ id: 'TL3-M1', points: 1, tier: 'B', system: '四柱推命', detail: `年支${pillar[1]}が駅馬`, terms: ['年支'] })
  const clashTargets = [day[1], n.year?.[1]].filter((b): b is string => !!b && pair(CLASH, b, pillar[1]))
  if (clashTargets.length) mov.push({ id: 'TL3-M2', points: 1, tier: 'B', system: '四柱推命', detail: `年支${pillar[1]}が${clashTargets.join('・')}と冲`, terms: ['年支', '冲'] })
  if (ctx.vedic && doubleTransitMonths(ctx.vedic, 4, year) >= 3) mov.push({ id: 'TL3-M3', points: 1, tier: 'B', system: 'インド占星術', detail: '木星と土星のダブルトランジット：4室', terms: ['ハウス'] })

  // Chapter starts inside the calendar year (JST).
  const ys = Date.UTC(year, 0, 1, -9), ye = Date.UTC(year + 1, 0, 1, -9)
  const chapterStarts: YearSignals['chapterStarts'] = []
  // approximate (noon) decades are shown as the 10-year flow but never create a chapter start / life-turn year:
  // their change year is uncertain by ±2 months and the v2.10 back-test did not support using them for turns.
  if (!ctx.decadesApprox) for (const d of ctx.natal.decades) if (d.start >= ys && d.start < ye) chapterStarts.push({ kind: 'daiun', label: `大運${d.pillar}`, start: d.start, pillar: d.pillar })
  if (ctx.vedic) for (const d of mahadashaStarts(ctx.vedic, year)) chapterStarts.push({ kind: 'mahadasha', label: `マハーダシャー${d.md}`, start: d.start, lord: d.md })

  const sum = (h: SignalHit[]) => h.reduce((s, x) => s + x.points, 0)
  return { year, age: year - ctx.birthYear, pillar, tenGod: god,
    relationship: { score: sum(rel), hits: rel, r1Periods, dt7 }, career: { score: sum(car), hits: car }, move: { score: sum(mov), hits: mov }, chapterStarts }
}

/** Fixed window for per-decade caps: the 大運 decade containing Jul 1, else the age decade. */
export function capWindow(ctx: TimelineContext, year: number): { id: string; start: number; end: number } {
  const mid = Date.UTC(year, 6, 1, -9)
  const d = ctx.decadesApprox ? undefined : ctx.natal.decades.find(x => x.start <= mid && mid < x.end)
  if (d) {
    const s = new Date(d.start + 9 * 3600_000).getUTCFullYear(), e = new Date(d.end + 9 * 3600_000).getUTCFullYear()
    return { id: `daiun:${d.pillar}`, start: s, end: e }
  }
  const k = Math.floor((year - ctx.birthYear) / 10)
  return { id: `age:${k}`, start: ctx.birthYear + k * 10, end: ctx.birthYear + k * 10 + 9 }
}

export const CAPS = { career: 3, move: 2, lifeTurn: 2 } as const
export const THRESHOLDS = { career: 2, move: 2, marriage: 3 } as const

/** Deterministic selection of capped candidates within the year's window (independent of display range). */
export function selectedInWindow(ctx: TimelineContext, year: number, kind: 'career' | 'move'): boolean {
  const w = capWindow(ctx, year)
  const rows: Array<{ year: number; score: number }> = []
  for (let y = w.start; y <= w.end; y++) {
    if (y < 1952 || y > 2100) continue
    const s = yearSignals(ctx, y)[kind].score
    if (s >= THRESHOLDS[kind]) rows.push({ year: y, score: s })
  }
  rows.sort((a, b) => b.score - a.score || Math.abs(a.year - w.start) - Math.abs(b.year - w.start) || a.year - b.year)
  return rows.slice(0, CAPS[kind]).some(r => r.year === year)
}

export const relationshipStrength = (score: number): Strength => score >= 4 ? 'major' : score >= 2 ? 'active' : score >= 1 ? 'hint' : 'quiet'

export interface YearDecision {
  signals: YearSignals
  theme: Theme
  strength: Strength
  career: boolean
  move: boolean
  lifeTurn: 'chapter' | 'convergence' | null
  marriage: boolean
  ageBand: 'child' | 'teen' | 'adult'
  /** v2.16 life-stage window (age, years since the relationship began, years since marriage); null outside a window */
  stage: LifeStage | null
}

/**
 * v2.16 life-stage windows (VALIDATION.md §1k: age and relationship length carry the timing information that the
 * astrological signals alone do not). Windows, from the person's own 年表 before the year when available:
 *   married: 3–7 years after the latest marriage that has not ended (years when the relationship is most often reviewed)
 *   dating : 1–3 years after the latest start / encounter / reunion that has not ended (when the form of a relationship is decided)
 *   age    : otherwise ages 26–34 (the years in which most first marriages fall)
 */
export interface LifeStage { kind: 'age' | 'dating' | 'married'; k: number; since?: number; /** v2.23: the window starts at the registered meeting year of this kind of relationship */ via?: PartnerKind }
export const STAGE = { ageFrom: 26, ageTo: 34, datingFrom: 1, datingTo: 3, marriedFrom: 3, marriedTo: 7 } as const
export function lifeStage(ctx: TimelineContext, year: number): LifeStage | null {
  const age = year - ctx.birthYear
  if (age < 18) return null
  // the registered partner's meeting year counts as the start of a relationship: with partnerKind for any romantic label
  // (v2.23, wording only differs), without it for partnered people only (v2.19)
  const via: PartnerKind | undefined = ctx.input.partnerSince ? ctx.input.partnerKind ?? (ctx.input.relationshipStatus === 'partnered' ? 'partnered' : undefined) : undefined
  const extra = via ? [{ year: ctx.input.partnerSince!, kind: 'encounter' as const }] : []
  const prev = [...(ctx.input.lifeEvents ?? []), ...extra].filter(e => e.year < year && ['encounter', 'start', 'reunion', 'marriage', 'breakup', 'divorce'].includes(e.kind)).sort((p, q) => p.year - q.year)
  const last = prev.at(-1)
  if (last?.kind === 'marriage') {
    const k = year - last.year
    return k >= STAGE.marriedFrom && k <= STAGE.marriedTo ? { kind: 'married', k, since: last.year } : null
  }
  if (last && ['encounter', 'start', 'reunion'].includes(last.kind)) {
    // the relationship began at the earliest start of the current run (encounter -> start counts as one relationship)
    let i = prev.length - 1
    while (i > 0 && ['encounter', 'start', 'reunion'].includes(prev[i - 1].kind)) i--
    const k = year - prev[i].year
    if (k >= STAGE.datingFrom && k <= STAGE.datingTo) return { kind: 'dating', k, since: prev[i].year, ...(via && prev[i].year === ctx.input.partnerSince ? { via } : {}) }
  }
  return age >= STAGE.ageFrom && age <= STAGE.ageTo ? { kind: 'age', k: age } : null
}

function regularMarriage(ctx: TimelineContext, year: number) {
  const b = baseDecision(ctx, year)
  const stageBonus = b.stage && b.stage.kind !== 'married' ? 1 : 0
  return b.theme === 'relationship' && b.s.relationship.score + (b.s.relationship.dt7 ? 1 : 0) + stageBonus >= THRESHOLDS.marriage
}
function baseDecision(ctx: TimelineContext, year: number) {
  let m = BASE_CACHE.get(ctx); if (!m) BASE_CACHE.set(ctx, m = new Map())
  let v = m.get(year); if (!v) m.set(year, v = baseDecisionUncached(ctx, year))
  return v
}
function baseDecisionUncached(ctx: TimelineContext, year: number) {
  const s = yearSignals(ctx, year)
  const hasR2 = s.relationship.hits.some(h => h.id === 'TL3-R2'), hasR3 = s.relationship.hits.some(h => h.id === 'TL3-R3')
  const career = selectedInWindow(ctx, year, 'career'), move = selectedInWindow(ctx, year, 'move')
  const relStrength = relationshipStrength(s.relationship.score)
  // v2.16: inside a life-stage window, one astrological point is enough for a relationship year, and a relationship
  // year becomes a major one (VALIDATION.md §1l: stage x astro 1.88x, stage x 1 point 1.48x, astro alone 1.29x)
  const stage = lifeStage(ctx, year)
  const sc = s.relationship.score
  const relYear = sc >= 2 || (!!stage && sc >= 1)
  const theme: Theme = hasR2 && hasR3 ? 'trust' : relYear ? 'relationship' : career ? 'career' : move ? 'move' : sc === 1 ? 'hint' : 'quiet'
  const order: Strength[] = ['quiet', 'hint', 'active', 'major']
  const relS = stage && (theme === 'relationship' || theme === 'trust') ? (sc >= 2 ? 'major' : 'active') : relStrength
  const strength = order[Math.max(order.indexOf(relS), career || move ? 2 : 0)]
  return { s, theme, strength, career, move, stage }
}

export function decideYear(ctx: TimelineContext, year: number): YearDecision {
  const b = baseDecision(ctx, year)
  // life turn: every chapter-start year; convergence years (major + career/move) only while the window has < CAPS.lifeTurn life turns.
  const w = capWindow(ctx, year)
  let lt: 'chapter' | 'convergence' | null = b.s.chapterStarts.length ? 'chapter' : null
  if (!lt && b.strength === 'major' && (b.career || b.move)) {
    const rows: Array<{ year: number; chapter: boolean; score: number }> = []
    for (let y = w.start; y <= w.end; y++) {
      if (y < 1952 || y > 2100) continue
      const x = y === year ? b : baseDecision(ctx, y)
      if (x.s.chapterStarts.length) rows.push({ year: y, chapter: true, score: 100 })
      else if (x.strength === 'major' && (x.career || x.move)) rows.push({ year: y, chapter: false, score: x.s.relationship.score })
    }
    rows.sort((a, c) => c.score - a.score || a.year - c.year)
    if (rows.slice(0, Math.max(CAPS.lifeTurn, rows.filter(r => r.chapter).length)).some(r => r.year === year && !r.chapter)) lt = 'convergence'
  }
  const age = b.s.age
  const ageBand = age < 13 ? 'child' : age < 18 ? 'teen' : 'adult'
  const status = ctx.input.relationshipStatus
  // 婚期: partnered, a relationship year, and astro points (+1 inside a dating / age window, +1 for the 7th-house double transit) >= 3
  // v2.25: 婚期 is only the year that meets the regular condition. The v2.19 guarantee (the best year of the dating
  // window named 婚期 when none qualified) was removed: on 362 people with a known dating start, the 婚期 year matched
  // the marriage year no better than chance (0.98x, VALIDATION.md §1n). The dating-window tag and line stay.
  const marriage = ageBand === 'adult' && status === 'partnered' && regularMarriage(ctx, year)
  const theme = b.theme, strength = b.strength
  return { signals: b.s, theme, strength, career: b.career, move: b.move, lifeTurn: lt, marriage, ageBand, stage: b.stage }
}

export type MovementQuality = 'grow' | 'shake' | 'mixed' | 'pull'
/**
 * What kind of movement a relationship year carries, from the signals that produced it:
 * partner-karaka period (R1) = grow, spouse-palace disruption (R2) = shake, both = mixed, partner-star combination (R3) = pull.
 * R2+R3 years are 'trust' themes and do not use this.
 */
/**
 * v2.17: the quality used for wording. A major relationship year reads both ways (始まり・深まり と 区切り) unless it is a
 * 婚期 year shown as such: the data never supported telling the direction of a big year (VALIDATION.md §1g–1k), and a
 * one-way title ("深まる年") read wrong when the big change was an ending.
 */
export function wordingQuality(d: YearDecision, past: boolean): MovementQuality | null {
  const q = movementQuality(d.signals.relationship.hits.map(h => h.id))
  if (d.theme === 'relationship' && d.strength === 'major' && !(d.marriage && !past)) return 'mixed'
  return q
}
/**
 * v2.24: how the year's fortune points inside a relationship window, for the window line (wording only).
 * forward = 深まる・進む (婚期, or R1/R3/R5-led relationship years), review = 見直す (trust, or R2-led), both = 両方向
 * (major years incl. a major 婚期, or R1+R2), steady = 大きく動かない (no relationship theme).
 */
export type StageTone = 'forward' | 'review' | 'both' | 'steady'
export function toneOf(theme: 'moving' | 'trust' | 'quiet', quality: MovementQuality | null, marriage: boolean, major: boolean): StageTone {
  if (marriage) return major ? 'both' : 'forward'
  if (theme === 'trust') return 'review'
  if (theme !== 'moving') return 'steady'
  return major || quality === 'mixed' ? 'both' : quality === 'shake' ? 'review' : quality === 'grow' || quality === 'pull' ? 'forward' : 'steady'
}
export function stageTone(d: YearDecision, past: boolean): StageTone {
  return toneOf(d.theme === 'relationship' ? 'moving' : d.theme === 'trust' ? 'trust' : 'quiet', d.theme === 'relationship' ? wordingQuality(d, past) : null, d.marriage, d.strength === 'major')
}
export function movementQuality(hitIds: string[]): MovementQuality | null {
  const r1 = hitIds.includes('TL3-R1'), r2 = hitIds.includes('TL3-R2')
  if (r1 && r2) return 'mixed'
  if (r1) return 'grow'
  if (r2) return 'shake'
  if (hitIds.includes('TL3-R3')) return 'pull'
  if (hitIds.includes('TL3-R5')) return 'grow'
  return null
}
