import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { calcTenGod } from '../../../backend/src/lib/divination/index.ts'
import { generateFortune, termInstant, chartAt, jst } from './fortune-2027.ts'
import { fortunePages } from '../../annual-fortune.js'

const data = JSON.parse(fs.readFileSync(new URL('../../data/fortune-2027.json', import.meta.url), 'utf8'))
const source = fs.readFileSync(new URL('../../build-script.js', import.meta.url), 'utf8')
const godCode = source.match(/const tenGodOf = [\s\S]*?\n};/)![0]
const stageCode = ['BRANCH_ORDER', 'GROWTH_START_BRANCH', 'GROWTH_ORDER'].map(name => source.match(new RegExp(`const ${name} = [^;]+;`))![0]).join('\n') + '\n' + source.match(/const stageBranch = [\s\S]*?\n};/)![0]
const tenGodOf = vm.runInNewContext(godCode + '\ntenGodOf')
const stageBranch = vm.runInNewContext(stageCode + '\nstageBranch')
const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

test('checked-in annual data exactly reproduces the current reading engine', () => {
  assert.deepEqual(data, generateFortune(2027))
})
test('2027 is 丁未 and solar-term times use Japan time including date rollover', () => {
  assert.equal(data.yearPillar, '丁未')
  assert.equal(data.startAt, '2027-02-04T10:46:18+09:00')
  assert.equal(data.months[9].startAt, '2027-11-08T00:38:35+09:00')
  assert.equal(data.endAt, jst(termInstant(2028, '立春')))
})
test('all 12 monthly pillars change at the engine solar-term boundary', () => {
  const expected = ['壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑']
  data.months.forEach((month: any, i: number) => {
    const at = Date.parse(month.startAt)
    assert.equal(chartAt(at + 60000).month.kanshi, month.pillar)
    assert.notEqual(chartAt(at - 60000).month.kanshi, month.pillar)
    assert.equal(month.pillar, expected[i])
    assert.equal(month.endAt, data.months[i + 1]?.startAt ?? data.endAt)
    assert.ok(Date.parse(month.endAt) > at)
  })
  assert.notEqual(chartAt(Date.parse(data.startAt) - 60000).year.kanshi, '丁未')
  assert.equal(chartAt(Date.parse(data.startAt) + 60000).year.kanshi, '丁未')
  assert.notEqual(chartAt(Date.parse(data.endAt) + 60000).year.kanshi, '丁未')
})
test('all 260 star values agree with the engine and the existing article lookup rules', () => {
  let checked = 0
  data.stems.forEach((item: any, index: number) => {
    const entries = [{ pillar: data.yearPillar, ...item.annual }, ...item.months.map((value: any, i: number) => ({ pillar: data.months[i].pillar, ...value }))]
    for (const entry of entries) {
      const target = stems.indexOf(entry.pillar[0])
      assert.equal(entry.tenGod, calcTenGod(index, target))
      assert.equal(entry.tenGod, tenGodOf(index, target))
      assert.equal(stageBranch(index, entry.twelveStage), entry.pillar[1])
      checked += 2
    }
  })
  assert.equal(checked, 260)
})
test('the same generator handles the following year without changing templates', () => {
  const following = generateFortune(2028)
  assert.equal(following.yearPillar, chartAt(termInstant(2028, '立春') + 60000).year.kanshi)
  assert.equal(following.months.length, 12)
  assert.equal(following.stems.length, 10)
  assert.equal(following.startAt, data.endAt)
  const lookup = (name: string) => vm.runInNewContext(source.match(new RegExp(`const ${name} = [^;]+;`))![0] + `\n${name}`)
  const rendered = fortunePages(following, {
    stemSlugs: lookup('STEM_SLUG'), godSlugs: lookup('TEN_GOD_SLUG'), stageSlugs: lookup('STAGE_SLUG'),
    inlineCta: (_lead: string, href: string, label: string) => `<a href="${href}">${label}</a>`,
  })
  assert.equal(rendered.pages.length, 11)
  assert.equal(rendered.root, 'guides/2028-fortune')
  assert.ok(rendered.pages.every((page: any) => page.path.startsWith('guides/2028-fortune')))
  assert.throws(() => generateFortune(2027.5), RangeError)
})
