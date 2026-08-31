import assert from 'node:assert/strict'
import test from 'node:test'
import { calcZiwei } from '../ziwei.js'
import { computeTimingScore } from './timingScoreEngine.js'
import { buildZiweiTimingEvidence } from './timingZiweiEvidence.js'

test('流年四化を星名だけでなく到達宮・四化種別として保持する', () => {
  const chart = calcZiwei(1995, 2, 20, 3, 'female', '愛知県')
  assert.equal(chart.available, true)
  if (!chart.available) return
  assert.equal(chart.annual.length, 43)
  assert.ok(chart.annual.every(item => item.mutagenPlacements.length === 4))
  assert.ok(chart.annual.flatMap(item => item.mutagenPlacements).every(item => item.star.length > 0 && item.palace.length > 0))
  assert.deepEqual(new Set(chart.annual.map(item => item.heavenlyStem)).size, 10)
  assert.ok(chart.annual.every(item => new Set(item.mutagenPlacements.map(entry => entry.mutagen)).size === 4))
})

test('流年命宮が官禄・遷移・財帛ならcareer_activationへ独立加点する', () => {
  const chart = calcZiwei(1995, 2, 20, 3, 'female', '愛知県')
  if (!chart.available) throw new Error('紫微斗数が利用不可')
  const byYear = buildZiweiTimingEvidence(chart.annual)
  const matched = [...byYear.entries()].find(([, items]) => items.some(item => item.factLineageId.includes('annual_life_palace') && item.matched))
  assert.ok(matched)
  assert.equal(computeTimingScore('career_activation', matched![1]).familyContributions.ziwei, 0.23)
})

test('官禄宮化忌はcareer_activationへ加点しない', () => {
  const fixture = [{ year: 2030, activePalaces: [], mutagenPlacements: [{ mutagen: '化忌' as const, star: '巨門', palace: '官禄' }] }]
  const definitions = buildZiweiTimingEvidence(fixture).get(2030)!
  assert.equal(definitions.find(item => item.factLineageId.endsWith('career'))?.matched, false)
})

test('夫妻宮化忌は命・福徳変化を要求し田宅活性時はdisruptionへ加点しない', () => {
  const base = [
    { mutagen: '化忌' as const, star: '巨門', palace: '夫妻' },
    { mutagen: '化権' as const, star: '紫微', palace: '命' },
    { mutagen: '化禄' as const, star: '武曲', palace: '財帛' },
    { mutagen: '化科' as const, star: '天機', palace: '兄弟' },
  ]
  const matched = buildZiweiTimingEvidence([{ year: 2030, activePalaces: [], mutagenPlacements: base }]).get(2030)!
  assert.equal(matched.find(item => item.factLineageId.includes('spouse:ji'))?.matched, true)
  const suppressed = buildZiweiTimingEvidence([{ year: 2030, activePalaces: ['田宅'], mutagenPlacements: base }]).get(2030)!
  assert.equal(suppressed.find(item => item.factLineageId.includes('spouse:ji'))?.matched, false)
})

test('出生時刻なしではziwei Evidenceをすべて利用不可にする', () => {
  const definitions = buildZiweiTimingEvidence([{ year: 2030, activePalaces: ['官禄'], mutagenPlacements: [] }], false).get(2030)!
  assert.ok(definitions.every(item => !item.available && !item.matched))
})

test('四化4件が完全解決できない年は四化Evidenceだけを利用不可にする', () => {
  const incomplete = [{
    year: 2030,
    activePalaces: ['官禄'],
    mutagenPlacements: [
      { mutagen: '化禄' as const, star: '武曲', palace: '官禄' },
      { mutagen: '化権' as const, star: '紫微', palace: '' },
      { mutagen: '化科' as const, star: '天機', palace: '命' },
      { mutagen: '化忌' as const, star: '巨門', palace: '夫妻' },
    ],
  }]
  const definitions = buildZiweiTimingEvidence(incomplete).get(2030)!
  assert.equal(definitions.find(item => item.technique === 'annual_life_palace')?.available, true)
  assert.ok(definitions.filter(item => item.technique === 'annual_four_transformations').every(item => !item.available && !item.matched))
})

test('四化の重複・過剰・owner star未解決はfail closedにする', () => {
  const valid = [
    { mutagen: '化禄' as const, star: '武曲', palace: '財帛' },
    { mutagen: '化権' as const, star: '紫微', palace: '命' },
    { mutagen: '化科' as const, star: '天機', palace: '兄弟' },
    { mutagen: '化忌' as const, star: '巨門', palace: '夫妻' },
  ]
  const fixtures = [
    [...valid.slice(0, 3), { ...valid[2]! }],
    [...valid, { ...valid[0]! }],
    valid.map((entry, index) => index === 1 ? { ...entry, palace: '' } : entry),
    valid.map((entry, index) => index === 1 ? { ...entry, star: '' } : entry),
    valid.map(entry => ({ ...entry, star: '同一星' })),
    valid.map((entry, index) => index === 1 ? { ...entry, palace: '不明宮' } : entry),
  ]
  for (const mutagenPlacements of fixtures) {
    const definitions = buildZiweiTimingEvidence([{ year: 2030, activePalaces: ['官禄'], mutagenPlacements }]).get(2030)!
    assert.ok(definitions.filter(item => item.technique === 'annual_four_transformations').every(item => !item.available && !item.matched))
    assert.equal(definitions.find(item => item.technique === 'annual_life_palace')?.available, true)
  }
})

test('流年命宮indexが空・重複・複数候補なら命宮Evidenceだけを利用不可にする', () => {
  const placements = [
    { mutagen: '化禄' as const, star: '武曲', palace: '財帛' },
    { mutagen: '化権' as const, star: '紫微', palace: '命' },
    { mutagen: '化科' as const, star: '天機', palace: '兄弟' },
    { mutagen: '化忌' as const, star: '巨門', palace: '夫妻' },
  ]
  for (const activePalaces of [[], ['官禄', '官禄'], ['官禄', '財帛']]) {
    const definitions = buildZiweiTimingEvidence([{ year: 2030, activePalaces, mutagenPlacements: placements }]).get(2030)!
    assert.equal(definitions.find(item => item.technique === 'annual_life_palace')?.available, false)
    assert.ok(definitions.filter(item => item.technique === 'annual_four_transformations').every(item => item.available))
  }
})
