import assert from 'node:assert/strict'
import test from 'node:test'
import { composeEventPatterns, type EventFact } from './eventPatternRules.js'
import { buildEventPatternStudy, eventWindowDays, housesForLord, themesForHouses } from './eventPatternStudy.js'

const fact = (id: string, themes: EventFact['themes'], days = ['2024-03-01']): EventFact => ({
  id, lineage: id, system: '西洋占星術', group: 'astronomical_ephemeris', kind: 'western_transit', detail: 'synthetic', days, themes,
})
test('P01/P08: one calendar fact admits prose, with no fixed relationship outcome or duplicate calendar vote', () => {
  const f: EventFact = { ...fact('calendar', ['relationship.review']), kind: 'calendar_relation', system: '四柱推命・算命学', group: 'stem_branch_calendar' }
  const result = composeEventPatterns([f, f])
  assert.equal(result.readings.length, 1)
  assert.equal(result.readings[0].factCount, 1)
  assert.deepEqual(result.readings[0].systems, ['四柱推命・算命学'])
  assert.ok(result.readings[0].rules.includes('P01'))
  assert.equal(result.readings[0].outcome, 'undetermined')
  assert.ok(result.unsupportedAttributes.includes('first_relationship'))
  assert.equal(result.productionEligible, false)
  assert.throws(() => composeEventPatterns([f, { ...f, detail: 'conflicting' }]), /Conflicting/)
})
test('P02: Saturn Venus hard means review, not breakup, and event labels cannot select its conclusion', () => {
  const f = { ...fact('sv', ['relationship.review']), transit: '土星', natal: '金星', aspect: 0 }
  const before = composeEventPatterns([f])
  assert.ok(before.readings[0].rules.includes('P02'))
  assert.equal(before.readings[0].outcome, 'undetermined')
  const withStory = { ...f, observedEvent: 'marriage', subject: 'synthetic' }
  assert.deepEqual(composeEventPatterns([withStory]).readings.map(r => [r.id, r.title, r.body, r.outcome]),
    before.readings.map(r => [r.id, r.title, r.body, r.outcome]))
})
test('P03: house roles are personal to the ascendant, not a universal Venus romance rule', () => {
  assert.deepEqual(housesForLord(8, 'Mercury'), [7, 10])
  assert.deepEqual(housesForLord(8, 'Venus'), [6, 11])
  assert.deepEqual(themesForHouses([6, 11]), ['career.activity', 'money.conditions'])
  assert.deepEqual(housesForLord(7, 'Saturn'), [3, 4])
  const f = { ...fact('mercury', themesForHouses([7, 10])), kind: 'vedic_period' as const, system: 'インド占星術' as const, houses: [7, 10] }
  const combination = composeEventPatterns([f]).combinations.find(c => c.id === 'work-and-relationships')!
  assert.equal(combination.factCount, 1)
  assert.deepEqual(combination.multiSystemDays, [])
})
test('P04: single home support is displayed, related astronomy is not independent corroboration', () => {
  const w = fact('ic', ['home.establish'])
  const v = { ...fact('house4', ['home.establish']), system: 'インド占星術' as const, kind: 'vedic_period' as const }
  assert.ok(composeEventPatterns([w]).readings[0].rules.includes('P04'))
  const related = composeEventPatterns([w, v]).readings[0]
  assert.equal(related.multiSystemDays.length, 1)
  assert.deepEqual(related.crossGroupDays, [])
  const z = { ...fact('home', ['home.establish']), system: '紫微斗数' as const, group: 'ziwei_chart' as const, kind: 'ziwei_palace' as const }
  assert.equal(composeEventPatterns([w, v, z]).readings[0].crossGroupDays.length, 1)
})
test('P05: palace activation and difficulties remain together; neither implies marriage or divorce', () => {
  const z: EventFact = { ...fact('spouse', ['relationship.structure', 'relationship.review']), kind: 'ziwei_mutagen', system: '紫微斗数', group: 'ziwei_chart', palace: '夫妻', mutagen: '化忌' }
  const result = composeEventPatterns([z])
  assert.deepEqual(result.readings.map(r => r.id).sort(), ['relationship.review', 'relationship.structure'])
  assert.ok(result.readings.every(r => r.outcome === 'undetermined' && r.rules.includes('P05')))
})
test('P06/P07: disjoint dates do not make a simultaneous combination', () => {
  const contact = fact('contact', ['relationship.contact'], ['2024-03-01'])
  const review = fact('review', ['relationship.review'], ['2024-03-31'])
  const result = composeEventPatterns([contact, review])
  assert.equal(result.readings.length, 2)
  assert.deepEqual(result.combinations, [])
  assert.deepEqual(composeEventPatterns([contact, { ...review, days: ['2024-03-01', '2024-03-31'] }]).combinations[0].days, ['2024-03-01'])
  assert.deepEqual(composeEventPatterns([]).readings, [])
  assert.deepEqual(composeEventPatterns([{ ...contact, days: [] }]).readings, [])
})
test('period validation preserves leap days, excludes the terminal date, and rejects invalid windows', () => {
  assert.deepEqual(eventWindowDays({ from: '2024-02-28', until: '2024-03-01' }), ['2024-02-28', '2024-02-29'])
  for (const w of [{ from: '2023-02-29', until: '2023-03-01' }, { from: '2024-01-01', until: '2024-01-01' }, { from: '2023-01-01', until: '2025-01-01' }]) assert.throws(() => eventWindowDays(w), RangeError)
})

const birth = { birthYear: 1990, birthMonth: 5, birthDay: 12, birthHour: 10, birthMinute: 0, birthplace: '東京都', gender: 'female' as const }
test('calculation uses actual calendar window and does not depend on observations or current output labels', () => {
  const window = { from: '2024-01-15', until: '2024-01-17' }
  const result = buildEventPatternStudy(birth, window)
  assert.ok(result.facts.length)
  assert.ok(result.facts.every(f => f.days.every(d => d >= window.from && d < window.until)))
  assert.ok(result.facts.filter(f => f.kind === 'ziwei_palace').every(f => f.detail.includes('癸卯')))
  const labeled = { ...birth, name: 'not-an-input', observations: [{ year: 2024, note: 'marriage' }] }
  assert.deepEqual(buildEventPatternStudy(labeled, window), result)
})
test('unknown time never admits Moon, angles, Ziwei or house/dasha prose', () => {
  const result = buildEventPatternStudy({ ...birth, birthHour: undefined, birthMinute: undefined, birthplace: '' }, { from: '2024-04-01', until: '2024-04-03' })
  assert.equal(result.dasha.available, false)
  assert.equal(result.housesStable, false)
  assert.ok(result.facts.every(f => f.system !== '紫微斗数' && f.kind !== 'vedic_period'))
  assert.ok(result.facts.every(f => !['月', 'ASC', 'DESC', 'MC', 'IC'].includes(f.natal ?? '')))
})
