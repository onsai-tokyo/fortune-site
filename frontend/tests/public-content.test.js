import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { birthDateError } from '../scripts/public-birthdate.js'

test('birth date controls reject impossible dates, incomplete selections and dates outside their bounds', () => {
  const bounds = { min: '1900-01-01', max: '2026-11-19' }
  for (const parts of [['1995', '02', '20'], ['2000', '02', '29'], ['2026', '11', '19']]) {
    assert.equal(birthDateError(parts, bounds), '')
  }
  for (const parts of [['1900', '02', '29'], ['1995', '02', '31'], ['2026', '11', '20'], ['1899', '12', '31'], ['1995', '', '20']]) {
    assert.notEqual(birthDateError(parts, bounds), '', parts.join('-'))
  }
  assert.notEqual(birthDateError(['', '', ''], bounds), '')
  assert.equal(birthDateError(['', '', ''], { ...bounds, required: false }), '')
})

test('every generated public content page uses the current shared shell and date enhancement', () => {
  const dist = new URL('../dist/', import.meta.url)
  const pages = fs.readdirSync(dist, { recursive: true }).filter(file => file.endsWith('.html'))
  let count = 0
  for (const file of pages) {
    const html = fs.readFileSync(new URL(file, dist), 'utf8')
    if (!html.includes('<header class="content-header">')) continue
    count++
    assert.match(html, /<body class="guide-theme content-page">/, file)
    assert.match(html, /--content-gutter: clamp\(20px, 5\.6vw, 40px\)/, file)
    assert.match(html, /<footer class="content-footer">/, file)
    assert.match(html, /src="\/assets\/fl-public-birthdate\.js"/, file)
    assert.doesNotMatch(html, /background-image:radial-gradient\(circle at 8% 12%/, file)
  }
  assert.equal(count, 91)
  assert.ok(fs.existsSync(path.join(dist.pathname, 'assets/fl-public-birthdate.js')))
})
