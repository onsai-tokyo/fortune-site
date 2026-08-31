import assert from 'node:assert/strict'
import test from 'node:test'
import { calcTimeIndependentVedicAnnualDasha, calcVedicAnnualDasha, type VedicAnnualDasha } from '../astrology.js'
import { computeTimingScore } from './timingScoreEngine.js'
import { buildVedicTimingEvidence } from './timingVedicEvidence.js'

test('月宿が同じでも43年系列が時刻候補で変わる日は利用不可にする', () => {
  const annual = calcTimeIndependentVedicAnnualDasha(1995, 3, 13)
  assert.equal(annual.length, 43)
  assert.ok(annual.every(item => !item.available && !item.mahadashaLord && !item.antardashaLord))
  assert.deepEqual(calcTimeIndependentVedicAnnualDasha(1995, 3, 13), annual)
})

test('金星期のケートゥ／ラーフだけを恋愛領域Evidenceとして発火する', () => {
  const definitions = buildVedicTimingEvidence(calcVedicAnnualDasha(1995, 3, 13, 12, 0, '東京都'))
  const matched = [...definitions.values()].flat().filter(item => item.matched && item.scoreKey !== 'career_activation' && item.factLineageId.includes('antardasha'))
  assert.ok(matched.length > 0)
  assert.ok(matched.every(item => /ketu|rahu/.test(item.factLineageId)))
})

test('時刻ありではマハーダシャー切替と10室アンタルを別根拠として扱う', () => {
  const definitions = buildVedicTimingEvidence(calcVedicAnnualDasha(1995, 3, 13, 12, 0, '東京都'))
  const transition = [...definitions.entries()].find(([, items]) => items.some(item => item.factLineageId === 'vedic:mahadasha:transition' && item.matched))
  assert.ok(transition)
  const result = computeTimingScore('career_activation', transition![1])
  assert.ok(result.rawSupport >= 0.16)
  assert.equal(transition![1].find(item => item.factLineageId === 'vedic:antardasha:house10lord')?.available, true)
})

test('10室支配星はアンタルダシャー一致だけをantardasha lineageへ接続する', () => {
  const annual = (mahadashaLord: string, antardashaLord: string): VedicAnnualDasha[] => [{
    year: 2030, available: true, mahadashaLord, antardashaLord, mahadashaTransition: false, house10Lord: '土星',
  }]
  const mahaOnly = buildVedicTimingEvidence(annual('土星', '金星')).get(2030)!
  const antar = buildVedicTimingEvidence(annual('金星', '土星')).get(2030)!
  assert.equal(mahaOnly.find(item => item.factLineageId === 'vedic:antardasha:house10lord')?.matched, false)
  assert.equal(antar.find(item => item.factLineageId === 'vedic:antardasha:house10lord')?.matched, true)
})

test('月宿が当日切替する日はダシャーEvidenceを安全に利用不可とする', () => {
  let uncertain: ReturnType<typeof calcTimeIndependentVedicAnnualDasha> | undefined
  for (let day = 1; day <= 28 && !uncertain; day += 1) {
    const candidate = calcTimeIndependentVedicAnnualDasha(1995, 1, day)
    if (!candidate[0]?.available) uncertain = candidate
  }
  assert.ok(uncertain)
  const definitions = buildVedicTimingEvidence(uncertain!)
  assert.ok([...definitions.values()].flat().every(item => !item.available && !item.matched))
})

test('厳密な時刻境界判定までは時刻不明ダシャーを日付に関係なく利用しない', () => {
  for (const [year, month, day] of [[1995, 2, 20], [2000, 1, 1], [1985, 6, 6]]) {
    assert.ok(calcTimeIndependentVedicAnnualDasha(year!, month!, day!).every(item => !item.available))
  }
})

test('元系列がunavailableなら10室支配星が入っていてもEvidenceをavailableへ昇格しない', () => {
  const definitions = buildVedicTimingEvidence([{
    year: 2030, available: false, mahadashaLord: '金星', antardashaLord: '土星', mahadashaTransition: false, house10Lord: '土星',
  }]).get(2030)!
  const house10 = definitions.find(item => item.factLineageId === 'vedic:antardasha:house10lord')!
  assert.equal(house10.available, false)
  assert.equal(house10.matched, false)
  assert.equal(house10.support, 0)
  assert.match(house10.detail ?? '', /ダシャー系列を確定できない/)
})
