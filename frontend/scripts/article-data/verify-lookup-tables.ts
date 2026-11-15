// 記事に載せた十二運・通変星の早見表が、鑑定と同じ計算関数の結果と一致するかを確かめる。
// 実行: cd frontend && npm run build && cd ../backend && npx tsx ../frontend/scripts/article-data/verify-lookup-tables.ts
import fs from 'fs'
import path from 'path'
import { calcShichuResult, calcTenGod } from '../../../backend/src/lib/divination/index.ts'

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const STAGE_SLUG: Record<string, string> = { 長生: 'chosei', 沐浴: 'mokuyoku', 冠帯: 'kantai', 建禄: 'kenroku', 帝旺: 'teio', 衰: 'sui', 病: 'byo', 死: 'shi', 墓: 'bo', 絶: 'zetsu', 胎: 'tai', 養: 'yo' }
const TEN_GOD_SLUG: Record<string, string> = { 比肩: 'hiken', 劫財: 'gozai', 食神: 'shokujin', 傷官: 'shokan', 偏財: 'henzai', 正財: 'seizai', 偏官: 'henkan', 正官: 'seikan', 偏印: 'henin', 正印: 'seiin' }
const dist = path.join(import.meta.dirname, '..', '..', 'dist', 'guides')

// 鑑定の計算から「日干×地支→十二運」の対応を集める。年支は12年で一巡し、日柱は60日で一巡する。
const stageOf = new Map<string, string>()
for (let offset = 0; offset < 365 * 13; offset += 1) {
  const date = new Date(Date.UTC(2000, 0, 1 + offset))
  const result = calcShichuResult(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  const dayStem = result.shichuDay[0]
  for (const pillar of result.fourPillars) stageOf.set(`${dayStem}${pillar.kanshi[1]}`, pillar.twelveStage)
}
if (stageOf.size !== 120) throw new Error(`十二運の対応を集めきれませんでした（${stageOf.size}/120）`)

const tableRow = (file: string) => {
  const html = fs.readFileSync(file, 'utf8')
  const row = html.match(/<tr><th>[^<]*になる(?:地支|天干)<\/th>((?:<td>[^<]*<\/td>){10})<\/tr>/)
  if (!row) throw new Error(`${file} に早見表がありません`)
  return [...row[1].matchAll(/<td>([^<]*)<\/td>/g)].map(match => match[1])
}

let checked = 0
for (const [stage, slug] of Object.entries(STAGE_SLUG)) {
  const cells = tableRow(path.join(dist, 'twelve-stage', slug, 'index.html'))
  STEMS.forEach((stem, i) => {
    const expected = BRANCHES.find(branch => stageOf.get(`${stem}${branch}`) === stage)
    if (cells[i] !== expected) throw new Error(`十二運 ${stage}・日干${stem}：記事は${cells[i]}、計算は${expected}`)
    checked += 1
  })
}
for (const [god, slug] of Object.entries(TEN_GOD_SLUG)) {
  const cells = tableRow(path.join(dist, 'ten-god', slug, 'index.html'))
  STEMS.forEach((_, d) => {
    const expected = STEMS.filter((__, t) => calcTenGod(d, t) === god).join('・')
    if (cells[d] !== expected) throw new Error(`通変星 ${god}・日干${STEMS[d]}：記事は${cells[d]}、計算は${expected}`)
    checked += 1
  })
}
console.log(`早見表 ${checked} マスを鑑定の計算と照合し、すべて一致しました。`)
