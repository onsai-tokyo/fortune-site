import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

const dist = new URL('../dist/', import.meta.url)
const html = route => fs.readFileSync(new URL(`${route}/index.html`, dist), 'utf8')
const article = route => html(route).match(/<article>([\s\S]*?)<\/article>/)[1]
const text = value => value.replace(/<[^>]*>/g, '')
const stems = ['kinoe', 'kinoto', 'hinoe', 'hinoto', 'tsuchinoe', 'tsuchinoto', 'kanoe', 'kanoto', 'mizunoe', 'mizunoto']

test('shichu starts with the actual free results and has three reading steps before the result', () => {
  const page = article('tools/shichu-suimei-calculator')
  const first = text(page.match(/<p>(.*?)<\/p>/)[1])
  for (const name of ['命式', '日干', '通変星', '十二運', '五行', '大運', '年運', '会員登録は不要', '計算後に性別を選んで']) assert.ok(first.includes(name))
  const afterForm = page.slice(page.indexOf('</form>') + '</form>'.length)
  assert.ok(afterForm.startsWith('<ol>'))
  const steps = afterForm.match(/^<ol>(.*?)<\/ol>/)[1]
  assert.equal([...steps.matchAll(/<li>/g)].length, 3)
  assert.deepEqual([...steps.matchAll(/href="([^"]+)"/g)].map(([, href]) => href), ['/guides/day-master', '/guides/ten-god', '/guides/twelve-stage'])
  assert.ok(afterForm.indexOf('</ol>') < afterForm.indexOf('id="shichu-result"'))
  assert.match(html('tools/shichu-suimei-calculator'), /<title>四柱推命の無料計算｜生年月日で命式・日干・大運を調べる（登録不要）｜Fate Lab<\/title>/)
})

test('all ten day-stem explanations are linked in an initially readable table', () => {
  const page = article('tools/shichu-suimei-calculator')
  const table = page.match(/<h2>日干10種類の解説<\/h2><div class="table-scroll">([\s\S]*?)<\/table>/)[1]
  const paths = [...table.matchAll(/href="([^"]+)"/g)].map(([, href]) => href)
  assert.deepEqual(paths, stems.map(slug => `/guides/day-master/${slug}`))
  for (const route of paths) assert.ok(fs.existsSync(new URL(`${route.slice(1)}/index.html`, dist)))
  const beforeTable = page.slice(0, page.indexOf('<h2>日干10種類の解説</h2>'))
  assert.ok(beforeTable.lastIndexOf('</section>') > beforeTable.indexOf('<section id="shichu-details" hidden>'))
})

test('day master answers the definition immediately and shows four FAQs without hidden markup', () => {
  const page = article('tools/day-master')
  assert.ok(text(page.match(/<p>(.*?)<\/p>/)[1]).startsWith('日干（にっかん）は、生まれた日の干支の上の文字'))
  const faq = page.slice(page.indexOf('<h2>日干の無料計算でよくある質問</h2>'), page.indexOf('<script>'))
  const questions = [...faq.matchAll(/<h3>([^<]+)<\/h3>/g)].map(([, question]) => question)
  assert.equal(questions.length, 4)
  assert.ok(questions[0].includes('日干と日柱'))
  assert.ok(questions[1].includes('出生時刻'))
  assert.ok(questions[2].includes('性格'))
  assert.ok(questions[3].includes('有名人'))
  assert.match(faq, /このページでは、有名人の例は掲載しません/)
  assert.doesNotMatch(faq, /hidden|display:\s*none/)
  assert.doesNotMatch(html('tools/day-master'), /"@type":"FAQPage"/)
})

test('tool index retains four cards and adds what each result contains', () => {
  const page = article('tools')
  const cards = [...page.matchAll(/<li><a href="([^"]+)"><strong>(.*?)<\/strong><span>(.*?)<\/span><\/a><\/li>/g)]
  assert.equal(cards.length, 4)
  const endings = ['続く詳細で星の配置を確認できます。', '命式の読み方や星の解説へ進めます。', 'その数字が表すテーマを表示します。', '性格・仕事・恋愛の解説へ進めます。']
  cards.forEach((card, i) => assert.ok(card[3].endsWith(endings[i])))
  assert.match(page, /<h1>生年月日の無料占い計算ツール<\/h1>/)
  assert.match(html('tools'), /<title>無料の占い計算ツール一覧｜算命学・四柱推命・日干・数秘術｜Fate Lab<\/title>/)
})

test('shichu still submits a date with blank time to the public API and renders three pillars', async () => {
  const script = [...html('tools/shichu-suimei-calculator').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .find(([, source]) => source.includes("getElementById('shichu-calculator')"))[1]
  const example = JSON.parse(fs.readFileSync(new URL('../article-data/series-examples.json', import.meta.url), 'utf8')).stem['壬']
  const pillars = example.pillars.map(pillar => ({ label: pillar.label, kanshi: pillar.kanshi, stemTenGod: pillar.tenGod, twelveStage: pillar.stage,
    hiddenStems: pillar.hidden.split('・').map(value => { const [, stem, tenGod] = value.match(/^(.)（(.+)）$/); return { stem, tenGod } }),
  }))
  let submit
  const nodes = Object.fromEntries(['shichu-result', 'shichu-details', 'element-bars', 'element-method'].map(id => [id, { hidden: true, scrollIntoView() {} }]))
  nodes['shichu-calculator'] = { addEventListener: (_, listener) => { submit = listener } }
  nodes['shichu-date'] = { value: example.date }
  nodes['shichu-time'] = { value: '' }
  const tbody = {}
  const document = { getElementById: id => nodes[id], querySelector: selector => { assert.equal(selector, '#pillar-result-table tbody'); return tbody } }
  vm.runInNewContext(script, { document, window: {}, fetch: async (url, options) => {
    assert.equal(url, '/api/calc/shichu')
    assert.deepEqual(JSON.parse(options.body), { birthDate: example.date, birthTime: '' })
    assert.deepEqual(Object.keys(options.headers), ['Content-Type'])
    return { ok: true, json: async () => ({ shichuYear: pillars[0].kanshi, shichuMonth: pillars[1].kanshi, shichuDay: pillars[2].kanshi, shichuHour: null, fourPillars: pillars }) }
  } })
  await submit({ preventDefault() {} })
  assert.equal(nodes['shichu-details'].hidden, false)
  assert.equal([...tbody.innerHTML.matchAll(/<tr>/g)].length, 3)
  for (const pillar of pillars) assert.ok(tbody.innerHTML.includes(pillar.kanshi))
  assert.ok(nodes['shichu-result'].innerHTML.includes('時刻不明'))
  assert.ok(nodes['shichu-result'].innerHTML.includes('href="/guides/day-master/mizunoe"'))
})
