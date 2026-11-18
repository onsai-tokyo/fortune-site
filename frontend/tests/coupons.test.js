import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { couponOffers } from '../src/web/data/couponOffers.ts'
import { checkedAtLabel, couponCheckSummary, couponPageMetadata, couponComparisonHtml, warnStaleCouponChecks } from '../src/web/data/couponPageCopy.js'
import { couponParameters } from '../src/web/data/measurementRules.js'
import { japanDate } from '../seo/lastmod.js'

const html = () => fs.readFileSync(new URL('../dist/coupons/index.html', import.meta.url), 'utf8')
const unescape = text => text.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
const text = markup => unescape(markup.replace(/<[^>]*>/g, ''))

test('coupon search metadata uses service count and never claims an unrecorded confirmation date', () => {
  const page = html(), meta = couponPageMetadata(couponOffers)
  assert.ok(page.includes(`<title>${meta.title}｜Fate Lab</title>`))
  assert.ok(page.includes(`<meta name="description" content="${meta.description}"`))
  assert.ok(page.includes(`<meta property="og:title" content="${meta.title}｜Fate Lab"`))
  assert.ok(meta.title.includes(`${couponOffers.length}サービス`))
  assert.ok(!meta.title.includes(`${couponOffers.length}社`))
  const summary = couponCheckSummary(couponOffers)
  assert.ok(meta.description.includes(summary.latest || '確認中'))
  assert.match(page, /<link rel="canonical" href="https:\/\/fate-lab.com\/coupons"/)
  assert.doesNotMatch(page.match(/<meta name="robots"[^>]*>/)[0], /noindex/)
  if (summary.unchecked) assert.doesNotMatch(page, /各社の公式ページを確認しています|全件確認済み/)
})

test('no-JS comparison rows match every offer and retain all conditions and official links', () => {
  const page = html(), body = couponComparisonHtml(couponOffers)
  assert.ok(page.includes(body))
  const rows = [...body.matchAll(/<tr data-offer-id="([^"]+)">(.*?)<\/tr>/g)]
  assert.deepEqual(rows.map(([, id]) => id), couponOffers.map(offer => offer.id))
  rows.forEach(([, , row], i) => {
    const offer = couponOffers[i]
    const cells = [...row.matchAll(/<(?:th|td)\b[^>]*>(.*?)<\/(?:th|td)>/g)].map(([, cell]) => text(cell))
    assert.equal(cells.length, 8)
    assert.equal(cells[0], offer.name)
    assert.equal(cells[1], offer.channel === 'phone' ? '電話' : 'チャット')
    assert.equal(cells[2], [offer.prefix, offer.amount, offer.unit].filter(Boolean).join(' '))
    assert.equal(cells[3], offer.facts.target)
    assert.ok(cells[4].includes(offer.facts.terms))
    if (offer.example) assert.ok(cells[4].includes(offer.example))
    assert.equal(cells[5], offer.facts.validity)
    assert.equal(cells[6], checkedAtLabel(offer.checkedAt))
    assert.ok(row.includes(`href="${offer.officialDetailsUrl.replaceAll('&', '&amp;')}"`))
  })
  assert.ok(body.includes('広告を含みます'))
  assert.ok(body.includes('チケット番号順'))
  assert.equal([...body.matchAll(/<h3\b/g)].length, 4)
  assert.doesNotMatch(body, /<script|<noscript|\bhidden\b|display:\s*none|href="\/uranai\//)
  assert.doesNotMatch(body, /px\.a8\.net|0\.gif|<img/)
})

test('confirmation dates distinguish unknown, valid and invalid calendar values', () => {
  assert.equal(checkedAtLabel(''), '確認中')
  assert.equal(checkedAtLabel('2024-02-29'), '2024-02-29')
  for (const value of ['2026-02-29', '2026-13-01', '2026-1-01', undefined]) assert.throws(() => checkedAtLabel(value), /Invalid coupon checkedAt/)
  const partial = couponOffers.map((offer, i) => ({ ...offer, checkedAt: i === 0 ? '2026-11-01' : i === 1 ? '2026-10-01' : '' }))
  assert.deepEqual(couponCheckSummary(partial), { count: 6, latest: '2026-11-01', unchecked: 4 })
  const meta = couponPageMetadata(partial)
  assert.ok(meta.description.includes('2026-11-01'))
  assert.ok(meta.description.includes('確認日未記録4件'))
  assert.ok(couponComparisonHtml(partial).includes('確認日の記録がない特典は4件'))
})

test('the stale-date boundary is inclusive at 90 days and unknown dates are not fabricated', () => {
  const warnings = []
  const today = '2026-11-18'
  const date = days => new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10)
  const offers = [89, 90, 91].map((days, i) => ({ ...couponOffers[i], checkedAt: date(days) }))
  warnStaleCouponChecks([...offers, { ...couponOffers[3], checkedAt: '' }], { today, warn: message => warnings.push(message) })
  assert.equal(warnings.length, 2)
  assert.ok(warnings[0].includes(couponOffers[1].id) && warnings[0].includes('90 days'))
  assert.ok(warnings[1].includes(couponOffers[2].id) && warnings[1].includes('91 days'))
  assert.throws(() => warnStaleCouponChecks([{ ...couponOffers[0], checkedAt: '2026-11-19' }], { today }), /Future coupon checkedAt/)
})

test('every service ID matches the existing measurement allowlist and private fields are dropped', () => {
  for (const offer of couponOffers) {
    assert.deepEqual(couponParameters({ offer_id: offer.id, link_type: 'affiliate', birthDate: 'private', gender: 'private', reading_id: 'private' }), { offer_id: offer.id, link_type: 'affiliate' })
    assert.equal(couponParameters({ offer_id: offer.id, link_type: 'official' }).offer_id, offer.id)
  }
  const source = fs.readFileSync(new URL('../src/web/data/measurementRules.js', import.meta.url), 'utf8')
  const ids = [...source.match(/const offers = new Set\(\[(.*?)\]\)/)[1].matchAll(/'([^']+)'/g)].map(([, id]) => id)
  assert.deepEqual(ids.sort(), couponOffers.map(offer => offer.id).sort())
  assert.deepEqual(couponParameters({ offer_id: '/r/private', link_type: 'private' }), { offer_id: undefined, link_type: undefined })
})

test('a full build warns about a 90-day-old offer and renders dates from the same TS data', { timeout: 90000 }, t => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fatelab-coupon-build-'))
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }))
  const fixture = path.join(workspace, 'frontend')
  fs.cpSync(root, fixture, { recursive: true, filter: source => !['node_modules', 'dist', '.vercel'].includes(path.basename(source)) && !path.basename(source).startsWith('.env') })
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), 'dir')
  fs.symlinkSync(path.resolve(root, '../backend'), path.join(workspace, 'backend'), 'dir')
  const data = path.join(fixture, 'src/web/data/couponOffers.ts')
  const stale = new Date(Date.parse(japanDate()) - 90 * 86400000).toISOString().slice(0, 10)
  fs.writeFileSync(data, fs.readFileSync(data, 'utf8').replace("checkedAt: ''", `checkedAt: '${stale}'`))
  const result = spawnSync('npm', ['run', 'build'], { cwd: fixture, timeout: 35000, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stderr.includes(`Coupon confirmation is 90+ days old: coconala-phone (${stale}, 90 days)`))
  const generated = fs.readFileSync(path.join(fixture, 'dist/coupons/index.html'), 'utf8')
  assert.ok(generated.includes(`最終確認日：${stale}`))
  assert.ok(generated.includes('確認日未記録5件'))
  assert.ok(generated.match(/data-offer-id="coconala-phone"[\s\S]*?<\/tr>/)[0].includes(stale))
  assert.ok(result.stdout.includes('Generated SEO HTML'))
})
