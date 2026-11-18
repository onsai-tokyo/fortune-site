import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { coupleLandingHtml, coupleQuestionPagesPublished, coupleSearchMetadata } from '../src/web/data/coupleLandingCopy.js'
import { coupleLandingExample } from '../src/web/data/coupleLandingExample.js'
import { contentHash } from '../seo/lastmod.js'

const html = () => fs.readFileSync(new URL('../dist/couple/index.html', import.meta.url), 'utf8')

test('couple search metadata, canonical and WebApplication consistently describe free birthdate reading', () => {
  const page = html()
  const title = page.match(/<title>(.*?)<\/title>/)[1]
  assert.equal(title, `${coupleSearchMetadata.title}｜Fate Lab`)
  assert.ok(title.includes('相性占い 無料') && title.includes('生年月日'))
  assert.equal((title.match(/Fate Lab/g) ?? []).length, 1)
  assert.ok(page.includes(`<meta name="description" content="${coupleSearchMetadata.description}"`))
  assert.ok(page.includes(`<meta property="og:title" content="${title}"`))
  assert.match(page, /<link rel="canonical" href="https:\/\/fate-lab.com\/couple"/)
  assert.doesNotMatch(page.match(/<meta name="robots"[^>]*>/)[0], /noindex/)
  const entities = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(([, json]) => JSON.parse(json))
  const app = entities.find(entity => entity['@type'] === 'WebApplication')
  assert.equal(app.name, coupleSearchMetadata.title)
  assert.equal(app.description, coupleSearchMetadata.description)
  assert.equal(app.offers.price, 0)
})

test('initial HTML has the shared readable body, three FAQs, example rows and five guide links', () => {
  const page = html(), body = coupleLandingHtml()
  assert.ok(page.includes(body))
  assert.doesNotMatch(body, /<script|<noscript|\bhidden\b|display:\s*none/)
  assert.equal([...body.matchAll(/<h3\b/g)].length, 3)
  for (const heading of ['この相性占いでわかること・わからないこと', '結果の例', '悩み別の使い方', 'よくある質問']) assert.ok(body.includes(heading))
  const targets = [...body.matchAll(/href="([^"]+)"/g)].map(([, href]) => href)
  assert.deepEqual(targets, ['/guides/reconciliation-timing', '/guides/one-sided-love', '/guides/partner-feelings', '/guides/marriage-compatibility', '/guides/compatibility', '/uranai/fukuen', '/uranai/kataomoi', '/uranai/aite-no-kimochi'])
  for (const target of targets) assert.ok(fs.existsSync(new URL(`../dist${target}/index.html`, import.meta.url)))
  assert.equal([...body.matchAll(/<tbody>(.*?)<\/tbody>/g)][0][1].match(/<tr>/g).length, 3)
  for (const row of coupleLandingExample.rows) {
    assert.ok(body.includes(row.title))
    assert.ok(body.includes(row.excerpt))
  }
  assert.ok(body.includes('月日まで必要'))
  assert.ok(body.includes('出会った年の選択は必須'))
  assert.ok(body.includes('友人・親友・親・子・兄弟姉妹'))
  assert.doesNotMatch(body, /今年まで|関係が必ず|確実に復縁/)
})

test('published question pages share the same links in HTML and React while the off flag hides them', () => {
  assert.equal(coupleQuestionPagesPublished, true)
  assert.match(html(), /href="\/uranai\//)
  assert.doesNotMatch(coupleLandingHtml(false), /href="\/uranai\//)
  const released = [...coupleLandingHtml(true).matchAll(/href="(\/uranai\/[^"#?]+)"/g)].map(([, href]) => href)
  assert.deepEqual(released, ['/uranai/fukuen', '/uranai/kataomoi', '/uranai/aite-no-kimochi'])
})

test('copy after the sample table is included in the content hash for accurate lastmod', () => {
  const page = html()
  assert.match(page, /<article>[\s\S]*相手の生まれた年しかわからないときは？[\s\S]*<\/article>/)
  const revised = page.replace('相手の生まれた年しかわからないときは？', '相手の誕生日が不明なときは？')
  assert.notEqual(contentHash(page), contentHash(revised))
})
