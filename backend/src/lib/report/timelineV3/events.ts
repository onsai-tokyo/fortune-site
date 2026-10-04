/**
 * Timeline v3 — reading of user-entered past events (年表入力の読み解き).
 * - Uses the SAME signals as the timeline. Never changes signals, birth time or rules from events.
 * - Interpretation, not a hit/miss claim. See docs/timeline-v3/EVENTS.md.
 */
import { readFileSync } from 'node:fs'
import type { ReportCardEvidence, ReportSection } from '../../reportCards.js'
import { decideYear, timelineContext, yearSignals, type TimelineContext, type TimelineV3Input } from './signals.js'
import { formatMonth } from './vedic.js'
import { parts } from './compose.js'
import { TIMELINE_V3_VERSION } from './version.js'

import { EVENT_KINDS, type EventKind, type LifeEvent } from './eventKinds.js'
export { EVENT_KINDS }
export type { EventKind, LifeEvent }
export interface EventReading {
  id: string; year: number; month?: number; kind: EventKind
  title: string; sections: ReportSection[]; evidence: ReportCardEvidence[]
  overlap: boolean; nextYears: number[]
  meta: { version: string; partsVersion: string; eventPartsVersion: string; baziYear: number; hits: string[] }
}

let EP: any
export function eventParts(): any {
  EP ??= JSON.parse(readFileSync(new URL('./data/eventParts.json', import.meta.url), 'utf8'))
  return EP
}
const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))
const pastize = (s: string) => s.replace(/年です。$/, '年でした。')

export function parseLifeEvent(x: unknown, birthYear: number, nowYear: number): LifeEvent | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const year = Number(o.year), month = o.month === undefined || o.month === null ? undefined : Number(o.month)
  if (!Number.isInteger(year) || year < birthYear || year > nowYear) return null
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) return null
  if (typeof o.kind !== 'string' || !(EVENT_KINDS as readonly string[]).includes(o.kind)) return null
  return { year, ...(month ? { month } : {}), kind: o.kind as EventKind }
}

/** R1 check at the event month (15th, JST) when the month is known; otherwise the year-level signal. */
function r1AtEvent(ctx: TimelineContext, ev: LifeEvent) {
  if (!ctx.vedic || !ctx.gender) return null
  const lord = ctx.gender === 'female' ? 'Jupiter' : 'Venus'
  if (ev.month) {
    const t = Date.UTC(ev.year, ev.month - 1, 15, 3)
    return ctx.vedic.dashas.find(d => d.ad === lord && d.start <= t && t < d.end) ?? null
  }
  return yearSignals(ctx, ev.year).relationship.r1Periods[0] ?? null
}

function nextYears(ctx: TimelineContext, family: string, nowYear: number): number[] {
  const out: number[] = []
  for (let y = nowYear + 1; y <= nowYear + 15 && out.length < 2; y++) {
    if (y > 2100) break
    const d = decideYear(ctx, y)
    if (family === 'relationship' ? (d.theme === 'relationship' || d.theme === 'trust') : family === 'career' ? d.career : family === 'move' ? d.move : false) out.push(y)
  }
  return out
}

export function readLifeEvent(ctx: TimelineContext, ev: LifeEvent, nowYear: number): EventReading {
  const P = parts(), E = eventParts()
  const kind = E.kinds[ev.kind]
  const family: 'relationship' | 'career' | 'move' | 'other' = kind.family
  // 四柱推命の年：1月は前年の干支。2月は立春の前後があり得るので当年として扱い、注記する。
  const baziYear = ev.month === 1 ? ev.year - 1 : ev.year
  const s = yearSignals(ctx, baziYear)
  const g = P.tenGods[s.tenGod]
  const i = Math.floor(baziYear / 10) % 3

  // 1. event
  const eventText = [ev.month ? fill(E.restate.withMonth, { year: ev.year, month: ev.month, label: kind.label }) : fill(E.restate.yearOnly, { year: ev.year, label: kind.label })]
  if (ev.month === 1) eventText.push(fill(E.boundary.january, { prev: baziYear }))
  if (ev.month === 2) eventText.push(fill(E.boundary.february, { year: ev.year }))

  // 2. the year from the chart
  const hits: string[] = []
  const evidence: ReportCardEvidence[] = [{ family: 'timeline-v3-event', system: '四柱推命', detail: `年柱${s.pillar}・年干の十神＝${s.tenGod}` }]
  const yearText: string[] = []
  if (family === 'relationship') {
    const r1 = r1AtEvent(ctx, ev)
    if (r1) { hits.push('TL3-R1'); yearText.push(fill(E.hits[ctx.gender === 'female' ? 'TL3-R1_female' : 'TL3-R1_male'], { start: formatMonth(r1.start), end: formatMonth(r1.end) })); evidence.push({ family: 'timeline-v3-event', system: 'インド占星術', detail: `アンタルダシャー${r1.ad}（${formatMonth(r1.start)}〜${formatMonth(r1.end)}）` }) }
    for (const h of s.relationship.hits) if (h.id !== 'TL3-R1') { hits.push(h.id); yearText.push(E.hits[h.id]); evidence.push({ family: 'timeline-v3-event', system: h.system, detail: `${h.id}：${h.detail}` }) }
  } else if (family === 'career' || family === 'move') {
    for (const h of s[family].hits) { hits.push(h.id); yearText.push(E.hits[h.id]); evidence.push({ family: 'timeline-v3-event', system: h.system, detail: `${h.id}：${h.detail}` }) }
  }
  const d = decideYear(ctx, baziYear)
  const overlap = family === 'relationship' ? (hits.includes('TL3-R1') || d.theme === 'relationship' || d.theme === 'trust')
    : family === 'career' ? d.career : family === 'move' ? d.move : false
  const yearBody = overlap ? [E.overlap[family], ...yearText] : [E.noOverlap[family], ...(yearText.length ? [E.partialHits, ...yearText] : [])]
  const nearChapter = [baziYear - 1, baziYear, baziYear + 1].some(y => yearSignals(ctx, y).chapterStarts.length > 0)
  if (nearChapter) yearBody.push(E.chapterNear)
  yearBody.push(E.disclaimer)

  // 3. reading
  const reading = kind.direction === 'other' ? pastize(g.light[i]) : E.readings[s.tenGod][kind.direction]

  // 4. next
  const nexts = family === 'other' ? [] : nextYears(ctx, family, nowYear)
  const nextText = family === 'other' ? null : nexts.length ? fill(E.next[family], { years: nexts.join('年・') }) : E.next.none

  const H = E.sectionHeadings
  const sections: ReportSection[] = [
    { heading: H.event, body: eventText.join(''), evidence: [], termGloss: [] },
    { heading: H.year, body: yearBody.join(''), evidence, termGloss: [] },
    { heading: H.reading, body: reading, evidence: [], termGloss: [] },
    ...(nextText ? [{ heading: H.next, body: nextText, evidence: [], termGloss: [] }] : []),
  ]
  return {
    id: `life-event-${ev.year}-${ev.month ?? 0}-${ev.kind}`, year: ev.year, ...(ev.month ? { month: ev.month } : {}), kind: ev.kind,
    title: fill(E.titles, { year: ev.year, label: kind.label }), sections, evidence, overlap, nextYears: nexts,
    meta: { version: TIMELINE_V3_VERSION, partsVersion: P.version, eventPartsVersion: E.version, baziYear, hits },
  }
}

export function readLifeEvents(input: TimelineV3Input, events: unknown[], nowYear: number): EventReading[] {
  const ctx = timelineContext(input)
  if (!ctx) return []
  const valid = events.map(e => parseLifeEvent(e, ctx.birthYear, nowYear)).filter((e): e is LifeEvent => !!e)
  valid.sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0))
  return valid.map(e => readLifeEvent(ctx, e, nowYear))
}

/**
 * Anonymised validation record. Only with explicit consent. No free text, no names, no account id.
 * Birth place is reduced to the prefecture.
 */
export function toValidationRecord(input: TimelineV3Input, events: LifeEvent[]) {
  const pref = input.birthplace?.match(/^(北海道|東京都|京都府|大阪府|.{2,3}県)/)?.[1]
  return {
    schema: 'timeline-v3-validation-1',
    birthDate: input.birthDate, birthTime: input.birthTime ?? null, prefecture: pref ?? null,
    gender: input.gender === 'female' || input.gender === 'male' ? input.gender : null,
    events: events.map(e => ({ kind: e.kind, year: e.year, month: e.month ?? null })),
  }
}
