import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportFindingV2 } from './findingsV2.js'
import { buildFindingRelationsV2 } from './findingRelationsV2.js'
import { assignFindingsToChaptersV2, CHAPTER_CONTRACT } from './chapterPlannerV2.js'
import { selectNarrativeBlock } from './blockSelectorV2.js'
import type { NarrativeBlock } from './narrativeV2.js'
import { validateNarrativeBlocks } from './narrativeValidatorV2.js'

function finding(id: string, axis: ReportFindingV2['axis'], key = id, confidence = 0.8): ReportFindingV2 {
  return { id, key, kind: 'consensus', axis, confidence, lineages: ['stems', 'number'], systems: ['四柱推命', '数秘術'], independence: 1, primaryFacts: [`fact-${id}`], supportingFacts: [] }
}

test('Findingの補強・矛盾・補完関係を強度付きで生成する', () => {
  const relations = buildFindingRelationsV2([
    finding('a', 'drive', 'independence', 0.8), finding('b', 'drive', 'responsibility', 0.7), finding('c', 'tension', 'conflict', 0.75),
  ], [{ key: 'independence', axis: 'drive', trait: '', coreAssertion: '', strengthFraming: '', shadowFraming: '', affinities: ['responsibility'], oppositions: ['conflict'], semanticTags: [] }])
  assert.ok(relations.some(item => item.primary === 'a' && item.support === 'b' && item.kind === 'reinforce'))
  assert.ok(relations.some(item => item.primary === 'a' && item.support === 'c' && item.kind === 'contradict'))
})

test('章計画は軸不問で配らず、必ず8章を返す', () => {
  const plans = assignFindingsToChaptersV2([finding('mission', 'drive')], [])
  assert.equal(plans.length, Object.keys(CHAPTER_CONTRACT).length)
  assert.equal(plans.filter(plan => plan.primary).length, 1)
  assert.ok(plans.filter(plan => !plan.primary).every(plan => plan.supplementCount === 16))
})

test('ブロック選択は条件と安定seedに従う', () => {
  const primary = finding('primary', 'drive', 'independence')
  const blocks: NarrativeBlock[] = [1, 2].map(index => ({ id: `b${index}`, patternKey: 'independence', axis: 'drive', role: 'core', domain: 'self', text: `text${index}`, semanticFingerprint: [`f${index}`], priority: 1 }))
  const context = { primary, role: 'core' as const, domain: 'self' as const, birthTimeAvailable: true, lifeStage: '30s' as const, seed: 'same' }
  assert.equal(selectNarrativeBlock(blocks, context)?.id, selectNarrativeBlock(blocks, context)?.id)
  assert.equal(selectNarrativeBlock([], context), null)
})

test('相性条件と領域混入をブロック登録時に拒否する', () => {
  const invalid: NarrativeBlock[] = [
    { id: 'compat', patternKey: 'x', axis: 'relation', role: 'core', domain: 'compatibility', text: '二人の話', semanticFingerprint: ['二人'], priority: 1 },
    { id: 'love', patternKey: 'x', axis: 'domain-love', role: 'love', domain: 'love', text: '職場と上司の話', semanticFingerprint: ['仕事'], priority: 1 },
  ]
  const errors = validateNarrativeBlocks(invalid)
  assert.ok(errors.some(error => error.includes('relationshipTypes')))
  assert.ok(errors.some(error => error.includes('forbidden domain')))
})

test('空の文章ライブラリはPR-4基盤として有効', () => {
  assert.deepEqual(validateNarrativeBlocks([]), [])
})
