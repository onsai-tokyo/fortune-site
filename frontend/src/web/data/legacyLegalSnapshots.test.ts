import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const snapshot = JSON.parse(readFileSync(new URL('./legacyLegalSnapshots.json', import.meta.url), 'utf8'))
test('app legal reference is tied to unchanged main sources and contains no executable markup', () => {
  assert.equal(snapshot.sourceCommit, '79da2705966908e91bf49004fad89fbc9bca9837')
  for (const [name, hash] of Object.entries(snapshot.sourceSha256)) {
    const source = readFileSync(new URL(`../../pages/${name}.tsx`, import.meta.url))
    assert.equal(createHash('sha256').update(source).digest('hex'), hash)
  }
  for (const html of Object.values(snapshot.documents) as string[]) {
    assert.doesNotMatch(html, /<script|<iframe|\son\w+=|javascript:|<form|<button/i)
    assert.match(html, /トップに戻る/)
  }
  assert.match(snapshot.documents.terms, /id="ai-consultation"/)
  assert.match(snapshot.documents.terms, /href="\/app-legal\/privacy"/)
})

test('deployment rules retain static SEO destinations and the legacy commerce URL', () => {
  for (const path of ['../../../vercel.json', '../../../../vercel.json']) {
    const config = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
    for (const prefix of ['/guides', '/tools', '/about', '/methodology', '/editorial-policy', '/press', '/tokushohou']) assert.ok(!config.redirects.some((r: { source: string }) => r.source.startsWith(prefix)))
    for (const [source, destination] of [['/guides/:slug', '/guides/:slug/index.html'], ['/tools/:slug', '/tools/:slug/index.html'], ['/methodology', '/methodology/index.html']]) assert.ok(config.rewrites.some((r: { source: string; destination: string }) => r.source === source && r.destination === destination))
    const fallback = config.rewrites.findIndex((r: { destination: string }) => r.destination === '/index.html')
    const guide = config.rewrites.findIndex((r: { source: string }) => r.source === '/guides/:slug')
    assert.ok(guide >= 0 && guide < fallback)
  }
})
