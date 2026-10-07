/**
 * Timeline v3 — the person's own life events (年表) woven into the year cards (v2.13; parts: eventParts.json `timeline`).
 * Wording only: events never change a judgement, a rule or the birth time (see EVENTS.md §1).
 *   event years: what the person entered + how the year's ten-god reads that event (eventParts.readings, 2nd sentence)
 *                and, for past years, a reflection question about that event instead of the generic one.
 *   other years: "n years since …" for the latest relationship event (relationship-themed years or milestone counts)
 *                or a recent job change (career years, up to 3 years).
 */
import type { ReportCardEvidence } from '../../reportCards.js'
import { yearSignals, type TimelineContext, type YearDecision } from './signals.js'
import { readFileSync } from 'node:fs'
import type { LifeEvent } from './eventKinds.js'

let EP: any
// read here (not via events.ts) to keep compose → lifeline free of an import cycle
const eventParts = () => (EP ??= JSON.parse(readFileSync(new URL('./data/eventParts.json', import.meta.url), 'utf8')))
export const eventTimeline = (): any => eventParts().timeline
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
const REL_BEGIN = ['encounter', 'start', 'reunion'], REL_CLOSE = ['breakup', 'divorce']
const FAMILY_ORDER = ['relationship', 'career', 'move', 'other']
const MILESTONES = new Set([1, 3, 5, 10, 15, 20, 25, 30, 40, 50])

export interface LifeLines { inYear: string | null; reading: string | null; anchor: string | null; reflection: string | null; hasRelationship: boolean; hasCareer: boolean; evidence: ReportCardEvidence[] }

export function lifeLines(ctx: TimelineContext, d: YearDecision, year: number, nowYear: number): LifeLines | null {
  const all: LifeEvent[] = (ctx.input.lifeEvents ?? []).filter(e => e.year <= nowYear)
  if (!all.length) return null
  const E = eventParts(), T = E.timeline
  const here = all.filter(e => e.year === year)
  const out: LifeLines = { inYear: null, reading: null, anchor: null, reflection: null, hasRelationship: false, hasCareer: false, evidence: [] }
  if (here.length) {
    const famRank = (e: LifeEvent) => FAMILY_ORDER.indexOf(E.kinds[e.kind].family)
    const labels = [...new Set([...here].sort((a, b) => famRank(a) - famRank(b)).map(e => T.short[e.kind]))].join('と')
    out.inYear = here.length === 1 && here[0].month ? fill(T.inYearMonth, { month: here[0].month, labels }) : fill(T.inYear, { labels })
    const primary = [...here].sort((a, b) => FAMILY_ORDER.indexOf(E.kinds[a.kind].family) - FAMILY_ORDER.indexOf(E.kinds[b.kind].family))[0]
    const kind = E.kinds[primary.kind]
    if (kind.direction !== 'other') {
      const baziYear = primary.month === 1 ? year - 1 : year
      const god = yearSignals(ctx, baziYear).tenGod
      out.reading = String(E.readings[god][kind.direction]).split(/(?<=。)/)[1] ?? null
    }
    if (year < nowYear) { const list: string[] = T.reflection[kind.family]; out.reflection = fill(list[year % list.length], { label: T.short[primary.kind] }) }
    out.hasRelationship = here.some(e => E.kinds[e.kind].family === 'relationship')
    out.hasCareer = here.some(e => E.kinds[e.kind].family === 'career')
    for (const e of here) out.evidence.push({ family: 'timeline-v3-event', system: '四柱推命', detail: `年表：${e.year}年${e.month ? `${e.month}月` : ''} ${E.kinds[e.kind].label}` })
    return out
  }
  // no event this year: how long since the latest relationship event, else a recent change of work
  const relTheme = d.theme === 'relationship' || d.theme === 'trust' || d.theme === 'hint'
  const lastRel = [...all].reverse().find(e => e.year < year && E.kinds[e.kind].family === 'relationship')
  const lastJob = [...all].reverse().find(e => e.year < year && E.kinds[e.kind].family === 'career')
  let anchor: { e: LifeEvent; key: string } | null = null
  if (lastRel) {
    const k = year - lastRel.year
    const key = lastRel.kind === 'marriage' ? 'marriage' : REL_CLOSE.includes(lastRel.kind) ? 'close' : REL_BEGIN.includes(lastRel.kind) ? 'begin' : null
    if (key && (key === 'close' ? relTheme && k <= 3 : relTheme || MILESTONES.has(k))) anchor = { e: lastRel, key }
  }
  if (!anchor && lastJob && d.career && year - lastJob.year <= 3) anchor = { e: lastJob, key: 'career' }
  if (!anchor) return null
  const k = year - anchor.e.year
  out.anchor = fill(T.since[anchor.key][MILESTONES.has(k) && k > 1 ? 'milestone' : 'plain'], { year: anchor.e.year, label: T.short[anchor.e.kind], k })
  out.evidence.push({ family: 'timeline-v3-event', system: '四柱推命', detail: `年表：${anchor.e.year}年 ${E.kinds[anchor.e.kind].label}から${k}年` })
  return out
}

export interface PairLifeLines { inYear: string | null; anchor: string | null; reflection: string | null; evidence: ReportCardEvidence[] }
/**
 * Couple view (v2.14): only YOUR relationship events from the meeting year on are used (earlier ones may concern someone
 * else; the partner's own 年表 is unknown). Encounters are left out (the meeting year is its own input). Not used for
 * crush / friend / family. Wording only.
 */
export function pairLifeLines(a: TimelineContext, status: string, meetingYear: number | null, pairMoving: boolean, year: number, nowYear: number): PairLifeLines | null {
  if (meetingYear === null || !['partnered', 'engaged', 'married', 'former'].includes(status)) return null
  const E = eventParts(), T = E.timeline
  const evs: LifeEvent[] = (a.input.lifeEvents ?? []).filter(e => e.year >= meetingYear && e.year <= nowYear && E.kinds[e.kind].family === 'relationship' && e.kind !== 'encounter')
  const out: PairLifeLines = { inYear: null, anchor: null, reflection: null, evidence: [] }
  const here = evs.filter(e => e.year === year)
  if (here.length) {
    const labels = [...new Set(here.map(e => T.short[e.kind]))].join('と')
    out.inYear = here.length === 1 && here[0].month ? fill(T.inYearMonth, { month: here[0].month, labels }) : fill(T.inYear, { labels })
    if (year < nowYear) {
      const last = here.at(-1)!
      out.reflection = `ご自身の年表にある${T.short[last.kind]}を、今はどう振り返りますか。`
    }
    for (const e of here) out.evidence.push({ family: 'timeline-v3-couple', system: '四柱推命', detail: `年表：${e.year}年${e.month ? `${e.month}月` : ''} ${E.kinds[e.kind].label}` })
    return out
  }
  if (year <= meetingYear) return null
  const last = [...evs].reverse().find(e => e.year < year)
  const anchor = last ?? { year: meetingYear, kind: 'encounter' as const }
  const k = year - anchor.year
  const key = anchor.kind === 'marriage' ? 'marriage' : REL_CLOSE.includes(anchor.kind) ? 'close' : 'begin'
  if (key === 'close' ? !(pairMoving && k <= 3) : !(pairMoving || MILESTONES.has(k))) return null
  const label = anchor.kind === 'encounter' ? T.pairMeetingLabel : T.short[anchor.kind]
  out.anchor = last ? `ご自身の年表にある${anchor.year}年の${label}から、${k}年がたつ年です。` : fill(T.since[key][MILESTONES.has(k) && k > 1 ? 'milestone' : 'plain'], { year: anchor.year, label, k })
  out.evidence.push({ family: 'timeline-v3-couple', system: '四柱推命', detail: `年表：${anchor.year}年 ${anchor.kind === 'encounter' ? '出会った年（入力）' : E.kinds[anchor.kind].label}から${k}年` })
  return out
}
