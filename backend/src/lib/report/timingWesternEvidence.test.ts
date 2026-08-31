import assert from 'node:assert/strict'
import test from 'node:test'
import { calcAstrology, calcTimeIndependentWesternAnnualAspects } from '../astrology.js'
import { computeTimingScore } from './timingScoreEngine.js'
import { buildWesternTimingEvidence, type WesternAnnualTimingInput } from './timingWesternEvidence.js'

const annual = calcTimeIndependentWesternAnnualAspects(1995, 2, 20)
const byYear = buildWesternTimingEvidence(annual)

test('出生時刻なしの正午代表値は43年分の診断定義だけを作りEvidenceへ昇格しない', () => {
  assert.equal(byYear.size, 43)
  assert.ok([...byYear.values()].every(items => items.length === 16))
  assert.ok([...byYear.values()].flat().every(item => !item.available && !item.matched && item.support === 0))
  assert.equal(new Set([...byYear.values()].flat().map(item => `${item.scoreKey}:${item.factLineageId}`)).size, 10)
})

test('時刻あり土星×金星ハードの成立年だけrelationship_disruptionへ加点する', () => {
  const timed = buildWesternTimingEvidence(annual, { personalPlanetsAvailable: true })
  const matched = [...timed.entries()].filter(([, items]) => items.some(item => item.factLineageId === 'western:transit:saturn:venus_hard' && item.matched))
  assert.ok(matched.length > 0)
  for (const [, definitions] of matched) {
    const result = computeTimingScore('relationship_disruption', definitions.filter(item => item.factLineageId === 'western:transit:saturn:venus_hard'))
    assert.ok(result.rawSupport > 0 && result.rawSupport <= 0.14)
    assert.equal(result.sourceFamilyCount, 1)
  }
})

test('外惑星の時刻不要対象と水星対象を各スコアへ分離する', () => {
  const all = [...buildWesternTimingEvidence(annual, { personalPlanetsAvailable: true }).values()].flat()
  for (const lineage of [
    'western:transit:uranus:venus_mars_desc_hard', 'western:transit:neptune:venus_desc',
    'western:transit:pluto:venus_desc', 'western:transit:neptune:desc_house7lord_venus_hard',
    'western:transit:uranus:mc_ic_mercury_house10lord', 'western:transit:jupiter:mercury_mc_house10lord',
  ]) assert.ok(all.some(item => item.factLineageId === lineage && item.matched), `${lineage} が一度も成立しない`)
  assert.ok(all.filter(item => !/\b(?:asc|desc|mc|ic)\b/i.test(item.id)).every(item => item.available))
})

test('出生時刻ありではASC・DESC・MC・IC対象だけをavailableにする', () => {
  const profile = calcAstrology(1995, 2, 20, 3, 2, '愛知県')
  assert.ok(profile.annual)
  const fixed = new Map(annual.map(item => [item.year, item.aspects]))
  const timed = buildWesternTimingEvidence(profile.annual!.map(item => ({
    year: item.year, aspects: fixed.get(item.year)!,
    angleAspects: item.westernAspects.filter(aspect => ['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)),
  })), { hasBirthTime: true, personalPlanetsAvailable: true })
  const angleEvidence = [...timed.values()].flat().filter(item => /(?:asc|desc|mc|ic)/i.test(item.id) && !item.id.startsWith('neptune-desc-ending:'))
  assert.ok(angleEvidence.length > 0)
  assert.ok(angleEvidence.every(item => item.available))
  assert.ok(angleEvidence.some(item => item.matched))
  const angleTargets = new Set(profile.annual!.flatMap(item => item.westernAspects.map(aspect => aspect.natal)).filter(name => ['ASC', 'DESC', 'MC', 'IC'].includes(name)))
  assert.deepEqual([...angleTargets].sort(), ['ASC', 'DESC', 'IC', 'MC'])
})

test('同一入力なら構造化アスペクトとEvidenceが完全一致する', () => {
  assert.deepEqual(calcTimeIndependentWesternAnnualAspects(1995, 2, 20), annual)
  assert.deepEqual(buildWesternTimingEvidence(annual), byYear)
})

test('海王星DESCハードの最終年だけ理想化を下げる反証Evidenceを出す', () => {
  const input = [
    { year: 2030, aspects: [], angleAspects: [{ transit: '海王星', natal: 'DESC', aspect: 90, orb: 1 }] },
    { year: 2031, aspects: [], angleAspects: [] },
  ] as const
  const result = buildWesternTimingEvidence(input, { hasBirthTime: true })
  const ending = result.get(2030)!.find(item => item.factLineageId === 'western:transit:neptune:desc_long_term_end')!
  assert.equal(ending.available, true)
  assert.equal(ending.matched, true)
  assert.equal(ending.polarity, -1)
  assert.equal(ending.maximumContribution, .10)
  const finalYear = result.get(2031)!.find(item => item.factLineageId === ending.factLineageId)!
  assert.equal(finalYear.available, false)
  assert.equal(finalYear.matched, false)
  assert.equal(finalYear.support, 0)
})

test('非連続年・未整列年を翌年としてcounter Evidenceへ使わない', () => {
  const current: WesternAnnualTimingInput = { year: 2030, aspects: [], angleAspects: [{ transit: '海王星', natal: 'DESC', aspect: 90, orb: 1 }] }
  const fixtures: readonly (readonly WesternAnnualTimingInput[])[] = [
    [current, { year: 2032, aspects: [], angleAspects: [] }],
    [{ year: 2031, aspects: [], angleAspects: [] }, current],
  ]
  for (const input of fixtures) {
    const evidence = buildWesternTimingEvidence(input, { hasBirthTime: true }).get(2030)!
      .find(item => item.factLineageId === 'western:transit:neptune:desc_long_term_end')!
    assert.deepEqual([evidence.available, evidence.matched, evidence.support], [false, false, 0])
  }
})

test('orb上限外のアスペクトをmatchedにもDESC終了counterにも使わない', () => {
  const result = buildWesternTimingEvidence([
    {
      year: 2030,
      aspects: [{ transit: '土星', natal: '金星', aspect: 90, orb: 99 }],
      angleAspects: [{ transit: '海王星', natal: 'DESC', aspect: 90, orb: 99 }],
    },
    { year: 2031, aspects: [], angleAspects: [] },
  ], { hasBirthTime: true, personalPlanetsAvailable: true })
  const items = result.get(2030)!
  const saturn = items.find(item => item.factLineageId === 'western:transit:saturn:venus_hard')!
  const ending = items.find(item => item.factLineageId === 'western:transit:neptune:desc_long_term_end')!
  assert.deepEqual([saturn.matched, saturn.support], [false, 0])
  assert.deepEqual([ending.matched, ending.support], [false, 0])
})

test('現在年または翌年のangle観測欠損を終了確認として扱わない', () => {
  const current: WesternAnnualTimingInput = { year: 2030, aspects: [], angleAspects: [{ transit: '海王星', natal: 'DESC', aspect: 90, orb: 1 }] }
  const fixtures: readonly (readonly WesternAnnualTimingInput[])[] = [
    [{ year: 2030, aspects: [] }, { year: 2031, aspects: [], angleAspects: [] }],
    [current, { year: 2031, aspects: [] }],
  ]
  for (const input of fixtures) {
    const result = buildWesternTimingEvidence(input, { hasBirthTime: true })
    const angle = result.get(2030)!.find(item => item.id.startsWith('neptune-desc:'))!
    const ending = result.get(2030)!.find(item => item.factLineageId === 'western:transit:neptune:desc_long_term_end')!
    if (!('angleAspects' in input[0])) assert.deepEqual([angle.available, angle.matched], [false, false])
    assert.deepEqual([ending.available, ending.matched, ending.support], [false, false, 0])
  }
})

test('JSTからUTCで前年になっても入力した現地出生年から43年を生成する', () => {
  const profile = calcAstrology(2000, 1, 1, 0, 0, '東京都')
  assert.equal(profile.annual?.[0]?.year, 2018)
  assert.equal(profile.annual?.at(-1)?.year, 2060)
})
