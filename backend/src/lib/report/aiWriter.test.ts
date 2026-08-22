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

test('恋愛と仕事の章はプロンプトと検証の両方で他領域の混入を拒否する', async () => {
  const love = { ...fallback.cards[0], id: 'love-pattern', title: '恋愛章', tags: ['恋愛'] }
  const work = { ...fallback.cards[0], id: 'work-mode', title: '仕事章', tags: ['仕事'] }
  const source = { ...fallback, cards: [love, work] }
  const prompts: string[] = []
  let calls = 0
  const result = await writeReportWithAi('domain-mixing', source, metadata, {
    async readCache() { return null }, async writeCache() {},
    async generate(prompt) {
      prompts.push(prompt); calls += 1
      const contaminated = pages.map(page => ({ ...page,
        label: calls === 1 ? `${page.label}と仕事` : `${page.label}と恋愛`,
      }))
      return JSON.stringify({ card: { title: calls === 1 ? '恋の距離を読む章です' : '任され方を読む章です', summary: '章の要約です。', metadataRefs: ['missingElements:火'], pages: contaminated } })
    },
  })
  assert.equal(result.generator, 'deterministic')
  assert.deepEqual(result.cards, source.cards)
  assert.ok(prompts.some(prompt => prompt.includes('仕事・キャリア・職場・上司の話は一切書かない')))
  assert.ok(prompts.some(prompt => prompt.includes('恋愛・恋人・結婚・パートナーの話は一切書かない')))
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
  assert.equal(result.generator, 'ai')
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

test('AI整文が全体期限を超えたら決定論版をすぐ返す', async () => {
  const startedAt = Date.now()
  const result = await writeReportWithAi('overall-timeout', fallback, metadata, {
    async readCache() { return null },
    async writeCache() {},
    async generate() { return await new Promise<string>(() => {}) },
    overallTimeoutMs: 20,
  })
  assert.equal(result.generator, 'deterministic')
  assert.deepEqual(result.cards, fallback.cards)
  assert.ok(Date.now() - startedAt < 500)
})

test('AI生成の並列度を4以下に抑え、章ごとに異なるキーでキャッシュする', async () => {
  const source = { ...fallback, cards: Array.from({ length: 7 }, (_, index) => ({ ...fallback.cards[0], id: `card-${index}`, title: `元の題${index}` })) }
  let active = 0; let maximumActive = 0
  const cardKeys: string[] = []
  const result = await writeReportWithAi('bounded', source, metadata, {
    async readCache() { return null }, async writeCache() {}, async readCardCache() { return null },
    async writeCardCache(key) { cardKeys.push(key) }, maxConcurrency: 4,
    async generate(prompt) {
      const id = prompt.match(/"id":"(card-\d+)"/)?.[1] ?? 'unknown'
      active += 1; maximumActive = Math.max(maximumActive, active)
      await new Promise(resolve => setTimeout(resolve, 10)); active -= 1
      return JSON.stringify({ card: { title: `${id}を生かす結論です`, summary: `${id}についての要約です。`, metadataRefs: ['missingElements:火'], pages } })
    },
  })
  assert.equal(result.generator, 'ai')
  assert.equal(maximumActive, 4)
  assert.equal(cardKeys.length, 7)
  assert.equal(new Set(cardKeys).size, 7)
})

test('全体期限時も完成済みの章を採用し、次回は失敗章だけを生成する', async () => {
  const source = { ...fallback, cards: [fallback.cards[0], { ...fallback.cards[0], id: 'slow', title: '遅い章' }] }
  const cardCache = new Map<string, typeof fallback.cards[number]>()
  let calls = 0
  const dependencies = {
    async readCache() { return null }, async writeCache() {},
    async readCardCache(key: string) { return cardCache.get(key) ?? null },
    async writeCardCache(key: string, card: typeof fallback.cards[number]) { cardCache.set(key, card) },
    overallTimeoutMs: 25, cardTimeoutMs: 100, maxConcurrency: 2,
    async generate(prompt: string) {
      calls += 1
      if (prompt.includes('"id":"slow"')) return await new Promise<string>(() => {})
      return raw
    },
  }
  const first = await writeReportWithAi('partial-timeout', source, metadata, dependencies)
  assert.equal(first.generator, 'ai')
  assert.equal(first.cards[0].title, '勢いより準備から始める人です')
  assert.equal(first.cards[1].title, '遅い章')
  assert.equal(cardCache.size, 1)
  await writeReportWithAi('partial-timeout', source, metadata, dependencies)
  assert.equal(calls, 3)
})

test('内部観測を追加しても返却する鑑定書を変更しない', async () => {
  const originalInfo = console.info
  const metrics: unknown[][] = []
  console.info = (...args: unknown[]) => { metrics.push(args) }
  try {
    const result = await writeReportWithAi('observability', fallback, metadata, {
      async readCache() { return null }, async writeCache() {}, async generate() { return raw },
    }, { correlationId: 'test-correlation-id', kind: 'self' })
    assert.equal(result.generator, 'ai')
    assert.equal(result.cards[0].title, '勢いより準備から始める人です')
    const cardMetric = metrics.find(entry => entry[0] === 'Report card generation completed')?.[1] as Record<string, unknown>
    const reportMetric = metrics.find(entry => entry[0] === 'Report generation completed')?.[1] as Record<string, unknown>
    assert.equal(cardMetric.correlationId, 'test-correlation-id')
    assert.equal(cardMetric.generator, 'ai')
    assert.equal(reportMetric.aiCardCount, 1)
    assert.equal(reportMetric.deterministicCardCount, 0)
  } finally {
    console.info = originalInfo
  }
})
