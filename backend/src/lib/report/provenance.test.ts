import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportCard, StructuredReport } from '../reportCards.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'
import { isStructuredReport } from './storedReport.js'

const card = (id: string): ReportCard => ({
  id, kind: 'essence', title: id, summary: id, tags: [], period: null,
  pages: [{ role: 'core', label: '核', text: '本文' }],
  evidence: [{ family: 'lineage', system: 'system', detail: 'detail' }],
})

test('新規保存レポートはカード単位の生成元と整合する集計を持つ', () => {
  const report = finalizeReportProvenance({
    version: 3, reportText: '本文', cards: [
      withCardProvenance(card('ai'), 'ai'),
      withCardProvenance(card('fallback'), 'deterministic', 'supplement', 1),
    ],
  }, 'test-v1')
  assert.equal(report.generator, 'mixed')
  assert.equal(report.generatorVersion, 'test-v1')
  assert.equal(report.aiCardCount, 1)
  assert.equal(report.deterministicCardCount, 1)
  assert.equal(report.supplementCardCount, 1)
  assert.ok(report.cards.every(item => item.metadataRefs?.length))
})

test('PR-0b-metadata以前の保存形式も読み込める', () => {
  const legacy: StructuredReport = { version: 2, reportText: '旧本文', cards: [card('legacy')] }
  assert.equal(isStructuredReport(legacy), true)
})
