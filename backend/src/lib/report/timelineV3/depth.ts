/**
 * Timeline v3 — depth paragraphs (parts: data/depthParts.json).
 *   decade:     where the year sits inside the current 10-year luck pillar, and how the year's stem meets it.
 *   timing:     months inside the calendar year where the flow changes (Vedic sub-periods, Jupiter/Saturn sign changes,
 *               10-year / major-period changes). Requires a birth time for the Vedic parts.
 *   continuity: how the year follows the previous year's decision, and the next year the same area moves.
 * Everything is derived from already-computed signals; no new scoring rule is introduced.
 */
import { readFileSync } from 'node:fs'
import type { ReportCardEvidence } from '../../reportCards.js'
import { decideYear, movementQuality, wordingQuality, tenGod, type TimelineContext, type YearDecision } from './signals.js'
import { siderealSign, type DashaLord } from './vedic.js'
import { pillars as PILLARS } from '../annual3600/engine.js'
import { cycleIndex as CYCLE } from '../annual3600/catalog.js'


let DEPTH: any
export function depthParts(): any {
  DEPTH ??= JSON.parse(readFileSync(new URL('./data/depthParts.json', import.meta.url), 'utf8'))
  return DEPTH
}
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
const STEMS = '甲乙丙丁戊己庚辛壬癸'
const JST = 9 * 3600_000
const jstYear = (ms: number) => new Date(ms + JST).getUTCFullYear()
const jstMonth = (ms: number) => new Date(ms + JST).getUTCMonth() + 1

/**
 * Past years: sentences that only work as advice or as a promise about the outcome (「〜すると〜」「〜ほど〜」「〜ておくと安心」…)
 * are dropped. The first sentence of each manuscript entry is always descriptive and always kept.
 */
const ADVICE = /(ると|ほど、|だけで|ておくと|ことで|ていけます|見つかります|効いてきます|生きてきます|工夫)/
export const keepForTense = (text: string, past: boolean) => {
  const xs = text.split(/(?<=。)/).filter(Boolean)
  return past ? [xs[0], ...xs.slice(1).filter(x => !ADVICE.test(x))].join('') : xs.join('')
}

export type GodGroup = 'self' | 'expr' | 'wealth' | 'duty' | 'learn'
const GROUP: Record<string, GodGroup> = {
  比肩: 'self', 劫財: 'self', 食神: 'expr', 傷官: 'expr', 偏財: 'wealth', 正財: 'wealth',
  偏官: 'duty', 正官: 'duty', 偏印: 'learn', 正印: 'learn', 印綬: 'learn',
}

export interface DepthResult { text: string; basis: string | null; evidence: ReportCardEvidence[]; terms: string[]; note?: string; turnMonth?: number; turnText?: string; comboText?: string }

/** The 10-year pillar containing Jul 1 of the year (same window as the per-decade caps). */
function decadeOf(ctx: TimelineContext, year: number) {
  const mid = Date.UTC(year, 6, 1, -9)
  const k = ctx.natal.decades.findIndex(x => x.start <= mid && mid < x.end)
  return k < 0 ? null : { k, d: ctx.natal.decades[k] }
}

export function decadeParagraph(ctx: TimelineContext, d: YearDecision, chapterTitles: Record<string, { title: string }>, past = false): DepthResult | null {
  const D = depthParts().decade
  const hit = decadeOf(ctx, d.signals.year)
  if (!hit) return null
  const dayStem = ctx.natal.natal.day![0]
  const decadeGod = tenGod(dayStem, hit.d.pillar[0])
  const dg = GROUP[decadeGod], yg = GROUP[d.signals.tenGod]
  if (!dg || !yg) return null
  const title = chapterTitles[decadeGod]?.title
  if (!title) return null
  // 1st year = the first calendar year whose Jul 1 falls inside the decade
  const sy = jstYear(hit.d.start)
  const ordinal = d.signals.year - sy + (hit.d.start <= Date.UTC(sy, 6, 1, -9) ? 1 : 0)
  // Two years of the same group fall on consecutive years inside a decade (yin/yang stems); the stem parity and the
  // decade ordinal keep them apart, and the same combination in the next decade gets a third wording.
  const v = (STEMS.indexOf(d.signals.pillar[0]) % 2 + 2 * hit.k) % 3
  const comboText = keepForTense(D.combo[`${dg}>${yg}`][v], past)
  const text = fill(D.intro, { title, ordinal }) + (D.position[ordinal - 1] ?? '') + comboText
  return {
    text, comboText,
    basis: fill(depthParts().evidence.decade, { title }),
    evidence: [{ family: 'timeline-v3', system: '四柱推命', detail: `大運${hit.d.pillar}（${decadeGod}）×年干${d.signals.pillar[0]}（${d.signals.tenGod}）：${dg}>${yg}` }],
    terms: ['大運', decadeGod === '正印' ? '印綬' : decadeGod],
  }
}

/** Sign at the 15th of each month (12:00 JST), with the previous December as month -1. */
function monthlySigns(body: string, year: number): { before: number; months: number[] } {
  const at = (y: number, m: number) => siderealSign(body, new Date(Date.UTC(y, m, 15, 3)))
  return { before: at(year - 1, 11), months: Array.from({ length: 12 }, (_, m) => at(year, m)) }
}
/** Month (1-12) from which the planet stays in its December sign, when that differs from the sign at the start of the year. */
function settledIngress(body: string, year: number): { month: number; sign: number } | null {
  const { before, months } = monthlySigns(body, year)
  const final = months[11]
  if (final === before) return null
  let m = 11
  while (m > 0 && months[m - 1] === final) m--
  return { month: m + 1, sign: final }
}

export function timingParagraph(ctx: TimelineContext, d: YearDecision, chapterTitles: { daiun: Record<string, { title: string }>; mahadasha: Record<string, { title: string }> }): DepthResult {
  const T = depthParts().timing
  const year = d.signals.year
  const ys = Date.UTC(year, 0, 1, -9), ye = Date.UTC(year + 1, 0, 1, -9)
  const items: Array<{ at: number; text: string; chapter?: boolean }> = []
  const evidence: ReportCardEvidence[] = []
  const terms: string[] = []
  const dayStem = ctx.natal.natal.day![0]
  for (const c of d.signals.chapterStarts) {
    if (c.kind === 'daiun' && c.pillar) {
      const title = chapterTitles.daiun[tenGod(dayStem, c.pillar[0])]?.title
      if (title) items.push({ at: c.start, chapter: true, text: fill(T.daiunChange, { month: `${jstMonth(c.start)}月`, title }) })
    } else if (c.kind === 'mahadasha' && c.lord) {
      const title = chapterTitles.mahadasha[c.lord]?.title
      // the first sub-period of the new major period shares its lord: one sentence carries both
      const tpl = ctx.vedic ? T.mahadashaChangeWith : T.mahadashaChange
      if (title) items.push({ at: c.start, chapter: true, text: fill(tpl, { month: `${jstMonth(c.start)}月`, title, phrase: T.antardasha[c.lord][0] }) })
    }
  }
  if (!ctx.vedic) {
    // approximate 10-year pillars (no birth time): name the change without a month, as "around this year"
    let turnText: string | undefined
    if (ctx.decadesApprox) for (const c of ctx.natal.decades) {
      if (c.start < ys || c.start >= ye) continue
      const title = chapterTitles.daiun[tenGod(dayStem, c.pillar[0])]?.title
      if (!title) continue
      turnText = fill(T.daiunChangeApprox, { title })
      items.push({ at: c.start, text: turnText })
      evidence.push({ family: 'timeline-v3', system: '四柱推命', detail: `大運${c.pillar}開始（出生時刻なし・正午で近似：${year}年前後）` })
      terms.push('大運')
    }
    items.sort((a, b) => a.at - b.at)
    return { text: items.map(x => x.text).join(''), note: (turnText ? T.daiunApproxNote : '') + T.noTime, basis: null, evidence, terms, turnText }
  }
  // Vedic sub-periods (antardasha) running in the calendar year
  const ads = ctx.vedic.dashas.filter(p => p.end > ys && p.start < ye).sort((a, b) => a.start - b.start)
  const phrase = (lord: DashaLord, start: number) => T.antardasha[lord][Math.abs(year - jstYear(start)) % 2]
  // the first sub-period of a new major period is announced by the major-period sentence; a change in January replaces 「年の初めは」
  const shown = ads.filter((p, i) => !(i > 0 && p.md === p.ad && d.signals.chapterStarts.some(c => c.kind === 'mahadasha' && c.start === p.start)))
  if (shown.length > 1 && jstMonth(shown[1].start) === 1 && jstYear(shown[1].start) === year) shown.shift()
  if (ads.length === 1) items.push({ at: ys, text: fill(T.antardashaWhole, { phrase: phrase(ads[0].ad, ads[0].start), start: `${jstYear(ads[0].start)}年${jstMonth(ads[0].start)}月`, end: `${jstYear(ads[0].end)}年${jstMonth(ads[0].end)}月` }) })
  else shown.forEach((p, i) => items.push(i === 0 && p.start < ys
    ? { at: ys, text: fill(T.antardashaStart, { phrase: phrase(p.ad, p.start) }) }
    : { at: p.start, text: fill(T.antardashaChange, { month: `${jstMonth(p.start)}月`, phrase: phrase(p.ad, p.start) }) }))
  evidence.push({ family: 'timeline-v3', system: 'インド占星術', detail: `アンタルダシャー：${ads.map(p => `${p.md}/${p.ad}（${jstYear(p.start)}年${jstMonth(p.start)}月〜）`).join('、')}` })
  // Jupiter / Saturn sign changes, read as houses from the ascendant sign (needs a resolved birthplace)
  if (ctx.vedic.lagnaSign !== null) {
    const lagna = ctx.vedic.lagnaSign
    const j = settledIngress('Jupiter', year)
    if (j) {
      const house = ((j.sign - lagna) % 12 + 12) % 12
      items.push({ at: Date.UTC(year, j.month - 1, 1, -9), text: fill(T.jupiterChange, { month: `${j.month}月`, phrase: T.jupiter[house] }) })
      evidence.push({ family: 'timeline-v3', system: 'インド占星術', detail: `木星トランジット：${j.month}月から第${house + 1}ハウス` })
    }
    const s = settledIngress('Saturn', year)
    if (s) {
      const house = ((s.sign - lagna) % 12 + 12) % 12
      items.push({ at: Date.UTC(year, s.month - 1, 1, -9), text: fill(T.saturnChange, { month: `${s.month}月`, phrase: T.saturn[house] }) })
      evidence.push({ family: 'timeline-v3', system: 'インド占星術', detail: `土星トランジット：${s.month}月から第${house + 1}ハウス` })
    }
    if (j || s) terms.push('ハウス')
  }
  items.sort((a, b) => a.at - b.at)
  // the year's main turning point: a 10-year / major-period change first, otherwise the first change after January 1
  const turn = items.find(x => x.at > ys && x.chapter) ?? items.find(x => x.at > ys)
  return { text: items.map(x => x.text).join(''), basis: depthParts().evidence.timing, evidence, terms, turnMonth: turn ? jstMonth(turn.at) : undefined, turnText: turn?.text }
}

type Area = 'rel' | 'work' | 'home' | 'calm'
const area = (d: YearDecision): Area => d.theme === 'relationship' || d.theme === 'trust' ? 'rel' : d.theme === 'career' ? 'work' : d.theme === 'move' ? 'home' : 'calm'

/** Returns the transition sentence (to be put in the year's tense) and the forward pointer (already in the right tense). */
export function continuityParagraph(ctx: TimelineContext, d: YearDecision, nowYear: number): { transition: string; next: string } | null {
  const C = depthParts()
  const year = d.signals.year
  if (year - 1 < Math.max(1952, ctx.birthYear)) return null
  const prev = decideYear(ctx, year - 1)
  const cur = area(d)
  // rotate through the variants by how often the same transition occurred since birth (range-independent)
  const key = `${area(prev)}>${cur}`
  let seen = 0
  for (let y = Math.max(1953, ctx.birthYear + 1); y < year; y++) if (`${area(decideYear(ctx, y - 1))}>${area(decideYear(ctx, y))}` === key) seen++
  const list: string[] = C.continuity[key]
  const transition = keepForTense(list[(seen + ctx.natal.dayIndex) % list.length], year < nowYear)
  let next = ''
  for (let y = year + 1; y <= Math.min(2100, year + 12); y++) {
    const a = area(decideYear(ctx, y))
    if (cur === 'calm' ? a !== 'calm' : a === cur) {
      const N = C.next
      const tpl = year < nowYear ? (y < nowYear ? N.past : N.fromPast) : N.future
      next = fill(tpl, { area: N.area[a], year: y })
      break
    }
  }
  return { transition, next }
}

// ---- tone: tailwind / mixed / headwind (simplified day-master strength × the year's elements)
const STEM_EL = '木木火火土土金金水水'
const BRANCH_MAIN: Record<string, string> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' }
const EL = '木火土金水'
const elOf = (stem: string) => STEM_EL[STEMS.indexOf(stem)]
/** relation of element b to the day element a: self / learn (b generates a) / expr (a generates b) / wealth (a controls b) / duty (b controls a) */
function relation(a: string, b: string): GodGroup {
  const d = (EL.indexOf(b) - EL.indexOf(a) + 5) % 5
  return (['self', 'expr', 'wealth', 'duty', 'learn'] as GodGroup[])[d]
}
export type Tone = 'tailwind' | 'mixed' | 'headwind'
/**
 * Day master is "strong" when the supporting weight (same element + resource) is at least half of the total.
 * Weights: month branch 3, day branch 1.5, other stems/branches 1 (branches by their main hidden stem).
 * Strong charts are helped by output / wealth / officer elements, weak charts by resource / companion elements.
 */
export function dayMasterStrength(ctx: TimelineContext) {
  const n = ctx.natal.natal, dayEl = elOf(n.day![0])
  let support = 0, total = 0
  const add = (stem: string, w: number) => { total += w; const r = relation(dayEl, elOf(stem)); if (r === 'self' || r === 'learn') support += w }
  for (const col of ['year', 'month', 'hour'] as const) if (n[col]) add(n[col]![0], 1)
  for (const col of ['year', 'month', 'day', 'hour'] as const) if (n[col]) add(BRANCH_MAIN[n[col]![1]], col === 'month' ? 3 : col === 'day' ? 1.5 : 1)
  return { strong: support * 2 >= total, support, total, dayEl }
}
export type MixedKind = 'stemGood' | 'branchGood' | 'yearGoodDecadeBad' | 'yearBadDecadeGood'
export function yearTone(ctx: TimelineContext, year: number, pillar: string): { tone: Tone; mixed: MixedKind | null; detail: string } {
  const m = dayMasterStrength(ctx)
  const good = (g: GodGroup) => m.strong ? g === 'expr' || g === 'wealth' || g === 'duty' : g === 'self' || g === 'learn'
  // votes: the year stem and the year branch (main hidden stem) count 1 each; the 10-year pillar stem, when known,
  // adds +0.5 when it helps and -0.5 when it does not. >= 2 tailwind, <= 0 headwind, otherwise mixed:
  // both year elements must help (and the decade must not work against them) for a tailwind year, and a headwind
  // year needs both year elements to work against the chart without a helping decade.
  const dec = decadeOf(ctx, year)
  const stemOk = good(relation(m.dayEl, elOf(pillar[0]))), branchOk = good(relation(m.dayEl, elOf(BRANCH_MAIN[pillar[1]])))
  const y = (stemOk ? 1 : 0) + (branchOk ? 1 : 0)
  // without a known 10-year pillar the reading is less certain: never call it a headwind year from the year alone
  const dv = dec ? (good(relation(m.dayEl, elOf(dec.d.pillar[0]))) ? 0.5 : -0.5) : 0.25
  const votes = y + dv
  const tone: Tone = votes >= 2 ? 'tailwind' : votes <= 0 ? 'headwind' : 'mixed'
  const mixed: MixedKind | null = tone !== 'mixed' ? null : y === 2 ? 'yearGoodDecadeBad' : y === 0 ? 'yearBadDecadeGood' : stemOk ? 'stemGood' : 'branchGood'
  return { tone, mixed, detail: `日主${ctx.natal.natal.day![0]}（${m.strong ? '身強' : '身弱'}：${m.support}/${m.total}）×年干${pillar[0]}・年支${pillar[1]}${dec ? `・大運${dec.d.pillar}` : ''}（${votes}）` }
}
export function toneSentence(ctx: TimelineContext, year: number, pillar: string): { text: string; detail: string } {
  const D = depthParts()
  const { tone, mixed, detail } = yearTone(ctx, year, pillar)
  // rotate by how many earlier years since age 18 had the same reading (range-independent)
  const same = (y: number) => { const t = yearTone(ctx, y, pillarOf(y)); return t.tone === tone && t.mixed === mixed }
  let seen = 0
  for (let y = ctx.birthYear + 18; y < year; y++) if (same(y)) seen++
  const list: string[] = mixed ? D.toneMixed[mixed] : D.tone[tone]
  return { text: list[seen % list.length], detail }
}
const pillarOf = (y: number) => PILLARS[CYCLE(y)]

/** Title, ordinal and group of the 10-year pillar containing Jul 1 (for the couple view). */
export function decadeInfo(ctx: TimelineContext, year: number, chapterTitles: Record<string, { title: string }>) {
  const hit = decadeOf(ctx, year)
  if (!hit) return null
  const god = tenGod(ctx.natal.natal.day![0], hit.d.pillar[0])
  const title = chapterTitles[god]?.title
  if (!title || !GROUP[god]) return null
  const sy = jstYear(hit.d.start)
  return { title, ordinal: year - sy + (hit.d.start <= Date.UTC(sy, 6, 1, -9) ? 1 : 0), group: GROUP[god], pillar: hit.d.pillar, god }
}

/**
 * Short title for the simple style: the year's theme in a few words.
 * Priority: marriage > trust > relationship (by movement quality) > career > move > chapter start > hint > quiet (ten-god).
 * Quiet titles use the ten-god variant i (same ten-god 10 years apart reads differently); the others rotate by how many
 * earlier years (since birth) had the same title key, so neighbouring same-theme years never share a title.
 */
function titleKey(ctx: TimelineContext, d: YearDecision, nowYear: number): { list: string[]; key: string; rotate: boolean } {
  // the current relationship status says nothing about past years: past titles never assume a partner
  const past = d.signals.year < nowYear
  const T = depthParts().titles
  const w = ctx.input.workContext
  const ck = w === 'employed' || w === 'independent' ? 'work' : w === 'student' ? 'study' : 'other'
  const youth = d.ageBand !== 'adult' && (d.theme === 'relationship' || d.theme === 'trust')
  const partnered = !past && (ctx.input.relationshipStatus === 'partnered' || ctx.input.relationshipStatus === 'married')
  if (youth) return { list: T.youth, key: 'youth', rotate: true }
  if (d.marriage && !past) return { list: T.marriage, key: 'marriage', rotate: true }
  if (d.theme === 'trust') return { list: T.trust, key: 'trust', rotate: true }
  if (d.theme === 'relationship') {
    const q = wordingQuality(d, past) ?? 'none'
    return { list: T.relationship[q], key: `rel:${q}`, rotate: true }
  }
  if (d.theme === 'career') return { list: T.career[ck], key: `career:${ck}`, rotate: true }
  if (d.theme === 'move') return { list: T.move, key: 'move', rotate: true }
  if (d.lifeTurn === 'chapter') return { list: T.chapter, key: 'chapter', rotate: true }
  if (d.theme === 'hint') return { list: partnered ? T.hintPartnered : T.hint, key: partnered ? 'hintP' : 'hint', rotate: true }
  const god = d.signals.tenGod === '印綬' ? '正印' : d.signals.tenGod
  return { list: T.quiet[god], key: `quiet:${god}`, rotate: false }
}
export function shortTitle(ctx: TimelineContext, d: YearDecision, nowYear: number): string {
  const t = titleKey(ctx, d, nowYear)
  const year = d.signals.year
  if (!t.rotate) return t.list[Math.floor(year / 10) % 3]
  let seen = 0
  for (let y = Math.max(1952, ctx.birthYear); y < year; y++) if (titleKey(ctx, decideYear(ctx, y), nowYear).key === t.key) seen++
  return t.list[seen % t.list.length]
}
