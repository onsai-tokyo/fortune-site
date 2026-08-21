import assert from 'node:assert/strict'
import test from 'node:test'
import type { StructuredReport } from '../reportCards.js'
import type { ReportMetadata } from './metadata.js'
import { titlesAreSimilar, writeReportWithAi } from './aiWriter.js'

const fallback: StructuredReport = { version: 3, reportText: 'fallback', cards: [{
  id: 'core', kind: 'essence', title: '元の題', summary: '元の要約', tags: ['本質'], period: null, evidence: [], pages: [],
}] }
const metadata = { combinationSignature: 'abc', missingElements: [{ element: '火', score: 0, severity: 'missing' }], dominantElements: [], contradictions: [], relationshipDistortions: [], domainHighlights: [], turningPoints: { decades: [], annual: [] }, age: 30, lifeStage: '30s', profile: {} } as ReportMetadata
const pages = Array.from({ length: 15 }, (_, index) => ({ role: index === 0 ? 'opening' : index === 14 ? 'closing' : 'core', label: `頁${index}`, text: `火が欠ける命式を具体的に読む場面${index}。` }))
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
  assert.equal(first.generator, 'ai')
})

test('120字超過やメタデータ未参照のAI出力は決定論版へ戻す', async () => {
  const invalid = JSON.stringify({ cards: [{ title: '仕事', summary: 'x', metadataRefs: [], pages }] })
  const result = await writeReportWithAi('seed', fallback, metadata, {
    async readCache() { return null }, async writeCache() {}, async generate() { return invalid },
  })
  assert.equal(result.generator, 'deterministic')
  assert.deepEqual(result.cards, fallback.cards)
})

test('章ごとに並列生成し、元ページと根拠を各プロンプトへ渡す', async () => {
  const secondCard = { ...fallback.cards[0], id: 'work', title: '元の仕事', pages: [{ role: 'core' as const, label: '元頁', text: '元ページの具体文。' }], evidence: [{ family: '干支系', system: '四柱推命', detail: '日柱' }] }
  const source = { ...fallback, cards: [fallback.cards[0], secondCard] }
  const prompts: string[] = []
  let active = 0; let maximumActive = 0
  const result = await writeReportWithAi('parallel', source, metadata, {
    async readCache() { return null }, async writeCache() {}, async generate(prompt) {
      prompts.push(prompt); active += 1; maximumActive = Math.max(maximumActive, active)
      await new Promise(resolve => setTimeout(resolve, 10)); active -= 1
      return raw
    },
  })
  assert.equal(result.cards.length, 2)
  assert.equal(maximumActive, 2)
  assert.ok(prompts.some(prompt => prompt.includes('元ページの具体文') && prompt.includes('日柱')))
})

test('一章の形式不正は他章のAI生成結果を失わせない', async () => {
  const source = { ...fallback, cards: [fallback.cards[0], { ...fallback.cards[0], id: 'work', title: '元の仕事' }] }
  let calls = 0
  const result = await writeReportWithAi('partial', source, metadata, {
    async readCache() { return null }, async writeCache() { throw new Error('partial result must not be cached') },
    async generate() { calls += 1; return calls === 1 ? raw : '{"card":{"title":"仕事"}}' },
  })
  assert.equal(result.generator, 'deterministic')
  assert.equal(result.cards[0].title, '勢いより準備から始める人です')
  assert.equal(result.cards[1].title, '元の仕事')
})

test('似た章タイトルを検出し、一度だけ異なる題へ書き直す', async () => {
  assert.equal(titlesAreSimilar('言葉と情報をつなぐ力', '「言葉と情報をつなぐ力」です'), true)
  const source = { ...fallback, cards: [fallback.cards[0], { ...fallback.cards[0], id: 'work', title: '仕事で力が出る条件' }] }
  let calls = 0
  const result = await writeReportWithAi('title-retry', source, metadata, {
    async readCache() { return null }, async writeCache() {}, async generate() {
      calls += 1
      const title = calls <= 2 ? '言葉と情報をつなぐ力' : '静かな準備が仕事を前へ進めます'
      return JSON.stringify({ card: { title, summary: '熱を外から補うと動きが明確になります。', metadataRefs: ['missingElements:火'], pages } })
    },
  })
  assert.equal(calls, 3)
  assert.equal(result.cards[1].title, '静かな準備が仕事を前へ進めます')
})
