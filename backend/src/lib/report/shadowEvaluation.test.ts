import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportFindingV2 } from './findingsV2.js'
import { assignableChapterCount, median } from './shadowEvaluation.js'

function finding(id: string, axis: ReportFindingV2['axis'], confidence = 0.8): ReportFindingV2 {
  return { id, key: id, kind: 'consensus', axis, confidence, lineages: ['stems', 'number'], systems: ['四柱推命', '数秘術'], independence: 1, primaryFacts: [`fact-${id}`], supportingFacts: [] }
}

test('中央値は奇数・偶数・空配列を扱える', () => {
  assert.equal(median([]), null)
  assert.equal(median([0.8, 0.4, 1]), 0.8)
  assert.ok(Math.abs((median([0.4, 0.8]) ?? 0) - 0.6) < Number.EPSILON)
})

test('許可軸のFindingを重複使用せず8章に割り当てる', () => {
  const findings = [
    finding('mission', 'drive'), finding('mind', 'cognition'), finding('relation', 'relation'), finding('shadow', 'shadow'),
    finding('love-start', 'domain-love'), finding('love-pattern', 'domain-love'), finding('work-mode', 'domain-work'), finding('work-fit', 'domain-work'),
  ]
  assert.equal(assignableChapterCount(findings), 8)
})

test('所見が足りなければ割り当て可能章数を水増ししない', () => {
  assert.equal(assignableChapterCount([finding('only', 'drive')]), 1)
})
