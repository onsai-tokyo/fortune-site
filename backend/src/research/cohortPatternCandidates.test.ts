import test from 'node:test'
import assert from 'node:assert/strict'
import { occurrenceWindow, candidateFeatures, mineCohortCandidates, matchCandidate, type CohortObservation } from './cohortPatternCandidates.js'
import type { EventFact } from './eventPatternRules.js'
import { cohortBirthContext, supplementalSanmeiFacts } from './cohortSupplementalFacts.js'

const western = (day = '2024-02-01'): EventFact => ({ id: 'western:土星:金星:90', lineage: 'aspect', system: '西洋占星術',
  group: 'astronomical_ephemeris', kind: 'western_transit', transit: '土星', natal: '金星', aspect: 90,
  days: [day], detail: 'synthetic', themes: [] })
const ziwei = (day = '2024-02-01'): EventFact => ({ id: 'ziwei:甲辰:life:夫妻', lineage: 'palace', system: '紫微斗数',
  group: 'ziwei_chart', kind: 'ziwei_palace', palace: '夫妻', days: [day], detail: 'synthetic', themes: [] })
const row = (id: string, personID = id, category = '結婚'): CohortObservation => ({ id, personID, category,
  precision: 'month', window: { from: '2024-02-01', until: '2024-03-01' }, facts: [western(), ziwei()] })

test('date precision is preserved, invalid dates/years and occurrence-free publication rows rejected', () => {
  assert.deepEqual(occurrenceWindow('2024', '2024-02-29'), { precision: 'day', window: { from: '2024-02-29', until: '2024-03-01' } })
  assert.deepEqual(occurrenceWindow('2024', '2024-02').window, { from: '2024-02-01', until: '2024-03-01' })
  assert.equal(occurrenceWindow('2024', '').precision, 'year')
  for (const [y, d] of [['', '2024-02-01'], ['2023','2024-02-01'], ['2023','2023-02-29'], ['2024','2024-13'], ['2024','2024-02-30']])
    assert.throws(() => occurrenceWindow(y, d))
})
test('disjoint dates do not produce a pair, including at year precision', () => {
  const a = row('one'), b = row('two'); a.facts[1] = ziwei('2024-02-02'); b.facts[1] = ziwei('2024-02-02')
  assert.ok(mineCohortCandidates([a, b]).candidates.every(c => c.allOf.length === 1))
  assert.deepEqual(matchCandidate({ allOf: ['western:土星:金星:90','ziwei:life:夫妻'] }, a.facts), [])
})
test('single sources remain; repeated person and repeated family are not two independent examples', () => {
  assert.equal(mineCohortCandidates([row('one')]).candidates.length, 2)
  assert.equal(mineCohortCandidates([row('one'), row('two')]).candidates.length, 3)
  assert.equal(mineCohortCandidates([row('one','same'), row('two','same')]).candidates.length, 2)
  const family = [row('one'),row('two')].map(r => ({ ...r, independenceUnit: 'same-family' }))
  assert.equal(mineCohortCandidates(family).candidates.length, 2)
})
test('opposite observed outcomes and precision are retained; they do not alter applicability', () => {
  const events = [row('one'),row('two'), { ...row('three','three','離婚'), precision: 'year' as const }]
  const candidate = mineCohortCandidates(events).candidates.find(c => c.allOf.length === 2)!
  assert.equal(candidate.hasOpposingRelationshipOutcomes, true)
  assert.equal(candidate.categories.find(c => c.category === '離婚')?.precision.year.people, 1)
  assert.equal(candidate.productionEligible, false)
  assert.equal(candidate.probability, null)
  assert.deepEqual(matchCandidate(candidate, events[0].facts), ['2024-02-01'])
  assert.deepEqual(candidate.allOf, mineCohortCandidates(events.map(e => ({ ...e, category: '仕事' }))).candidates.find(c => c.allOf.length === 2)!.allOf)
})
test('same underlying Vedic period cannot corroborate its own house interpretation', () => {
  const v: EventFact = { ...western(), id: 'vedic', lineage:'same-period', kind:'vedic_period', system:'インド占星術',
    period:{ start:'2024-01-01',end:'2025-01-01',major:'Jupiter',minor:'Venus' }, houses:[7] }
  const features = candidateFeatures([v]); assert.equal(features.length, 2)
  assert.deepEqual(matchCandidate({ allOf:features.map(f => f.key) }, [v]), [])
  assert.ok(mineCohortCandidates([row('a'),row('b')].map(r => ({ ...r, facts:[v] }))).candidates.every(c => c.allOf.length === 1))
})
test('general features retain calendar scope and actual mutagen star, with no event year or identity', () => {
  const cal: EventFact = { ...western(), id:'calendar:month:乙卯:day-午:破', kind:'calendar_relation', system:'四柱推命・算命学', group:'stem_branch_calendar', detail:'月柱乙卯と日支午：破' }
  const z: EventFact = { ...ziwei(), id:'ziwei:甲辰:武曲:化科:夫妻', kind:'ziwei_mutagen', mutagen:'化科' }
  assert.deepEqual(candidateFeatures([cal,z]).map(f => f.key), ['calendar:month:破','ziwei:武曲:化科:夫妻'])
})
test('opposite axis ends are one geometry, not two different corroborating features', () => {
  const asc={...western(),id:'asc',natal:'ASC',aspect:60},desc={...western(),id:'desc',natal:'DESC',aspect:120}
  assert.equal(new Set(candidateFeatures([asc,desc]).map(f=>f.key)).size,1)
  const results=mineCohortCandidates([row('a'),row('b')].map(r=>({...r,facts:[asc,desc]})))
  assert.equal(results.candidates.length,1)
  assert.equal(results.candidates[0].supports.length,2)
})
test('duplicate IDs and out-of-window facts fail, deterministic mining is order-independent', () => {
  assert.throws(() => mineCohortCandidates([row('a'),row('a')]), /Duplicate/)
  assert.throws(() => mineCohortCandidates([{ ...row('a'), facts:[western('2024-03-01')] }]), /outside/)
  const a = mineCohortCandidates([row('a'),row('b')]), b = mineCohortCandidates([row('b'),row('a')])
  assert.deepEqual(a.candidates.map(c => [c.id,c.categories,c.people]), b.candidates.map(c => [c.id,c.categories,c.people]))
})
test('supplemental Sanmei facts follow actual solar-term dates; natal classes cannot vote for an event', () => {
  const birth = { birthYear:1990, birthMonth:5, birthDay:12, birthHour:10, birthMinute:0, birthplace:'東京都', gender:'female' as const }
  const context = cohortBirthContext(birth)
  assert.equal(context.timingInferenceForNatalClasses, false)
  assert.ok(context.nayin && context.sukuyo && context.kyusei.yearStar)
  const window = { from:'2024-08-05',until:'2024-08-10' }
  const facts = supplementalSanmeiFacts(birth,window)
  assert.deepEqual(facts.map(f => [f.id,f.days]), [['sanmei:month:chusatsu',['2024-08-07','2024-08-08','2024-08-09']]])
  assert.deepEqual(facts, supplementalSanmeiFacts({ ...birth, observations:['結婚'] } as typeof birth, window))
  assert.ok(facts.every(f => f.days.every(d => d >= window.from && d < window.until)))
  assert.ok(candidateFeatures(facts).every(f => f.key.startsWith('sanmei:') && f.group === 'stem_branch_calendar'))
})
