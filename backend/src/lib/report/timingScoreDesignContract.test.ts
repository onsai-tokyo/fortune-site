import assert from 'node:assert/strict'
import test from 'node:test'
import { TIMING_SCORE_KEYS, type TimingScoreKey } from './timingClaim.js'
import { TIMING_LINEAGE_CONTRACT } from './timingLineageContract.js'
import { TIMING_SCORE_DESIGN_CONTRACT } from './timingScoreDesignContract.js'
import { SOURCE_FAMILY_WEIGHTS, type SourceFamily } from './timingScoreEngine.js'

function catalogueFullMax(scoreKey: TimingScoreKey) {
  const positive = TIMING_LINEAGE_CONTRACT.filter(item => item.scoreKey === scoreKey && item.polarity > 0)
  const familyValue = (family: SourceFamily) => Math.min(
    SOURCE_FAMILY_WEIGHTS[family],
    positive.filter(item => item.sourceFamily === family && item.status !== 'mathematically_impossible')
      .reduce((sum, item) => sum + item.maximumContribution, 0),
  )
  const western = familyValue('western')
  const vedic = familyValue('vedic')
  return Number((Math.max(western, vedic) + .6 * Math.min(western, vedic)
    + familyValue('stem_branch') + familyValue('ziwei') + familyValue('auxiliary')).toFixed(3))
}

test('正本契約は18スコアを過不足なく定義する', () => {
  assert.deepEqual(Object.keys(TIMING_SCORE_DESIGN_CONTRACT), [...TIMING_SCORE_KEYS])
})

test('第1弾3スコアのSource FamilyとfullMaxが正本に一致する', () => {
  for (const scoreKey of ['relationship_disruption', 'relationship_idealization', 'career_activation'] as const) {
    const entries = TIMING_LINEAGE_CONTRACT.filter(item => item.scoreKey === scoreKey)
    const families = [...new Set(entries.map(item => item.sourceFamily))].sort()
    assert.deepEqual(families, [...TIMING_SCORE_DESIGN_CONTRACT[scoreKey].sourceFamilies].sort(), `${scoreKey}: Source Family不一致`)
    assert.equal(catalogueFullMax(scoreKey), TIMING_SCORE_DESIGN_CONTRACT[scoreKey].fullMax, `${scoreKey}: fullMax不一致`)
  }
})

test('education_disruptionに根拠のないziweiを追加しない', () => {
  assert.deepEqual(TIMING_SCORE_DESIGN_CONTRACT.education_disruption.sourceFamilies, ['western', 'vedic', 'stem_branch'])
  assert.equal(TIMING_SCORE_DESIGN_CONTRACT.education_disruption.fullMax, .624)
})
