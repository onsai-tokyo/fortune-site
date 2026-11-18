import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { crawlEntryLinks } from '../src/web/data/crawlEntryLinks.js'
import { sitemapRoutes } from './helpers/sitemaps.js'

const dist = new URL('../dist/', import.meta.url)
const origin = 'https://fate-lab.com'
const html = route => fs.readFileSync(new URL(route === '/' ? 'index.html' : `${route.slice(1).replace(/\/$/, '')}/index.html`, dist), 'utf8')
const routes = sitemapRoutes(dist)
const normalize = route => route.replace(/\/$/, '') || '/'

function links(markup, route) {
  // Inline scripts also contain HTML strings. Only rendered anchors count as crawl entrances.
  const document = markup.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  return [...document.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map(([, href]) => new URL(href.replaceAll('&amp;', '&'), `${origin}${route}`))
    .filter(url => url.origin === origin).map(url => normalize(url.pathname))
}

test('all sitemap pages are reachable from the initial homepage HTML within three clicks', t => {
  const graph = new Map(routes.map(route => [normalize(route), links(html(route), route)]))
  const distance = new Map([['/', 0]])
  const queue = ['/']
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    for (const target of graph.get(current) ?? []) {
      if (graph.has(target) && !distance.has(target)) {
        distance.set(target, distance.get(current) + 1)
        queue.push(target)
      }
    }
  }
  assert.ok(routes.length >= 96)
  for (const route of routes) assert.ok(distance.get(normalize(route)) <= 3, `Not reachable within three clicks: ${route}`)
  t.diagnostic(`${routes.length} sitemap URLs, maximum ${Math.max(...distance.values())} clicks`)
})

test('the initial homepage has all eight crawl entrances in the specified order', () => {
  const homepage = html('/')
  const footer = homepage.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)[1]
  const actual = [...footer.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].slice(0, 8).map(([, href, label]) => [href, label])
  assert.deepEqual(actual, crawlEntryLinks)
  assert.ok(homepage.includes('<div id="root"><noscript><div class="fl-root">'))
})

test('the guide index groups every guide once and starts each theme with its introduction', () => {
  const sections = [...html('/guides/').matchAll(/<h2>([^<]+)<\/h2><ul class="guide-list">([\s\S]*?)<\/ul>/g)]
  assert.deepEqual(sections.map(([, heading]) => heading), [
    '四柱推命の基本', '日干10種類', '通変星10種類', '十二運12種類', '算命学', '相性',
    '恋愛の悩み（復縁・片思い・相手の気持ち）', '婚期・時期', '2027年の運勢', 'そのほか',
  ])
  assert.deepEqual(sections.map(([, , body]) => links(body, '/guides/')[0]), [
    '/guides/shichu-suimei', '/guides/day-master', '/guides/ten-god', '/guides/twelve-stage',
    '/guides/sanmeigaku', '/guides/compatibility', '/guides/partner-feelings', '/guides/marriage-timing', '/guides/2027-fortune', '/guides/birthdate-fortune',
  ])
  const cards = sections.flatMap(([, , body]) => links(body, '/guides/'))
  const guideRoutes = routes.filter(route => route.startsWith('/guides/') && route !== '/guides/').map(normalize)
  assert.equal(cards.length, guideRoutes.length)
  assert.deepEqual([...new Set(cards)].sort(), guideRoutes.sort())
})

const series = [
  ['/guides/day-master', '日干', ['kinoe', 'kinoto', 'hinoe', 'hinoto', 'tsuchinoe', 'tsuchinoto', 'kanoe', 'kanoto', 'mizunoe', 'mizunoto']],
  ['/guides/ten-god', '通変星', ['hiken', 'gozai', 'shokujin', 'shokan', 'henzai', 'seizai', 'henkan', 'seikan', 'henin', 'seiin']],
  ['/guides/twelve-stage', '十二運', ['chosei', 'mokuyoku', 'kantai', 'kenroku', 'teio', 'sui', 'byo', 'shi', 'bo', 'zetsu', 'tai', 'yo']],
]

test('series introductions link to all 32 members and their breadcrumbs lead back to the introduction', () => {
  for (const [parent, label, slugs] of series) {
    const introduction = html(parent).match(/<article>([\s\S]*?)<\/article>/)[1]
    for (const slug of slugs) {
      const route = `${parent}/${slug}`
      assert.ok(links(introduction, parent).includes(route), `${parent} must link to ${slug}`)
      const member = html(route)
      const breadcrumb = member.match(/<div class="breadcrumb">([\s\S]*?)<\/div>/)[1]
      assert.ok(breadcrumb.includes(`<a href="${parent}">${label}</a>`))
      const schemas = [...member.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json))
      const items = schemas.flatMap(schema => schema['@graph'] ?? []).find(schema => schema['@type'] === 'BreadcrumbList').itemListElement
      assert.deepEqual(items.map(item => item.item), [origin + '/', origin + '/guides/', origin + parent, origin + route])
      assert.deepEqual(items.map(item => item.position), [1, 2, 3, 4])
    }
  }
})

test('registered relationship guides have contextual calculation links and at most four related links', () => {
  const relationshipSlugs = ['partner-feelings', 'one-sided-love', 'reconciliation-timing', 'ex-partner-feelings',
    'married-partner-feelings', 'marriage-timing', 'marriage-compatibility', 'meeting-timing', 'compatibility']
  for (const slug of relationshipSlugs) {
    const route = `/guides/${slug}`
    const article = html(route).match(/<article>([\s\S]*?)<\/article>/)[1]
    assert.ok(links(article, route).some(target => ['/tools/day-master', '/tools/shichu-suimei-calculator'].includes(target)), route)
  }
  const marriageRelated = html('/guides/marriage-timing').match(/<aside class="related">([\s\S]*?)<\/aside>/)[1]
  assert.ok(links(marriageRelated, '/guides/marriage-timing').includes('/guides/ten-god/seikan'))
  for (const route of routes.filter(route => route.startsWith('/guides/') && route !== '/guides/')) {
    const related = html(route).match(/<aside class="related">([\s\S]*?)<\/aside>/)[1]
    const targets = links(related, route)
    assert.equal(targets.length, 4, route)
    assert.equal(new Set(targets).size, targets.length, route)
    for (const target of targets) assert.ok(fs.existsSync(new URL(`${target.slice(1)}/index.html`, dist)), target)
  }
})

test('the day master result links all ten calculated stems to their existing explanation pages', async () => {
  const script = [...html('/tools/day-master').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .find(([, source]) => source.includes("getElementById('day-master-tool')"))[1]
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
  const examples = JSON.parse(fs.readFileSync(new URL('../article-data/series-examples.json', import.meta.url), 'utf8')).stem
  for (let index = 0; index < stems.length; index += 1) {
    let submit
    const result = {}
    const example = examples[stems[index]]
    const birthDate = example.date
    const shichuDay = example.pillars.find(pillar => pillar.label === '日柱').kanshi
    const document = { getElementById: id => ({
      'day-master-tool': { addEventListener: (_, listener) => { submit = listener } },
      'day-master-date': { value: birthDate }, 'day-master-result': result,
    })[id] }
    vm.runInNewContext(script, { document, fetch: async (url, options) => {
      assert.equal(url, '/api/calc/shichu')
      assert.deepEqual(JSON.parse(options.body), { birthDate })
      return { ok: true, json: async () => ({ shichuDay }) }
    } })
    await submit({ preventDefault() {} })
    const target = `/guides/day-master/${series[0][2][index]}`
    assert.ok(result.innerHTML.includes(`href="${target}"`))
    assert.ok(result.innerHTML.includes(`あなたの日干「${stems[index]}」の解説`))
    assert.ok(!target.includes(birthDate))
  }
})
