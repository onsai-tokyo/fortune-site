// 日干・通変星・十二運の個別記事に載せる実例を、鑑定と同じ計算関数で探して JSON に書き出す。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/series-examples.ts
// 出力: frontend/article-data/series-examples.json（build-script.js が読み込む）
import fs from 'fs'
import path from 'path'
import { calcShichuResult } from '../../../backend/src/lib/divination/index.ts'

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
const stage: Record<string, unknown> = {}
const god: Record<string, unknown> = {}
const stem: Record<string, unknown> = {}
// 記事ごとに探し始める年をずらし、条件に合う最初の日を実例にする（同じ年の例ばかりにならないようにする）。
const findDate = (startYear: number, startMonth: number, test: (pillars: Pillar[]) => boolean) => {
  for (let offset = 0; offset < 4000; offset++) {
    const date = new Date(Date.UTC(startYear, startMonth - 1, 1 + offset))
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    // 節入りの前後1日は月柱が時刻で変わりうるため、実例に使わない。
    const monthOf = (shift: number) => { const t = new Date(Date.UTC(y, m - 1, d + shift)); return (calcShichuResult(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()).fourPillars as Pillar[])[1].kanshi }
    const pillars = calcShichuResult(y, m, d).fourPillars as Pillar[]
    if (monthOf(-1) !== pillars[1].kanshi || monthOf(1) !== pillars[1].kanshi) continue
    if (test(pillars)) return toExample(y, m, d)
  }
  throw new Error('実例が見つかりません')
}
STAGES.forEach((name, i) => { stage[name] = findDate(1984 + i * 3, 1 + (i * 5) % 12, ([, , day]) => day.twelveStage === name) })
GODS.forEach((name, i) => { god[name] = findDate(1986 + i * 3, 1 + (i * 7) % 12, ([, month]) => month.stemTenGod === name) })
// 日干の実例は、季節の読み方を示すため春（月支が寅・卯・辰）の生まれから選ぶ。
STEMS.forEach((name, i) => { stem[name] = findDate(1985 + i * 3, 3, ([, month, day]) => day.kanshi[0] === name && ['寅', '卯', '辰'].includes(month.kanshi[1])) })
const out = { note: 'scripts/article-data/series-examples.ts で生成。手で編集しない。', stage, god, stem }
fs.writeFileSync(path.join(import.meta.dirname, '..', '..', 'article-data', 'series-examples.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log('十二運', Object.keys(stage).length, '通変星', Object.keys(god).length, '日干', Object.keys(stem).length)
