// 命式・算命学の記事で使う固定の実例（1995年2月20日5時40分・女性）を出力する。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/sample-1995-02-20.ts
import { calcShichu, calcShichuResult, calcSanmei } from '../../../backend/src/lib/divination/index.ts'

const r = calcShichuResult(1995, 2, 20, 5, 40, 'female')
for (const p of r.fourPillars) console.log(p.label, p.kanshi, p.stemTenGod, p.twelveStage, p.hiddenStems.map((h: { stem: string; tenGod: string }) => `${h.stem}（${h.tenGod}）`).join('・'))
console.log('五行', JSON.stringify(r.elementBalance.scores))
const noTime = calcShichuResult(1995, 2, 20, undefined, 0, 'female')
const s = calcShichu(1995, 2, 20)
const sanmei = calcSanmei(s.day.stemIdx, s.day.branchIdx, s.month.branchIdx, s.jieDays)
const chart = noTime.sanmeiChart
console.log('人体星図', ['north', 'east', 'center', 'west', 'south'].map(k => `${chart.bodyChart[k].label}=${chart.bodyChart[k].star}`).join(' '))
console.log('十二大従星', ['early', 'middle', 'late'].map(k => `${chart.subordinateStars[k].label}=${chart.subordinateStars[k].star}`).join(' '))
console.log('天中殺', sanmei.chusatsu)
