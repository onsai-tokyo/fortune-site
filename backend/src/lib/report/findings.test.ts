import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReportFindings } from './findings.js'
import type { ReportFact } from './facts.js'

const fact = (id: string, lineage: ReportFact['lineage'], signature = false): ReportFact => ({ id, lineage, signature, system: lineage, factor: id, axis: 'drive', signal: 'initiative', polarity: 1, strength: 0.8, requiresBirthTime: false })

test('Consensus Findingは異なる2系統以上の一致だけを採用する', () => {
  const findings = buildReportFindings([fact('a', 'stems'), fact('b', 'stems'), fact('c', 'number')])
  assert.equal(findings.length, 1)
  assert.equal(findings[0].kind, 'consensus')
  assert.deepEqual(new Set(findings[0].lineages), new Set(['stems', 'number']))
})

test('Signature Findingは極端値なら単一系統でも採用する', () => {
  const findings = buildReportFindings([{ ...fact('missing-fire', 'stems', true), axis: 'deficit', signal: 'missing-火', polarity: -1, strength: 1 }])
  assert.equal(findings.length, 1)
  assert.equal(findings[0].kind, 'signature')
  assert.deepEqual(findings[0].primaryFacts, ['missing-fire'])
})
