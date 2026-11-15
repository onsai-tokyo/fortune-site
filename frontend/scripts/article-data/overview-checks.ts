// 概要記事に書く計算規則・実例を、鑑定と同じ計算関数で確かめる。
// 実行: cd backend && npx tsx ../frontend/scripts/article-data/overview-checks.ts
import { calcHonmeiStar, calcShichu } from '../../../backend/src/lib/divination/index.ts'

// 九星気学：西暦の各桁の合計を1桁にし、11から引く（10以上なら9を引く）規則が、立春以降の本命星と一致するか。
let mismatch = 0
for (let year = 1930; year <= 2035; year++) {
  let sum = [...String(year)].reduce((a, b) => a + Number(b), 0)
  while (sum > 9) sum = [...String(sum)].reduce((a, b) => a + Number(b), 0)
  let star = 11 - sum
  if (star > 9) star -= 9
  if (calcHonmeiStar(year, 6, 1) !== star) { mismatch++; console.log('不一致', year, star, calcHonmeiStar(year, 6, 1)) }
}
console.log('九星の簡易計算（1930〜2035年）不一致', mismatch, '件')
console.log('1995年1月20日の本命星', calcHonmeiStar(1995, 1, 20), '／1995年2月20日', calcHonmeiStar(1995, 2, 20))

// 節入り：2024年の立春（2月4日17時27分ごろ）の前後で年柱・月柱が変わるか。
for (const [h, m] of [[12, 0], [17, 0], [18, 0]]) {
  const s = calcShichu(2024, 2, 4, h, m)
  console.log(`2024-02-04 ${h}:${String(m).padStart(2, '0')}`, s.year.kanshi, s.month.kanshi, s.day.kanshi)
}
const noTime = calcShichu(2024, 2, 4)
console.log('2024-02-04 時刻なし', noTime.year.kanshi, noTime.month.kanshi, noTime.day.kanshi)
