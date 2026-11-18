// 日干・通変星・十二運の個別記事に載せる実例を、鑑定と同じ計算関数で探して JSON に書き出す。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/series-examples.ts
// 出力: frontend/article-data/series-examples.json（build-script.js が読み込む）
import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'node:url'
import { calcShichuResult, calcTenGod } from '../../../backend/src/lib/divination/index.ts'

type Pillar = { label: string; kanshi: string; stemTenGod: string; twelveStage: string; hiddenStems: { stem: string; tenGod: string }[] }
const STAGES = ['長生', '沐浴', '冠帯', '建禄', '帝旺', '衰', '病', '死', '墓', '絶', '胎', '養']
const GODS = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '正印']
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

const toExample = (y: number, m: number, d: number) => {
  const r = calcShichuResult(y, m, d)
  return {
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    pillars: (r.fourPillars as Pillar[]).map(p => ({ label: p.label, kanshi: p.kanshi, tenGod: p.stemTenGod, stage: p.twelveStage, hidden: p.hiddenStems.map(h => `${h.stem}（${h.tenGod}）`).join('・') })),
  }
}
// 記事ごとに探し始める年をずらし、条件に合う最初の日を実例にする（同じ年の例ばかりにならないようにする）。
const findDate = (startYear: number, startMonth: number, used: Set<string>, test: (pillars: Pillar[]) => boolean, startDay = 1) => {
  const first = Date.UTC(1980, 0, 1), end = Date.UTC(2006, 0, 1), days = (end - first) / 86400000
  const start = (Date.UTC(startYear, startMonth - 1, startDay) - first) / 86400000
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(first + ((start + offset) % days) * 86400000)
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    if (used.has(date.toISOString().slice(0, 10))) continue
    // 節入りの前後1日は月柱が時刻で変わりうるため、実例に使わない。
    const monthOf = (shift: number) => { const t = new Date(Date.UTC(y, m - 1, d + shift)); return (calcShichuResult(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()).fourPillars as Pillar[])[1].kanshi }
    const pillars = calcShichuResult(y, m, d).fourPillars as Pillar[]
    if (monthOf(-1) !== pillars[1].kanshi || monthOf(1) !== pillars[1].kanshi) continue
    if (test(pillars)) {
      const example = toExample(y, m, d)
      used.add(example.date)
      return example
    }
  }
  throw new Error('実例が見つかりません')
}
export function buildSeriesExamples() {
  const used = new Set<string>()
  const stage: Record<string, ReturnType<typeof toExample>> = {}, god: typeof stage = {}, stem: typeof stage = {}
  STAGES.forEach((name, i) => {
    // Preserve the independently verified example in the existing 長生 article.
    stage[name] = name === '長生'
      ? findDate(1990, 5, used, ([, , day]) => day.twelveStage === name, 7)
      : findDate(1980 + (4 + i * 3) % 26, 1 + (i * 5) % 12, used, ([, , day]) => day.twelveStage === name)
  })
  GODS.forEach((name, i) => { god[name] = findDate(1980 + (6 + i * 3) % 26, 1 + (i * 7) % 12, used, ([, month]) => month.stemTenGod === name) })
  // 日干の実例は、季節の読み方を示すため春（月支が寅・卯・辰）から選ぶ。
  STEMS.forEach((name, i) => { stem[name] = findDate(1980 + (5 + i * 3) % 26, 3, used, ([, month, day]) => day.kanshi[0] === name && ['寅', '卯', '辰'].includes(month.kanshi[1])) })
  const relations = Object.fromEntries(STEMS.map((name, d) => [name, Object.fromEntries(STEMS.map((other, t) => [other, { tenGod: calcTenGod(d, t), reverseTenGod: calcTenGod(t, d) }]))]))
  return { note: 'scripts/article-data/series-examples.ts で生成。手で編集しない。', range: { from: 1980, to: 2005 }, stage, god, stem, relations }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = buildSeriesExamples()
  fs.writeFileSync(path.join(import.meta.dirname, '..', '..', 'article-data', 'series-examples.json'), `${JSON.stringify(out, null, 2)}\n`)
  console.log('十二運', Object.keys(out.stage).length, '通変星', Object.keys(out.god).length, '日干', Object.keys(out.stem).length, '関係', 100)
}
