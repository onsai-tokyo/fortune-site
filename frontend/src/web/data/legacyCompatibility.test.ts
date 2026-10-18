import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('both deployment configs keep legacy reading routes and existing API proxy', () => {
  for (const path of ['../../../vercel.json', '../../../../vercel.json']) {
    const config = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
    for (const prefix of ['/r/', '/s/', '/reading/']) assert.ok(!config.redirects.some((r: { source: string }) => r.source.startsWith(prefix)))
    assert.ok(config.rewrites.some((r: { source: string; destination: string }) => r.source === '/api/:path*' && r.destination === 'https://fortune-site-iuzo.onrender.com/api/:path*'))
  }
})

test('SPA does not initialize Analytics and suppresses sensitive URL referrers', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8')
  assert.match(html, /name="referrer" content="no-referrer"/)
  assert.match(html, /window\['ga-disable-G-FPZ7QKTXLJ'\] = true/)
  assert.doesNotMatch(html, /googletagmanager\.com|gtag\('config'/)
  assert.match(html, /noindex,nofollow/)
})
