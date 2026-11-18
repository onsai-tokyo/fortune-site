import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { crawlEntryLinks } from '../src/web/data/crawlEntryLinks.js'

const read = name => fs.readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8')
const strip = value => value.replace(/<[^>]*>/g, '')
const main = html => html.match(/<main>([\s\S]*?)<\/main>/)[1]

test('home has readable initial copy, three FAQs and working crawl entrances before JavaScript', () => {
  const html = read('index.html')
  const body = main(html)
  assert.match(body, /<h1[^>]*>生年月日で占う無料鑑定<\/h1>/)
  assert.match(body, /Fate Labでわかること/)
  const intro = strip(body.match(/<p[^>]*>(.*?)<\/p>/)[1])
  assert.equal(intro.split('。').filter(Boolean).length, 4)
  for (const term of ['性格', '恋愛', '年ごと', '会員登録なし', '出生時刻が不明']) assert.ok(intro.includes(term))
  assert.equal([...body.matchAll(/<h3\b/g)].length, 3)
  assert.doesNotMatch(body, /<noscript|\bhidden\b|display:\s*none/)
  assert.doesNotMatch(intro, /十大主星|出し方|同じ生年月日なら/)
  for (const [href] of crawlEntryLinks) assert.ok(html.includes(`href="${href}"`), href)
})

test('home search metadata describes integrated reading, without changing the React heading', () => {
  const html = read('index.html')
  const title = html.match(/<title>(.*?)<\/title>/)[1]
  assert.equal((title.match(/算命学/g) ?? []).length, 1)
  assert.equal((title.match(/Fate Lab/g) ?? []).length, 1)
  assert.match(title, /^生年月日で無料鑑定.*9占術を統合｜Fate Lab$/)
  const description = html.match(/<meta name="description" content="([^"]*)"/)[1]
  assert.ok([...description].length <= 120)
  for (const term of ['無料', '会員登録は不要', '性格', '出生時刻が不明']) assert.ok(description.includes(term))
  assert.ok(html.includes(`<meta property="og:title" content="${title}"`))
  assert.ok(html.includes(`<meta property="og:description" content="${description}"`))
  const topPage = fs.readFileSync(new URL('../src/web/pages/TopPage.tsx', import.meta.url), 'utf8')
  assert.match(topPage, /生まれた日から、<br \/>あなたの一年ずつを読む。/)
})

test('legacy landing file is readable, canonicalized to home and noindex; redirects remain', () => {
  const lp = read('lp.html')
  assert.equal(main(lp), main(read('index.html')))
  assert.match(lp, /<link rel="canonical" href="https:\/\/fate-lab.com\/"/)
  assert.match(lp, /<meta name="robots" content="noindex,follow"/)
  for (const file of ['../vercel.json', '../../vercel.json']) {
    const config = JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
    for (const source of ['/lp', '/lp.html']) {
      const redirect = config.redirects.find(rule => rule.source === source)
      assert.equal(redirect.destination, '/')
      assert.equal(redirect.permanent, true)
    }
  }
})

test('sanmeigaku answers free calculation queries and links to stars directly after complete results', () => {
  const html = read('tools/sanmeigaku-calculator/index.html')
  const article = html.match(/<article>([\s\S]*?)<\/article>/)[1]
  const first = strip(article.match(/<p>(.*?)<\/p>/)[1])
  for (const term of ['人体星図', '十大主星', '十二大従星', '天中殺', '無料', '会員登録と出生時刻は不要']) assert.ok(first.includes(term))
  for (const heading of ['十大主星の出し方', '十二大従星を無料で調べる', '天中殺の調べ方', '人体星図の見方']) {
    const afterResults = article.slice(article.indexOf('</section>') + '</section>'.length)
    assert.ok(afterResults.includes(`<h2>${heading}</h2>`), heading)
  }
  assert.match(article, /<section id="sanmei-detail" hidden>[\s\S]*?<\/section><p><a href="\/guides\/sanmeigaku-stars">/)
  assert.ok(fs.existsSync(new URL('../dist/guides/sanmeigaku-stars/index.html', import.meta.url)))
  assert.match(html, /<title>算命学 無料計算｜十大主星・十二大従星・天中殺を算出｜Fate Lab<\/title>/)
  assert.match(article, /<h1>算命学の無料計算｜生年月日から十大主星・十二大従星を自動算出<\/h1>/)

  const faq = article.match(/<section class="visible-faq">([\s\S]*?)<\/section>/)[1]
  const visible = [...faq.matchAll(/<h3>(.*?)<\/h3><p>(.*?)<\/p>/g)].map(([, question, answer]) => [question, answer])
  const graph = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
    .flatMap(([, json]) => JSON.parse(json)['@graph'] ?? [])
  const structured = graph.find(node => node['@type'] === 'FAQPage').mainEntity
  assert.equal(visible.length, 6)
  assert.deepEqual(visible, structured.map(item => [item.name, item.acceptedAnswer.text]))
})
