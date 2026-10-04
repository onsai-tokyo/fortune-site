import { writeFileSync } from 'node:fs'
import { timelineV3Cards } from '../lib/report/timelineV3/compose.js'
import { TIMELINE_V3_SAMPLES, SAMPLE_RANGE, SAMPLE_EVENTS, COUPLE_SAMPLES } from '../lib/report/timelineV3/samples.js'
import { buildCoupleTimelineV3 } from '../lib/report/timelineV3/couple.js'
import { readLifeEvents } from '../lib/report/timelineV3/events.js'
export const summarize = (c: any) => ({ id: c.id, title: c.title, tags: c.tags, sections: c.sections.map((s: any) => ({ heading: s.heading, body: s.body })), evidence: c.evidence.map((e: any) => e.detail), decision: c.timelineV3Calculation.decision })
for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
  const cards = timelineV3Cards(input, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear)
  writeFileSync(new URL(`../lib/report/timelineV3/fixtures/${name}.json`, import.meta.url), JSON.stringify({ input, range: SAMPLE_RANGE, cards: cards.map(summarize) }, null, 1) + '\n')
  console.log(name, cards.length)
}
for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
  const readings = readLifeEvents(input, SAMPLE_EVENTS[name] ?? [], SAMPLE_RANGE.nowYear)
  writeFileSync(new URL(`../lib/report/timelineV3/fixtures/events_${name}.json`, import.meta.url), JSON.stringify({ input, events: SAMPLE_EVENTS[name], nowYear: SAMPLE_RANGE.nowYear, readings }, null, 1) + '\n')
}
for (const [name, c] of Object.entries(COUPLE_SAMPLES)) {
  const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style: 'detailed' })
  writeFileSync(new URL(`../lib/report/timelineV3/fixtures/couple_${name}.json`, import.meta.url), JSON.stringify({ sample: c, referenceYear: SAMPLE_RANGE.nowYear, timeline: { ...r, entries: r.entries.map(e => ({ ...e, card: e.card && summarizeCouple(e.card) })) } }, null, 1) + '\n')
}
function summarizeCouple(c: any) { return { id: c.id, title: c.title, tags: c.tags, sections: c.sections.map((s: any) => ({ heading: s.heading, body: s.body })), evidence: c.evidence.map((e: any) => e.detail), decision: c.coupleV3Calculation.decision } }
// simple style (the app default): one paragraph per year
const simpleOf = (c: any) => ({ id: c.id, title: c.title, tags: c.tags, summary: c.summary })
for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
  const cards = timelineV3Cards(input, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear, 'simple')
  writeFileSync(new URL(`../lib/report/timelineV3/fixtures/simple_${name}.json`, import.meta.url), JSON.stringify({ input, range: SAMPLE_RANGE, cards: cards.map(simpleOf) }, null, 1) + '\n')
}
for (const [name, c] of Object.entries(COUPLE_SAMPLES)) {
  const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear })
  writeFileSync(new URL(`../lib/report/timelineV3/fixtures/simple_couple_${name}.json`, import.meta.url), JSON.stringify({ sample: c, referenceYear: SAMPLE_RANGE.nowYear, cards: r.entries.filter(e => e.card).map(e => simpleOf(e.card)) }, null, 1) + '\n')
}
// v2.13: the same samples with their 年表 (life events) woven into the year cards (simple style)
for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
  const events = SAMPLE_EVENTS[name]
  if (!events) continue
  const cards = timelineV3Cards({ ...input, lifeEvents: events as any }, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear, 'simple')
  writeFileSync(new URL(`../lib/report/timelineV3/fixtures/simple_life_${name}.json`, import.meta.url), JSON.stringify({ input, events, range: SAMPLE_RANGE, cards: cards.map(simpleOf) }, null, 1) + '\n')
}
