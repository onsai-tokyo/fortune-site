import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMultiSystemStudy, composeMultiSystemYear, compareStudyObservations, type StudyEvidence, type SanmeiContext } from './multiSystemStudy.js'
import { MULTI_SYSTEM_PATTERNS, SINGLE_THEME_COPY } from './multiSystemPatterns.js'
import { TIMING_SCORE_KEYS } from '../lib/report/timingClaim.js'

const factor = (id: string, key: StudyEvidence['scoreKey'], family: StudyEvidence['sourceFamily'] = 'stem_branch'): StudyEvidence => ({
  id, scoreKey: key, factLineageId: id, sourceFamily: family, correlationGroup: family === 'stem_branch' ? 'stem_branch_calendar' : family === 'ziwei' ? 'ziwei_chart' : 'astronomical_ephemeris',
  technique: 'synthetic-test', matched: true, available: true, support: 1, maximumContribution: .1, timeBasis: 'synthetic-year',
})
const fixture = { birthYear: 1990, birthMonth: 5, birthDay: 12, birthHour: 10, birthMinute: 0, birthplace: '東京都', gender: 'female' as const }

test('複数テーマのすべてに根拠が必要で、なくなった根拠をfallbackで埋めない', () => {
  const rows = [factor('study', 'education_activation'), factor('career', 'career_activation', 'vedic')]
  assert.ok(composeMultiSystemYear(2024, rows).cards.some(c => c.patternId === 'study-work'))
  for (const missing of [{ available: false, matched: false, support: 0 }, { matched: false, support: 0 }, { support: 0 }, { quality: 0 }]) {
    assert.equal(composeMultiSystemYear(2024, [rows[0], { ...rows[1], ...missing }]).cards.length, 0)
  }
  assert.equal(composeMultiSystemYear(2024, []).cards.length, 0)
})

test('四柱推命と算命学、または西洋とインドだけを独立した二票にしない', () => {
  const context: SanmeiContext = { id: 'phase', family: 'stem_branch', system: '算命学', factor: 'synthetic-calendar', body: 'test' }
  const sameCalendar = [factor('study', 'education_activation'), factor('work', 'career_activation')]
  const calendar = composeMultiSystemYear(2024, sameCalendar, [context])
  assert.equal(calendar.cards[0].relationship, 'single_system')
  assert.equal(calendar.cards[0].groups.length, 1)
  assert.equal(calendar.sanmeiReadings.length, 1)
  const sameAstronomy = [factor('study', 'education_activation', 'western'), factor('work', 'career_activation', 'vedic')]
  assert.equal(composeMultiSystemYear(2024, sameAstronomy).cards[0].groups.length, 1)
  const overlap = composeMultiSystemYear(2024, [factor('w', 'education_activation', 'western'), factor('v', 'education_activation', 'vedic')])
  assert.equal(overlap.themes[0].status, 'related_systems_only')
})

test('同じテーマの一致と、別領域の補完を分け、反証を隠さない', () => {
  const rows = [factor('study', 'education_activation'), factor('career', 'career_activation', 'vedic')]
  const complementary = composeMultiSystemYear(2024, rows).cards[0]
  assert.deepEqual(complementary.agreementThemes, [])
  const shared = composeMultiSystemYear(2024, [...rows, factor('study-v', 'education_activation', 'vedic')]).cards[0]
  assert.deepEqual(shared.agreementThemes, ['education_activation'])
  const mixed = composeMultiSystemYear(2024, [...rows, { ...factor('opposition', 'career_activation', 'ziwei'), polarity: -1 }])
  assert.equal(mixed.cards.length, 0)
  assert.equal(mixed.themes.find(t => t.key === 'career_activation')!.status, 'mixed')
  const reading = mixed.singleReadings.find(r => r.theme === 'career_activation')!
  assert.equal(reading.counterEvidence[0].id, 'opposition')
  assert.ok(reading.qualification)
})

test('18テーマすべてで一つの占術の根拠だけでも本文が出る', () => {
  assert.deepEqual(Object.keys(SINGLE_THEME_COPY).sort(), [...TIMING_SCORE_KEYS].sort())
  for (const family of ['stem_branch', 'vedic', 'western', 'ziwei'] as const) {
    for (const key of TIMING_SCORE_KEYS) {
      const row = factor('single', key, family)
      const result = composeMultiSystemYear(2024, [row, { ...row, id: 'duplicate' }])
      assert.equal(result.singleReadings.length, 1)
      const reading = result.singleReadings[0]
      assert.ok(reading.body.length > 0)
      assert.equal(reading.status, 'single_system')
      assert.deepEqual(reading.evidence.map(e => e.id), ['single', 'duplicate'])
      assert.equal(reading.productionEligible, false)
    }
  }
})

test('算命学の根拠だけでも独立した文章を表示し、出来事の票は作らない', () => {
  const result = composeMultiSystemYear(2024, [], [{ id: 'sanmei', family: 'stem_branch', system: '算命学', factor: '位相法:test', body: '算命学の文章' }])
  assert.equal(result.sanmeiReadings[0].body, '算命学の文章')
  assert.equal(result.singleReadings.length, 0)
  assert.equal(result.cards.length, 0)
})

test('単独表示でも根拠なし・利用不可・品質ゼロを文章で補完しない', () => {
  const row = factor('absent', 'career_activation')
  for (const patch of [{ available: false }, { matched: false }, { support: 0 }, { support: NaN }, { quality: 0 }]) {
    assert.equal(composeMultiSystemYear(2024, [{ ...row, ...patch }]).singleReadings.length, 0)
  }
  const oneFact = composeMultiSystemYear(2024, [row, { ...row, scoreKey: 'education_activation' }])
  assert.equal(oneFact.cards[0].factors.length, 1)
  assert.equal(oneFact.cards[0].relationship, 'single_system')
  assert.deepEqual(oneFact.cards[0].agreementThemes, [])
})

test('全20候補の必要テーマ・根拠参照・研究限定フラグを検証する', () => {
  assert.equal(new Set(MULTI_SYSTEM_PATTERNS.map(p => p.id)).size, MULTI_SYSTEM_PATTERNS.length)
  for (const p of MULTI_SYSTEM_PATTERNS) {
    const rows = p.themes.map((key, index) => factor(`${p.id}:${index}`, key, index === 0 ? 'stem_branch' : 'vedic'))
    const card = composeMultiSystemYear(2024, rows).cards.find(c => c.patternId === p.id)!
    assert.ok(card)
    assert.deepEqual(card.evidence.map(e => e.id), rows.map(e => e.id))
    assert.equal(card.productionEligible, false)
    assert.equal(card.qualityEligible, false)
    for (const row of rows) assert.ok(!composeMultiSystemYear(2024, rows.filter(r => r !== row)).cards.some(c => c.patternId === p.id))
  }
})

test('出生時刻・場所不明を補完せず、年範囲の不正値を拒否する', () => {
  const result = buildMultiSystemStudy({ ...fixture, birthHour: undefined, birthMinute: undefined, birthplace: '' }, 2024, 2024)
  assert.equal(result.dasha.available, false)
  assert.deepEqual(result.dasha.periods, [])
  assert.ok(result.years[0].evidence.filter(e => ['vedic', 'ziwei'].includes(e.sourceFamily)).every(e => !e.available && !e.matched))
  assert.throws(() => buildMultiSystemStudy(fixture, 2026, 2024), /range/)
})

test('申告ラベルを追加・反転しても鑑定候補は変わらず、特定月の的中としない', () => {
  const result = buildMultiSystemStudy(fixture, 2023, 2024)
  const saved = JSON.stringify(result)
  const observations = [{ id: 'synthetic', year: 2024, months: [3, 4], themes: ['relationship_activation' as const], note: 'synthetic positive' }]
  const comparison = compareStudyObservations(result, observations)
  compareStudyObservations(result, [{ ...observations[0], themes: ['relationship_disruption'], note: 'reversed label' }])
  assert.equal(JSON.stringify(result), saved)
  assert.equal(comparison[0].monthlyEventVerified, false)
  assert.equal(comparison[0].eventVerified, false)
  assert.deepEqual(buildMultiSystemStudy({ ...fixture, observations } as typeof fixture, 2023, 2024), result)
  for (const year of result.years) {
    assert.ok(year.evidence.filter(e => e.sourceFamily === 'vedic' && e.available).every(e => e.interval && Date.parse(e.interval.start) < Date.parse(e.interval.end)))
  }
})
