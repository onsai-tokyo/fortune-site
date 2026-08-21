import assert from 'node:assert/strict'
import test from 'node:test'
import type { StructuredReport } from '../reportCards.js'
import type { ReportMetadata } from './metadata.js'
import { writeReportWithAi } from './aiWriter.js'

const fallback: StructuredReport = { version: 3, reportText: 'fallback', cards: [{
  id: 'core', kind: 'essence', title: '元の題', summary: '元の要約', tags: ['本質'], period: null, evidence: [], pages: [],
}] }
const metadata = { combinationSignature: 'abc', missingElements: [{ element: '火', score: 0, severity: 'missing' }], dominantElements: [], contradictions: [], relationshipDistortions: [], domainHighlights: [], turningPoints: { decades: [], annual: [] }, age: 30, lifeStage: '30s', profile: {} } as ReportMetadata
const pages = Array.from({ length: 5 }, (_, index) => ({ role: index === 0 ? 'opening' : index === 4 ? 'closing' : 'core', label: `頁${index}`, text: `火が欠ける命式を具体的に読む場面${index}。` }))
const raw = JSON.stringify({ cards: [{ title: '勢いより準備から始める人です', summary: '熱を外から補うと動きが明確になります。', metadataRefs: ['missingElements:火'], pages }] })

test('同じ入力の2回目はキャッシュを返しAIを再実行しない', async () => {
  let generated = 0
  let cached: StructuredReport | null = null
  const dependencies = {
    async readCache() { return cached },
    async writeCache(_key: string, report: StructuredReport) { cached = report },
    async generate() { generated++; return raw },
  }
  const first = await writeReportWithAi('1990-01-01|東京|female', fallback, metadata, dependencies)
  const second = await writeReportWithAi('1990-01-01|東京|female', fallback, metadata, dependencies)
  assert.deepEqual(second, first)
  assert.equal(generated, 1)
})

test('120字超過やメタデータ未参照のAI出力は決定論版へ戻す', async () => {
  const invalid = JSON.stringify({ cards: [{ title: '仕事', summary: 'x', metadataRefs: [], pages }] })
  const result = await writeReportWithAi('seed', fallback, metadata, {
    async readCache() { return null }, async writeCache() {}, async generate() { return invalid },
  })
  assert.equal(result, fallback)
})
