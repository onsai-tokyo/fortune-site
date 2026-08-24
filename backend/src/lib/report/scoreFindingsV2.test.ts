import assert from 'node:assert/strict'
import test from 'node:test'
import { BIRTH_FIXTURES, buildFixtureReportInput } from './fixtures.js'
import { buildReportFactsV2 } from './factsV2.js'
import { extractReportMetadata } from './metadata.js'
import { buildScoreFindingsV2 } from './scoreFindingsV2.js'

test('PR-3 Score所見は再現可能で、存在するFactだけを参照する', () => {
  for (const fixture of BIRTH_FIXTURES.slice(0, 10)) {
    const input = buildFixtureReportInput(fixture)
    const facts = buildReportFactsV2(input, extractReportMetadata(input))
    const first = buildScoreFindingsV2(facts)
    const second = buildScoreFindingsV2(facts)
    assert.deepEqual(first, second)
    const ids = new Set(facts.map(fact => fact.id))
    assert.ok(first.every(finding => finding.primaryFacts.every(id => ids.has(id))))
    assert.ok(first.every(finding => finding.confidence >= 0.4))
  }
})
