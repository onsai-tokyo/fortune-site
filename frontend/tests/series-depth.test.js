import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { articleSentences, seriesSentenceReport } from '../scripts/article-data/series-sentence-metric.js'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const baseline = JSON.parse(fs.readFileSync(new URL('../article-data/series-sentence-baseline.json', import.meta.url), 'utf8'))
const report = seriesSentenceReport(dist)
const html = route => fs.readFileSync(path.join(dist, route, 'index.html'), 'utf8')

test('each of the 32 series pages has a lower shared-sentence ratio than the main baseline', t => {
  assert.equal(Object.keys(report).length, 32)
  assert.deepEqual(Object.keys(report), Object.keys(baseline.pages))
  for (const [route, after] of Object.entries(report)) {
    const before = baseline.pages[route]
    assert.ok(after.ratio < before.ratio, `${route}: ${before.ratio} -> ${after.ratio}`)
    assert.ok(after.sentences > before.sentences, route)
    t.diagnostic(`${route}: ${(before.ratio * 100).toFixed(1)}% -> ${(after.ratio * 100).toFixed(1)}%`)
  }
})

test('punctuation and whitespace changes do not count as original sentences', () => {
  const first = '<article><h2>見出し</h2><p>自分の仕事、相手の希望を分けて考えます。</p></article>'
  const second = '<article><h2>別の見出し</h2><p>自分の仕事, 相手の希望を分けて考えます！</p></article>'
  assert.deepEqual(articleSentences(first), articleSentences(second))
})

test('all 32 have readable examples, a nearby-type comparison and three substantial FAQ answers', () => {
  const titles = new Set(), descriptions = new Set()
  for (const route of Object.keys(report)) {
    const page = html(route)
    const article = page.match(/<article>([\s\S]*?)<\/article>/)[1]
    assert.equal([...article.matchAll(/<h2>実例：/g)].length, 1, route)
    assert.match(article, /<h2>[^<]+の計算例を順に読み解く<\/h2>/)
    const compare = route.endsWith('/chosei')
      ? article.match(/<h2>[^<]*前後[^<]*<\/h2>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)
      : article.match(/<h2>[^<]*(?:違いを場面で比べる|使い分けて読む|と前後の段階を比べる)<\/h2>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)
    assert.ok(compare, `comparison: ${route}`)
    assert.equal([...compare[1].matchAll(/<tr>/g)].length, route.includes('/twelve-stage/') ? 3 : 4, route)
    const faq = article.match(/<h2>[^<]+のよくある質問<\/h2>([\s\S]*?)(?=<h2>|$)/)[1]
    const answers = [...faq.matchAll(/<h3>[^<]+<\/h3><p>(.*?)<\/p>/g)].map(([, a]) => a)
    assert.equal(answers.length, 3, route)
    answers.forEach(a => {
      const count = a.split(/[。！？]/).filter(Boolean).length
      assert.ok(count >= 2 && count <= 3, `${route}: ${a}`)
      assert.doesNotMatch(a, /必ず|絶対|\d+[%％]/)
    })
    assert.doesNotMatch(faq, /hidden|display:\s*none/)
    const title = page.match(/<title>(.*?)<\/title>/)[1]
    const description = page.match(/<meta name="description" content="([^"]+)"/)[1]
    assert.ok(!titles.has(title)); titles.add(title)
    assert.ok(!descriptions.has(description)); descriptions.add(description)
    assert.ok(!title.startsWith('日干「') && !title.startsWith('通変星「') && !title.startsWith('十二運「'))
    for (const [, href] of article.matchAll(/<a\b[^>]*href="(\/[^"#?]+)(?:#[^"]*)?"/g)) {
      assert.ok(fs.existsSync(path.join(dist, href, 'index.html')), `${route} -> ${href}`)
    }
  }
})
