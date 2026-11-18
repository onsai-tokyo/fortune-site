import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { pageBreadcrumbs, recordedDate, structuredDates } from '../seo/structured-data.js'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const files = fs.readdirSync(dist, { recursive: true }).filter(file => file.endsWith('.html'))
const pages = files.map(file => {
  const html = fs.readFileSync(path.join(dist, file), 'utf8')
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([, json]) => JSON.parse(json))
  const entities = blocks.flatMap(block => block['@graph'] ?? [block])
  return { file, html, blocks, entities }
})
const ledger = JSON.parse(fs.readFileSync(new URL('../seo/lastmod.json', import.meta.url), 'utf8'))
const origin = 'https://fate-lab.com'
const plain = html => html.replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity])

test('every JSON-LD block across the entire dist is valid JSON', t => {
  assert.ok(pages.length >= 100)
  let count = 0
  for (const { file, blocks } of pages) for (const block of blocks) {
    assert.equal(block['@context'], 'https://schema.org', file)
    assert.ok(block['@type'] || block['@graph'], file)
    count++
  }
  assert.ok(count >= 90)
  t.diagnostic(`${pages.length} HTML files, ${count} JSON-LD blocks parsed`)
})

test('every visible breadcrumb matches the JSON-LD names, URLs and sequential positions', t => {
  let count = 0
  for (const { file, html, entities } of pages) {
    const visible = html.match(/<div class="breadcrumb">([\s\S]*?)<\/div>/)
    const schema = entities.find(entity => entity['@type'] === 'BreadcrumbList')
    if (!visible) { assert.equal(schema, undefined, file); continue }
    assert.ok(schema, file)
    const crumbs = visible[1].split(' › ')
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1]
    assert.equal(schema.itemListElement.length, crumbs.length, file)
    crumbs.forEach((crumb, i) => {
      const href = crumb.match(/href="([^"]+)"/)?.[1]
      const expectedUrl = href ? new URL(href, origin).href : canonical
      assert.deepEqual(schema.itemListElement[i], { '@type': 'ListItem', position: i + 1, name: plain(crumb), item: expectedUrl }, file)
      assert.equal(new URL(expectedUrl).origin, origin)
      const route = new URL(expectedUrl).pathname
      assert.ok(fs.existsSync(path.join(dist, route, 'index.html')), `${file}: ${route}`)
    })
    count++
  }
  assert.ok(count >= 91)
  t.diagnostic(`${count} visible breadcrumbs match BreadcrumbList`)
})

test('article dates match the visible records and dateModified matches the sitemap ledger', t => {
  const sitemapDates = new Map()
  for (const name of ['sitemap-guides.xml', 'sitemap-series.xml']) {
    const xml = fs.readFileSync(path.join(dist, name), 'utf8')
    for (const [, url, date] of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)) sitemapDates.set(url, date ?? null)
  }
  let total = 0, knownPublished = 0, knownModified = 0
  for (const { file, html, entities } of pages) for (const article of entities.filter(e => e['@type'] === 'Article')) {
    const route = new URL(article.url).pathname
    const meta = html.match(/<div class="meta">([^<]+)<\/div>/)[1]
    assert.ok(ledger[route], file)
    assert.equal(article.dateModified ?? null, ledger[route].lastmod, file)
    assert.equal(article.dateModified ?? null, sitemapDates.get(article.url), file)
    assert.ok(meta.includes(`更新日：${article.dateModified ?? '記録なし'}`), file)
    if (article.datePublished) {
      assert.equal(recordedDate(article.datePublished), article.datePublished)
      assert.ok(meta.includes(`公開日：${article.datePublished}`), file)
      if (article.dateModified) assert.ok(article.datePublished <= article.dateModified, file)
      knownPublished++
    } else assert.ok(meta.includes('公開日：記録なし'), file)
    if (article.dateModified) { recordedDate(article.dateModified); knownModified++ }
    total++
  }
  assert.ok(total >= 81)
  t.diagnostic(`${total} articles: ${knownPublished} recorded publication dates, ${knownModified} recorded modification dates; unknown dates omitted`)
})

test('unrecorded or invalid dates cannot become fallback JSON-LD dates', () => {
  assert.deepEqual(structuredDates(), {})
  assert.deepEqual(structuredDates({ published: null, modified: null }), {})
  assert.deepEqual(structuredDates({ published: '2024-02-29' }), { datePublished: '2024-02-29' })
  assert.deepEqual(structuredDates({ modified: '2026-11-18' }), { dateModified: '2026-11-18' })
  for (const value of ['', '記録なし', '2026-02-29', '2026-04-31', '2026-13-01', '2026-11-18T00:00:00Z', 20261118]) {
    assert.throws(() => structuredDates({ published: value }), /Invalid recorded datePublished/)
    assert.throws(() => structuredDates({ modified: value }), /Invalid recorded dateModified/)
  }
})

test('annual breadcrumbs resolve only to an existing parent without publishing future pages', () => {
  const page = { path: 'guides/2027-fortune/kinoe', title: '甲の2027年の運勢' }
  const options = { origin, type: 'Article', seriesHubs: [], availablePaths: new Set() }
  assert.deepEqual(pageBreadcrumbs(page, options).map(crumb => crumb.item), [origin+'/', origin+'/guides/', origin+'/'+page.path])
  options.availablePaths.add('guides/2027-fortune')
  assert.deepEqual(pageBreadcrumbs(page, options), [
    { name: 'Fate Lab', item: origin+'/' }, { name: '占い解説', item: origin+'/guides/' },
    { name: '2027年の運勢', item: origin+'/guides/2027-fortune' }, { name: page.title, item: origin+'/'+page.path },
  ])
})

test('the four free calculators retain WebApplication and no new FAQPage is introduced', () => {
  for (const slug of ['shichu-suimei-calculator', 'day-master', 'sanmeigaku-calculator', 'life-path-number']) {
    const page = pages.find(page => page.file === `tools/${slug}/index.html`)
    const app = page.entities.find(entity => entity['@type'] === 'WebApplication')
    assert.ok(app, slug)
    assert.equal(app.url, `${origin}/tools/${slug}`)
    assert.equal(app.applicationCategory, 'LifestyleApplication')
    assert.equal(app.operatingSystem, 'Web')
    assert.equal(app.isAccessibleForFree, true)
    assert.equal(Number(app.offers.price), 0)
    assert.equal(app.offers.priceCurrency, 'JPY')
  }
  const faq = pages.flatMap(page => page.entities.filter(entity => entity['@type'] === 'FAQPage').map(entity => ({ file: page.file, entity })))
  assert.equal(faq.length, 1)
  assert.equal(faq[0].file, 'tools/sanmeigaku-calculator/index.html')
  assert.equal(faq[0].entity.mainEntity.length, 6)
})
