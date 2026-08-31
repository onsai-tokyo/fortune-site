import test from 'node:test'
import assert from 'node:assert/strict'
import { reportDiagnostics, runtimeIdentity } from './runtimeDiagnostics.js'

test('runtime identity exposes only normalized non-secret generation settings', () => {
  const result = runtimeIdentity({
    RENDER_GIT_COMMIT: 'ABCDEF1234567',
    FACT_PIPELINE: 'v2',
    NARRATIVE_ENGINE: 'blocks',
    AI_REPORT_ENABLED: 'false',
    DETERMINISTIC_SCOPE: 'all, core-mind-1,all',
    TIMING_ENGINE_MODE: 'shadow',
    TIMING_V2_MANIFEST_HASH: 'a'.repeat(64),
    ANTHROPIC_API_KEY: 'must-not-leak',
  })
  assert.equal(result.commitSha, 'abcdef1234567')
  assert.equal(result.selfReport.pipelineTag, 'fact:v2|narrative:blocks')
  assert.equal(result.aiReportEnabled, false)
  assert.deepEqual(result.deterministicScope, ['all', 'core-mind-1'])
  assert.equal(result.timingEngineMode, 'shadow')
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak/)
})

test('report diagnostics records the actual UI format card by card', () => {
  const result = reportDiagnostics({
    version: 3,
    reportText: 'report',
    cards: [{
      id: 'core-mind-1', kind: 'essence', tab: 'essence', title: 'title', summary: 'summary', tags: [],
      period: null, pages: [{ role: 'opening', label: 'page', text: 'text' }],
      sections: [{ heading: 'heading', body: 'body', evidence: [], termGloss: [], claimId: 'claim-1' }],
      evidence: [], metadataRefs: ['claim:claim-1'], generator: 'deterministic', compositionMode: 'finding',
    }],
    generator: 'deterministic',
    generatorVersion: 'self-report-v3',
  })
  assert.equal(result.cards[0].sectionsLength, 1)
  assert.equal(result.cards[0].pagesLength, 1)
  assert.equal(result.cards[0].metadataRefsCount, 1)
})

