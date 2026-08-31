import assert from 'node:assert/strict'
import test from 'node:test'
import { TIMING_SCORE_KEYS } from './timingClaim.js'
import { TIMING_LINEAGE_CONTRACT } from './timingLineageContract.js'
import { TIMING_SCORE_DESIGN_CONTRACT } from './timingScoreDesignContract.js'
import { SOURCE_FAMILY_WEIGHTS } from './timingScoreEngine.js'
import { assertTimingRulesReadyForProduction, measureTimingRuleCoverage } from './timingRuleReadiness.js'

test('第1弾は3/18スコアであり、残り15スコアを完成扱いにしない', () => {
  const coverage = measureTimingRuleCoverage()
  assert.equal(coverage.totalScoreCount, 18)
  assert.equal(coverage.cataloguedScoreCount, 3)
  assert.equal(coverage.connectedScoreCount, 3)
  assert.equal(coverage.cataloguedLineageCount, 26)
  assert.equal(coverage.connectedLineageCount, 25)
  assert.equal(coverage.missingScoreKeys.length, 15)
  assert.equal(coverage.productionConnectionReady, false)
  assert.equal(coverage.exactManifestComplete, false)
  assert.deepEqual(
    coverage.missingScoreKeys,
    TIMING_SCORE_KEYS.filter(key => !['relationship_disruption', 'relationship_idealization', 'career_activation'].includes(key)),
  )
})

test('正本manifest未確定中は整形式の偽カタログでもreadyにならない', () => {
  const representative = TIMING_LINEAGE_CONTRACT.find(item => item.status === 'connected')!
  const fabricated = TIMING_SCORE_KEYS.flatMap(scoreKey => {
    const expected = TIMING_SCORE_DESIGN_CONTRACT[scoreKey]
    return expected.sourceFamilies.map((sourceFamily, index) => ({
      ...representative,
      scoreKey,
      sourceFamily,
      factLineageId: `${sourceFamily}:fabricated:${scoreKey}:${index}`,
      maximumContribution: Math.min(SOURCE_FAMILY_WEIGHTS[sourceFamily], expected.fullMax),
      status: 'connected' as const,
    }))
  })
  assert.equal(measureTimingRuleCoverage(fabricated).productionConnectionReady, false)
})

test('カタログ未完成の間は本番接続ゲートが失敗する', () => {
  assert.throws(() => assertTimingRulesReadyForProduction(), /3\/18 scores catalogued/)
})

test('各スコア1件のauxiliaryを置くだけでは正本契約不一致でゲートを通らない', () => {
  const representative = TIMING_LINEAGE_CONTRACT.find(item => item.status === 'connected')!
  const complete = TIMING_SCORE_KEYS.map((scoreKey, index) => ({
    ...representative,
    scoreKey,
    factLineageId: `auxiliary:test:score-${index}`,
    sourceFamily: 'auxiliary' as const,
  }))
  const coverage = measureTimingRuleCoverage(complete)
  assert.equal(coverage.productionConnectionReady, false)
  assert.deepEqual(coverage.contractMismatchScoreKeys, TIMING_SCORE_KEYS)
  assert.throws(() => assertTimingRulesReadyForProduction(complete), /contractMismatch=/)
})

test('既存3スコアはSource FamilyとfullMaxが正本に一致する', () => {
  const coverage = measureTimingRuleCoverage()
  assert.deepEqual(coverage.contractMismatchScoreKeys, [])
  assert.deepEqual(coverage.contractIntegrityErrors, [])
})

test('重複lineage・系統prefix不一致・Family上限超過を拒否する', () => {
  const representative = TIMING_LINEAGE_CONTRACT.find(item => item.status === 'connected')!
  const invalid = [
    representative,
    { ...representative },
    { ...representative, factLineageId: 'vedic:wrong-prefix' },
    { ...representative, factLineageId: 'stem_branch:too-large', maximumContribution: 0.25 },
  ]
  const coverage = measureTimingRuleCoverage(invalid)
  assert.ok(coverage.contractIntegrityErrors.some(error => error.startsWith('duplicate:')))
  assert.ok(coverage.contractIntegrityErrors.some(error => error.startsWith('family-prefix:')))
  assert.ok(coverage.contractIntegrityErrors.some(error => error.startsWith('maximumContribution:')))
  assert.equal(coverage.productionConnectionReady, false)
})
