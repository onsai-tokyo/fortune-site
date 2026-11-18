import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { calcShichuResult, calcTenGod } from '../../../backend/src/lib/divination/index.ts'
import { buildSeriesExamples } from './series-examples.ts'

const data = JSON.parse(fs.readFileSync(new URL('../../article-data/series-examples.json', import.meta.url), 'utf8'))
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const slugs = {
  stem: ['kinoe', 'kinoto', 'hinoe', 'hinoto', 'tsuchinoe', 'tsuchinoto', 'kanoe', 'kanoto', 'mizunoe', 'mizunoto'],
  god: ['hiken', 'gozai', 'shokujin', 'shokan', 'henzai', 'seizai', 'henkan', 'seikan', 'henin', 'seiin'],
  stage: ['chosei', 'mokuyoku', 'kantai', 'kenroku', 'teio', 'sui', 'byo', 'shi', 'bo', 'zetsu', 'tai', 'yo'],
}
const families = { stem: 'day-master', god: 'ten-god', stage: 'twelve-stage' }
const strip = (html: string) => html.replace(/<[^>]*>/g, '')

test('32 distinct real dates are in 1980–2005 and all printed example cells equal the engine', () => {
  const dates = new Set<string>()
  let count = 0
  for (const group of ['stem', 'god', 'stage'] as const) {
    Object.entries(data[group]).forEach(([name, example]: [string, any], i) => {
      const [y, m, d] = example.date.split('-').map(Number)
      assert.ok(y >= 1980 && y <= 2005, name)
      assert.equal(new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10), example.date)
      assert.ok(!dates.has(example.date), `duplicate example: ${name}`)
      dates.add(example.date)
      const result = calcShichuResult(y, m, d)
      assert.equal(result.fourPillars.length, 3)
      const expected = result.fourPillars.map(p => ({ label: p.label, kanshi: p.kanshi,
        tenGod: p.stemTenGod, stage: p.twelveStage,
        hidden: p.hiddenStems.map(h => `${h.stem}（${h.tenGod}）`).join('・') }))
      assert.deepEqual(example.pillars, expected, `${group}/${name}`)
      if (group === 'stem') {
        assert.equal(result.shichuDay[0], name)
        assert.ok(['寅', '卯', '辰'].includes(result.fourPillars[1].kanshi[1]))
      }
      if (group === 'god') assert.equal(result.fourPillars[1].stemTenGod, name)
      if (group === 'stage') assert.equal(result.fourPillars[2].twelveStage, name)
      for (const offset of [-1, 1]) {
        const date = new Date(Date.UTC(y, m - 1, d + offset))
        assert.equal(calcShichuResult(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).fourPillars[1].kanshi, result.fourPillars[1].kanshi)
      }
      const html = fs.readFileSync(new URL(`../../dist/guides/${families[group]}/${slugs[group][i]}/index.html`, import.meta.url), 'utf8')
      const table = html.match(/<h2>実例：[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1]
      assert.ok(table, `missing example: ${name}`)
      const rows = [...table.matchAll(/<tr>(.*?)<\/tr>/g)].map(([, row]) => [...row.matchAll(/<t[hd]>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) => strip(cell)))
      assert.equal(rows.length, 3)
      expected.forEach((p, j) => {
        assert.deepEqual(rows[j].slice(0, 2), [p.label, p.kanshi])
        assert.equal(rows[j][2], p.tenGod === '日主' ? (name === '長生' ? '（日干）' : '日主（本人）') : p.tenGod)
        assert.equal(rows[j][3], p.stage)
        if (name !== '長生') assert.equal(rows[j][4], p.hidden)
      })
      count++
    })
  }
  assert.equal(count, 32)
})

test('100 forward/reverse stem relations and the ten compatibility FAQs follow the engine', () => {
  STEMS.forEach((name, d) => STEMS.forEach((other, t) => {
    assert.deepEqual(data.relations[name][other], { tenGod: calcTenGod(d, t), reverseTenGod: calcTenGod(t, d) })
  }))
  STEMS.forEach((name, i) => {
    const peer = STEMS[i ^ 1]
    const relation = data.relations[name][peer]
    const html = fs.readFileSync(new URL(`../../dist/guides/day-master/${slugs.stem[i]}/index.html`, import.meta.url), 'utf8')
    assert.ok(html.includes(`${name}から${peer}を見る通変星は${relation.tenGod}で、逆に${peer}から${name}を見ても${relation.reverseTenGod}です。`))
  })
})

test('the checked-in article examples can be regenerated without changes', () => {
  assert.deepEqual(buildSeriesExamples(), data)
})
