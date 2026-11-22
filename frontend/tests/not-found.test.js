import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { sitemapRoutes } from './helpers/sitemaps.js'
import { privateAppRouteSources } from '../src/web/data/indexingPolicy.js'

const dist = new URL('../dist/', import.meta.url)

test('unknown paths cannot fall through to the indexed homepage while SPA routes stay explicit', () => {
  const root = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  const frontend = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.deepEqual(root, frontend)
  assert.ok(!root.rewrites.some(route => route.destination === '/index.html'))
  for (const source of privateAppRouteSources.filter(source => source !== '/app.html')) {
    assert.ok(root.rewrites.some(route => route.source === source && route.destination === '/app.html'), source)
  }
  assert.ok(root.rewrites.some(route => route.source.startsWith('/api/') && route.destination.includes('onrender.com')))
  for (const route of sitemapRoutes(dist)) {
    const file = route === '/' ? 'index.html' : `${route.replace(/^\//, '').replace(/\/$/, '')}/index.html`
    assert.ok(fs.existsSync(new URL(file, dist)), route)
  }
})

test('the static error page has readable recovery links, noindex and no homepage canonical', () => {
  const html = fs.readFileSync(new URL('404.html', dist), 'utf8')
  assert.match(html, /<h1>ページが見つかりません<\/h1>/)
  assert.match(html, /name="robots" content="noindex,follow"/)
  assert.doesNotMatch(html, /rel="canonical"|<script|http-equiv="refresh"/)
  for (const path of ['/', '/tools/', '/guides/', '/support']) assert.ok(html.includes(`href="${path}"`))
  assert.ok(!sitemapRoutes(dist).includes('/404.html'))
})
