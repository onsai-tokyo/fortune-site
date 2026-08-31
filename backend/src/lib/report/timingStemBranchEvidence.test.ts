import assert from 'node:assert/strict'
import test from 'node:test'
import { calcShichu, calcTimingCycles } from '../divination/index.js'
import { computeTimingScore } from './timingScoreEngine.js'
import { buildStemBranchTimingEvidence } from './timingStemBranchEvidence.js'

const timing = calcTimingCycles(1995, 2, 20, 12, 0, 'female')
const byYear = buildStemBranchTimingEvidence({ birthYear: 1995, birthMonth: 2, birthDay: 20, birthHour: 12, birthMinute: 0, annual: timing.annual, decades: timing.decades })

test('時刻ありでは全対象年へstem_branch 6 Lineageを供給する', () => {
  assert.equal(byYear.size, timing.annual.length)
  assert.ok([...byYear.values()].every(items => items.length === 6 && items.every(item => item.available)))
  assert.equal(new Set([...byYear.values()].flat().map(item => item.factLineageId)).size, 6)
})

test('時刻なしはlineageごとの日界・節入り不変性でavailableを決め、大運を推測しない', () => {
  const untimed = calcTimingCycles(1995, 2, 20, undefined, 0, 'female')
  const values = [...buildStemBranchTimingEvidence({ birthYear: 1995, birthMonth: 2, birthDay: 20, annual: untimed.annual, decades: untimed.decades }).values()].flat()
  assert.equal(new Set(values.filter(item => item.factLineageId.includes('day_branch')).map(item => item.available)).size, 1)
  assert.equal(new Set(values.filter(item => item.factLineageId.includes('month_pillar')).map(item => item.available)).size, 1)
  assert.ok(values.filter(item => item.factLineageId.includes('major_luck_cycle')).every(item => !item.available))
})

test('既存の年運例で日支の破を構造化Evidenceへ変換する', () => {
  const definitions = byYear.get(2023)!
  assert.equal(definitions.find(item => item.factLineageId.endsWith('day_branch:break'))?.matched, true)
  assert.equal(computeTimingScore('relationship_disruption', definitions).rawSupport, 0.16)
})

test('害は既存表示文を変えず構造化Evidenceとして判定する', () => {
  const matched = [...byYear.entries()].find(([, items]) => items.some(item => item.factLineageId.endsWith('day_branch:harm') && item.matched))
  assert.ok(matched)
  const annual = timing.annual.find(item => item.year === matched![0])!
  assert.ok(!annual.relationshipSignals.some(signal => signal.includes('害')))
})

test('月柱の冲・伏吟と大運切替をcareer_activationへ分離する', () => {
  const all = [...byYear.values()].flat()
  assert.ok(all.some(item => item.factLineageId.endsWith('month_pillar:clash') && item.matched))
  assert.ok(all.some(item => item.factLineageId.endsWith('major_luck_cycle:transition') && item.matched))
  const natalMonthKanshi = calcShichu(1995, 2, 20, 12, 0).month.kanshi
  const repeatFixture = buildStemBranchTimingEvidence({
    birthYear: 1995, birthMonth: 2, birthDay: 20,
    birthHour: 12,
    annual: [{ year: 2030, kanshi: natalMonthKanshi }], decades: [],
  }).get(2030)!
  assert.equal(repeatFixture.find(item => item.factLineageId.endsWith('month_pillar:repeat'))?.matched, true)
  const transition = all.find(item => item.factLineageId.endsWith('major_luck_cycle:transition') && item.matched)!
  assert.ok(computeTimingScore('career_activation', byYear.get(Number(transition.id.split(':').at(-1)))!).rawSupport > 0)
})

test('固定日支への流年冲は暦上2年連続しないためclash_consecutiveを生成しない', () => {
  const clashYears = [...byYear.entries()].filter(([, items]) => items.some(item => item.factLineageId.endsWith('day_branch:clash') && item.matched)).map(([year]) => year)
  assert.ok(clashYears.every((year, index) => index === 0 || year - clashYears[index - 1]! !== 1))
  assert.ok([...byYear.values()].flat().every(item => !item.factLineageId.endsWith('clash_consecutive')))
})

test('節入り当日は月柱だけを利用不可にし、通常日は日柱・月柱を利用できる', () => {
  const definitions = (birthMonth: number, birthDay: number) => buildStemBranchTimingEvidence({
    birthYear: 1995, birthMonth, birthDay,
    annual: [{ year: 2030, kanshi: '庚戌' }], decades: [],
  }).get(2030)!
  const boundary = definitions(2, 4)
  assert.ok(boundary.filter(item => item.factLineageId.includes('day_branch')).every(item => item.available))
  assert.ok(boundary.filter(item => item.factLineageId.includes('month_pillar')).every(item => !item.available))
  assert.ok(boundary.filter(item => item.factLineageId.includes('major_luck_cycle')).every(item => !item.available))

  const ordinary = definitions(2, 20)
  assert.ok(ordinary.filter(item => item.factLineageId.includes('day_branch') || item.factLineageId.includes('month_pillar')).every(item => item.available))
})

test('22:59・23:00・23:59・00:00の暦柱境界を固定する', () => {
  const points = [[22, 59], [23, 0], [23, 59], [0, 0]] as const
  const charts = points.map(([hour, minute]) => calcShichu(1995, 2, 20, hour, minute))
  assert.deepEqual(charts.map(chart => chart.day.kanshi), ['壬午', '壬午', '壬午', '壬午'])
  assert.deepEqual(charts.map(chart => chart.month.kanshi), ['戊寅', '戊寅', '戊寅', '戊寅'])
})

test('時刻ありは節入り当日でも選択した瞬間の柱だけを使い全lineageを確定する', () => {
  for (const [birthHour, birthMinute] of [[0, 0], [23, 59]] as const) {
    const values = buildStemBranchTimingEvidence({
      birthYear: 1995, birthMonth: 2, birthDay: 4, birthHour, birthMinute,
      annual: [{ year: 2030, kanshi: '庚戌' }], decades: [{ startYear: 2030, endYear: 2039 }],
    }).get(2030)!
    assert.ok(values.every(item => item.available))
  }
})

test('複数年・全月の節入り周辺で両端判定と日中の暦柱が矛盾しない', () => {
  const points = [[0, 0], [6, 0], [12, 0], [18, 0], [23, 59]] as const
  for (const birthYear of [1990, 2000, 2010, 2020]) {
    for (let birthMonth = 1; birthMonth <= 12; birthMonth += 1) {
      for (let birthDay = 1; birthDay <= 9; birthDay += 1) {
        const charts = points.map(([hour, minute]) => calcShichu(birthYear, birthMonth, birthDay, hour, minute))
        const dayValues = new Set(charts.map(chart => chart.day.kanshi))
        const monthValues = new Set(charts.map(chart => chart.month.kanshi))
        const evidence = buildStemBranchTimingEvidence({
          birthYear, birthMonth, birthDay,
          annual: [{ year: 2030, kanshi: '庚戌' }], decades: [],
        }).get(2030)!
        const dayAvailable = evidence.filter(item => item.factLineageId.includes('day_branch')).every(item => item.available)
        const monthAvailable = evidence.filter(item => item.factLineageId.includes('month_pillar')).every(item => item.available)
        assert.equal(dayAvailable, dayValues.size === 1, `${birthYear}-${birthMonth}-${birthDay}: day`)
        assert.equal(monthAvailable, monthValues.size === 1, `${birthYear}-${birthMonth}-${birthDay}: month`)
      }
    }
  }
})
