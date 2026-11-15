// 十二運「長生」記事の早見表と実例を、鑑定と同じ計算関数から出力する。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/twelve-stage-chosei.ts
import { calcShichu, calcShichuResult } from '../../../backend/src/lib/divination/index.ts'

const dayPillarsWithChoseiBranch = new Set<string>()
for (let offset = 0; offset < 60; offset++) {
  const date = new Date(Date.UTC(2000, 0, 1 + offset))
  const result = calcShichuResult(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  const day = result.fourPillars.find((pillar: { label: string }) => pillar.label === '日柱')
  if (day.twelveStage === '長生') dayPillarsWithChoseiBranch.add(day.kanshi)
}
console.log('日支が長生になる日柱:', [...dayPillarsWithChoseiBranch].sort().join('・'))

// 日柱が壬申になる最初の日を1990年から探し、その日の命式を実例にする。
for (let offset = 0; offset < 400; offset++) {
  const date = new Date(Date.UTC(1990, 3, 1 + offset))
  const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
  if (calcShichu(y, m, d).day.kanshi !== '壬申') continue
  const result = calcShichuResult(y, m, d)
  console.log('実例:', `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  for (const p of result.fourPillars) console.log(p.label, p.kanshi, p.stemTenGod, p.twelveStage, p.hiddenStems.map((h: { stem: string; tenGod: string }) => `${h.stem}${h.tenGod}`).join('・'))
  console.log('十二大従星:', JSON.stringify(result.sanmeiChart.subordinateStars))
  break
}
