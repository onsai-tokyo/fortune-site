// 月支の本気（算命学）: 子丑寅卯辰巳午未申酉戌亥 → 天干インデックス
const BRANCH_HONKI = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]
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

const CHUSATSU_BY_JUN = ['戌亥天中殺', '申酉天中殺', '午未天中殺', '辰巳天中殺', '寅卯天中殺', '子丑天中殺']

function calcChusatsu(dayStemIdx: number, dayBranchIdx: number): string {
  const kanshiIndex = Array.from({ length: 60 }, (_, i) => i)
    .find(i => i % 10 === dayStemIdx && i % 12 === dayBranchIdx)
  if (kanshiIndex === undefined) return '不明'
  return CHUSATSU_BY_JUN[Math.floor(kanshiIndex / 10)]
}

export function calcSanmei(dayStemIdx: number, dayBranchIdx: number, monthBranchIdx: number): SanmeiResult {
  const shukumeiStar = calcShukumei(dayStemIdx, monthBranchIdx)
  const chusatsu = calcChusatsu(dayStemIdx, dayBranchIdx)
  return { shukumeiStar, chusatsu }
}
