import assert from 'node:assert/strict'
import test from 'node:test'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildReportFactsV2 } from './factsV2.js'
import { extractReportMetadata } from './metadata.js'
import { GAP_SPECS } from './gapFindings.js'
import { buildScoreFindingsV2 } from './scoreFindingsV2.js'

test('PR-3 Score所見は再現可能で、存在するFactだけを参照する', () => {
  for (const fixture of BIRTH_FIXTURES.slice(0, 10)) {
    const input = buildFixtureReportInput(fixture)
    const facts = buildReportFactsV2(input, extractReportMetadata(input))
    const first = buildScoreFindingsV2(facts)
    let traceCount = 0
    const second = buildScoreFindingsV2(facts, rows => {
      traceCount = rows.length
      assert.deepEqual(rows.map(row => row.key), GAP_SPECS.map(spec => spec.key))
      for (const row of rows) {
        if (row.status === 'observed') {
          assert.ok([...row.left.facts, ...row.right.facts].every(id => facts.some(fact => fact.id === id)))
        }
      }
    })
    assert.equal(traceCount, GAP_SPECS.length)
    assert.deepEqual(first, second)
    const ids = new Set(facts.map(fact => fact.id))
    assert.ok(first.every(finding => finding.primaryFacts.every(id => ids.has(id))))
    assert.ok(first.every(finding => finding.confidence >= 0.4))
  }
})
