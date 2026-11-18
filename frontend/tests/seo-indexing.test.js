import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { applyLastmod, contentHash, japanDate, nextLastmod, saveLastmod } from '../seo/lastmod.js'
import { sitemapGroup, writeSitemaps } from '../seo/sitemaps.js'
import { appRobots, privateAppRouteSources, updateAppRobots } from '../src/web/data/indexingPolicy.js'
import { sitemapRoutes } from './helpers/sitemaps.js'

const dist = new URL('../dist/', import.meta.url)
const fixture = body => `<title>題名</title><meta name="description" content="説明"><article><h1>見出し</h1><div class="meta">更新日：2026-11-16　編集部</div>${body}</article><p>最終更新日：2026-11-16</p>`

test('lastmod preserves existing and unknown dates on initialization and unchanged rebuilds', () => {
  const html = fixture('<p>本文です。</p>')
  const initial = nextLastmod(undefined, html, { initialLastmod: '2026-11-16', today: '2026-11-18' })
  assert.equal(initial.lastmod, '2026-11-16')
  assert.deepEqual(nextLastmod(initial, applyLastmod(html, initial.lastmod), { today: '2026-11-19' }), initial)
  assert.equal(nextLastmod(undefined, html, { today: '2026-11-18' }).lastmod, null)
  assert.equal(japanDate(new Date('2026-11-18T16:00:00Z')), '2026-11-19')
})

test('a body edit updates only its page and every content field affects the fingerprint', () => {
  const html = fixture('<p>元の本文です。</p>')
  const first = nextLastmod(undefined, html, { initialLastmod: '2026-11-16' })
  const previous = { '/a': first, '/b': first }
  const next = {
    '/a': nextLastmod(previous['/a'], fixture('<p>書き直した本文です。</p>'), { today: '2026-11-18' }),
    '/b': nextLastmod(previous['/b'], html, { today: '2026-11-18' }),
  }
  assert.equal(next['/a'].lastmod, '2026-11-18')
  assert.deepEqual(next['/b'], previous['/b'])
  for (const word of ['題名', '説明', '見出し', '元の本文です。']) assert.notEqual(contentHash(html.replace(word, '改稿後')), first.hash)
  assert.equal(contentHash(fixture('<p><a href="/before">元の本文です。</a></p>')), contentHash(fixture('<p><a href="/after">元の本文です。</a></p>')))
  assert.notEqual(contentHash(html, '公開本文A'), contentHash(html, '公開本文B'))
})

test('saved records are deterministic and visible and structured dates use the same value', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fatelab-lastmod-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = pathToFileURL(path.join(dir, 'lastmod.json'))
  const entry = nextLastmod(undefined, fixture('<p>本文</p>'), { initialLastmod: '2026-11-16' })
  saveLastmod(file, { '/b': entry, '/a': entry })
  const bytes = fs.readFileSync(file)
  const mtime = fs.statSync(file).mtimeMs
  saveLastmod(file, { '/a': entry, '/b': entry })
  assert.deepEqual(fs.readFileSync(file), bytes)
  assert.equal(fs.statSync(file).mtimeMs, mtime)
  const html = fixture('<p>本文</p>') + '<script type="application/ld+json">{"@graph":[{"@type":"Article","dateModified":"2026-11-16"}]}</script>'
  const dated = applyLastmod(html, '2026-11-18')
  assert.match(dated, /更新日：2026-11-18/)
  assert.match(dated, /最終更新日：2026-11-18/)
  assert.match(dated, /"dateModified":"2026-11-18"/)
  const unknown = applyLastmod(html, null)
  assert.match(unknown, /最終更新日：記録なし/)
  assert.doesNotMatch(unknown, /dateModified/)
})

test('sitemap index has four nonempty groups, 107 public URLs and no noindex pages', () => {
  const index = fs.readFileSync(new URL('sitemap.xml', dist), 'utf8')
  assert.match(index, /<sitemapindex /)
  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, value]) => new URL(value).pathname)
  assert.deepEqual(children, ['/sitemap-tools.xml', '/sitemap-guides.xml', '/sitemap-series.xml', '/sitemap-fortune.xml'])
  const routes = sitemapRoutes(dist)
  assert.equal(routes.length, 107)
  assert.equal(new Set(routes).size, 107)
  assert.ok(routes.includes('/coupons'))
  for (const route of routes) {
    assert.ok(!['/support', '/tokushoho'].includes(route))
    const file = new URL(route === '/' ? 'index.html' : `${route.slice(1).replace(/\/$/, '')}/index.html`, dist)
    const html = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(html.match(/<meta name="robots" content="[^"]*"/)[0], /noindex/)
  }
  for (const name of children) assert.doesNotMatch(fs.readFileSync(new URL(name.slice(1), dist), 'utf8'), /changefreq|priority/)
  for (const route of ['support', 'tokushoho', 'coupons']) assert.match(fs.readFileSync(new URL(`${route}/index.html`, dist), 'utf8'), /name="robots" content="index,follow/)
  const series = fs.readFileSync(new URL('sitemap-series.xml', dist), 'utf8')
  assert.equal([...series.matchAll(/<loc>/g)].length, 32)
})

test('future landing and annual pages are classified without publishing empty sitemaps', t => {
  assert.equal(sitemapGroup('uranai/fukuen'), 'uranai')
  assert.equal(sitemapGroup('guides/2027-fortune'), 'fortune')
  assert.equal(sitemapGroup('guides/2027-fortune/kinoe'), 'fortune')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fatelab-sitemaps-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  writeSitemaps(dir, 'https://fate-lab.com', [{ path: '', lastmod: null }])
  assert.ok(!fs.existsSync(path.join(dir, 'sitemap-fortune.xml')))
  assert.ok(!fs.existsSync(path.join(dir, 'sitemap-uranai.xml')))
})

test('private application paths stay noindex across navigation and public routes return to index', () => {
  const privatePaths = ['/settings', '/settings/link', '/login', '/restore', '/welcome', '/creating', '/you', '/you/years/2026', '/you/chapters/example', '/books', '/books/saved/example', '/reading/example', '/s/fake-share', '/r/fake-secret', '/couple/new', '/couple/fake-partner', '/legacy/login', '/app-legal/privacy', '/unknown']
  const meta = { content: '', isConnected: true }
  const document = { querySelector: () => meta }
  for (const pathname of privatePaths) {
    assert.equal(appRobots(pathname), 'noindex,nofollow')
    updateAppRobots(document, pathname)
    assert.equal(meta.content, 'noindex,nofollow')
  }
  for (const pathname of ['/', '/couple', '/coupons', '/support', '/tokushoho', '/terms', '/privacy']) {
    updateAppRobots(document, pathname)
    assert.match(meta.content, /^index,follow/)
  }
  assert.match(fs.readFileSync(new URL('app.html', dist), 'utf8'), /name="robots" content="noindex,nofollow"/)
})

test('both deployments protect private HTML without JavaScript and robots allows crawling it', () => {
  for (const file of ['../vercel.json', '../../vercel.json']) {
    const config = JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
    for (const source of privateAppRouteSources) {
      assert.ok(config.headers.some(rule => rule.source === source && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex,nofollow')), source)
      if (source !== '/app.html') assert.ok(config.rewrites.some(rule => rule.source === source && rule.destination === '/app.html'), source)
    }
    assert.ok(!config.headers.some(rule => ['/', '/couple', '/coupons', '/support', '/tokushoho'].includes(rule.source)))
  }
  const robots = fs.readFileSync(new URL('robots.txt', dist), 'utf8')
  assert.match(robots, /Sitemap: https:\/\/fate-lab.com\/sitemap.xml/)
  assert.deepEqual([...robots.matchAll(/^Disallow: (.+)$/gm)].map(([, value]) => value), ['/api/'])
})
