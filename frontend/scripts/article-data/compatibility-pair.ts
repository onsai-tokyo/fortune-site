// 相性・復縁記事で使う架空のAさん・Bさんの命式を、鑑定と同じ計算関数で確かめる。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/compatibility-pair.ts
import { calcShichu, calcShichuResult, calcTenGod } from '../../../backend/src/lib/divination/index.ts'

const show = (label: string, y: number, m: number, d: number, h?: number, min = 0) => {
  const r = calcShichuResult(y, m, d, h, min)
  console.log(label, `${y}-${m}-${d}${h === undefined ? '' : ` ${h}:${String(min).padStart(2, '0')}`}`, r.fourPillars.map((p: { kanshi: string }) => p.kanshi).join(' '), JSON.stringify(r.elementBalance.scores))
  return calcShichu(y, m, d, h, min)
}
const a = show('Aさん', 1995, 2, 20, 5, 40)
// Bさんの命式（丙子・癸巳・丁未・辛亥）になる日を1996年5〜6月から探す。
for (let day = 5; day <= 36; day++) {
  const date = new Date(Date.UTC(1996, 4, day))
  const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
  const s = calcShichu(y, m, d, 21, 30)
  if (s.year.kanshi === '丙子' && s.month.kanshi === '癸巳' && s.day.kanshi === '丁未') {
    const b = show('Bさん', y, m, d, 21, 30)
    console.log('Aから見たBの日干:', calcTenGod(a.day.stemIdx, b.day.stemIdx), '／ Bから見たAの日干:', calcTenGod(b.day.stemIdx, a.day.stemIdx))
  }
}
