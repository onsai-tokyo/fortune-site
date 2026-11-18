import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { monthlyFocus } from '../annual-fortune.js'
import { sitemapRoutes } from './helpers/sitemaps.js'

const data = JSON.parse(fs.readFileSync(new URL('../data/fortune-2027.json', import.meta.url), 'utf8'))
const dist = new URL('../dist/', import.meta.url)
const html = slug => fs.readFileSync(new URL(`guides/${slug}/index.html`, dist), 'utf8')

test('annual JSON passes engine regeneration, calendar boundaries and 260 dual-rule checks', { timeout: 30000 }, () => {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../scripts/article-data/verify-fortune.ts', import.meta.url))], {
    cwd: fileURLToPath(new URL('../../backend/', import.meta.url)), timeout: 25000, stdio: 'pipe', env,
  })
})

test('all 11 annual guides are in the fortune sitemap and their navigation is complete', () => {
  const xml = fs.readFileSync(new URL('sitemap-fortune.xml', dist), 'utf8')
  assert.equal([...xml.matchAll(/<loc>/g)].length, 11)
  const routes = sitemapRoutes(dist)
  assert.ok(routes.includes('/guides/2027-fortune'))
  const hub = html('2027-fortune')
  for (const item of data.stems) {
    const route = `/guides/2027-fortune/${item.slug}`
    assert.ok(routes.includes(route))
    assert.ok(hub.includes(`href="${route}"`))
    assert.ok(html(`day-master/${item.slug}`).includes(`href="${route}"`))
    const page = html(`2027-fortune/${item.slug}`)
    for (const href of [`/guides/day-master/${item.slug}`, '/tools/day-master', '/guides/2027-fortune']) assert.ok(page.includes(`href="${href}"`))
    assert.ok(page.includes('action="/welcome?from=guide&amp;returnTo=%2Fyou"'))
    assert.ok(page.includes(`<a href="/guides/2027-fortune">2027年の運勢</a>`))
    assert.match(page, /暦の1日から月末までとは異なります/)
    assert.match(page, /2028年1月/)
  }
  assert.ok(html('meeting-timing').includes('href="/guides/2027-fortune"'))
})

test('monthly copy is driven by the calculated pair, has two sentences and does not repeat', () => {
  for (const item of data.stems) {
    const article = html(`2027-fortune/${item.slug}`).match(/<article>([\s\S]*?)<\/article>/)[1]
    const texts = item.months.map(value => monthlyFocus(value.tenGod, value.twelveStage))
    assert.equal(new Set(texts).size, 12)
    for (const text of texts) { assert.equal(text.split('。').filter(Boolean).length, 2); assert.ok(article.includes(text)) }
    for (const month of data.months) assert.ok(article.includes(`<h3>${month.calendarYear}年${month.calendarMonth}月（${month.term}から）</h3>`))
    assert.ok(article.includes(`通変星「${item.annual.tenGod}」と十二運「${item.annual.twelveStage}」`))
    assert.doesNotMatch(article, /必ず|絶対|\d+%で|%で復縁/)
  }
})
