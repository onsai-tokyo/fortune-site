import { BRANCHES } from './shichu'

const CHUSATSU: Record<string, string> = {
  "子": "申酉天中殺", "丑": "申酉天中殺",
  "寅": "午未天中殺", "卯": "午未天中殺",
  "辰": "辰巳天中殺", "巳": "辰巳天中殺",
  "午": "寅卯天中殺", "未": "寅卯天中殺",
  "申": "子丑天中殺", "酉": "子丑天中殺",
  "戌": "戌亥天中殺", "亥": "戌亥天中殺",
}

// 月支の本気（算命学）: 子丑寅卯辰巳午未申酉戌亥 → 天干インデックス
// ※午=己(算命学では火の極点で土が生じる), 標準四柱推命の午=丁とは異なる
const BRANCH_HONKI = [9, 5, 0, 1, 4, 2, 5, 5, 6, 7, 4, 8]
// 五行生剋サイクル（0=木,1=火,2=土,3=金,4=水）
const GEN  = [1, 2, 3, 4, 0]  // 木→火→土→金→水→木
const CTRL = [2, 3, 4, 0, 1]  // 木→土→火→金→水→木

function calcShukumei(dayStemIdx: number, monthBranchIdx: number): string {
  const tgt    = BRANCH_HONKI[monthBranchIdx]
  const de     = Math.floor(dayStemIdx / 2)
  const te     = Math.floor(tgt / 2)
  const sameYY = (dayStemIdx % 2) === (tgt % 2)
  if (de === te)       return sameYY ? '貫索星' : '石門星'
  if (GEN[de] === te)  return sameYY ? '鳳閣星' : '調舒星'
  if (GEN[te] === de)  return sameYY ? '龍高星' : '玉堂星'
  if (CTRL[de] === te) return sameYY ? '禄存星' : '司禄星'
  return sameYY ? '車騎星' : '牽牛星'
}

export interface SanmeiResult {
  shukumeiStar: string
  chusatsu: string
}

export function calcSanmei(dayStemIdx: number, dayBranchIdx: number, monthBranchIdx: number): SanmeiResult {
  const shukumeiStar = calcShukumei(dayStemIdx, monthBranchIdx)
  const dayBranch    = BRANCHES[dayBranchIdx]
  const chusatsu     = CHUSATSU[dayBranch] ?? "不明"
  return { shukumeiStar, chusatsu }
}
