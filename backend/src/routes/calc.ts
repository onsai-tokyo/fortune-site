import { Router } from 'express'

export const calcRouter = Router()

const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"]
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]
const ELEMENTS = ["木","木","火","火","土","土","金","金","水","水"]
const SUKUYO_ORDER = ["婁","胃","昴","畢","觜","参","井","鬼","柳","星","張","翼","軫","角","亢","氐","房","心","尾","箕","斗","女","虚","危","室","壁","奎"]

function calcJDN(year: number, month: number, day: number): number {
  let y = year, m = month
  if (m <= 2) { y--; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524
}

function calcNayin(stemIdx: number, branchIdx: number): string {
  const NAYIN = [
    "海中金","海中金","炉中火","炉中火","大林木","大林木","路旁土","路旁土","剣鋒金","剣鋒金","山頭火","山頭火",
    "涧下水","涧下水","城頭土","城頭土","白蜡金","白蜡金","楊柳木","楊柳木","泉中水","泉中水","屋上土","屋上土",
    "霹靂火","霹靂火","松柏木","松柏木","長流水","長流水","砂中金","砂中金","山下火","山下火","平地木","平地木",
    "壁上土","壁上土","金箔金","金箔金","覆燈火","覆燈火","天河水","天河水","大駅土","大駅土","釵釧金","釵釧金",
    "桑柘木","桑柘木","大溪水","大溪水","沙中土","沙中土","天上火","天上火","石榴木","石榴木","大海水","大海水"
  ]
  const diff = (((branchIdx - stemIdx) / 2) % 6 + 6) % 6
  const k = (5 * diff) % 6
  const pos = stemIdx + 10 * k
  return NAYIN[pos]
}

function getSukuyo(year: number, month: number, day: number): string {
  const SAKUJITSU_SHU = [24, 26, 1, 3, 5, 7, 10, 13, 15, 17, 20, 22]
  const targetJDN = calcJDN(year, month, day)

  // 簡易版: 旧暦月を概算（月単位）
  // 本来は新月カレンダーと中気の計算が必要だが、ここでは簡略版
  let kyuMonth = month
  if (month >= 11) kyuMonth = month - 10
  else if (month >= 1) kyuMonth = month + 2

  const sakuIdx = SAKUJITSU_SHU[kyuMonth - 1]
  const monthFirstJDN = calcJDN(year, month, 1)
  const dayInMonth = targetJDN - monthFirstJDN + 1

  return SUKUYO_ORDER[(sakuIdx + dayInMonth - 1) % 27]
}

calcRouter.post('/divination', (req, res) => {
  try {
    const { birthDate, gender } = req.body as { birthDate?: string; gender?: string }

    if (!birthDate || !gender) {
      res.status(400).json({ error: '生年月日と性別は必須です' })
      return
    }

    const [year, month, day] = birthDate.split('-').map(Number)
    if (!year || !month || !day) {
      res.status(400).json({ error: '生年月日の形式が正しくありません' })
      return
    }

    // ===== 四柱推命 =====
    const yearStemIdx = ((year - 1984) % 10 + 10) % 10
    const yearBranchIdx = ((year - 1984) % 12 + 12) % 12
    const monthBranchIdx = month % 12
    const monthStemIdx = (yearStemIdx % 5 * 2 + monthBranchIdx) % 10

    const JDN = calcJDN(year, month, day)
    const dayStemIdx = ((JDN - 11) % 10 + 10) % 10
    const dayBranchIdx = ((JDN - 11) % 12 + 12) % 12

    const shichuYear = STEMS[yearStemIdx] + BRANCHES[yearBranchIdx]
    const shichuMonth = STEMS[monthStemIdx] + BRANCHES[monthBranchIdx]
    const shichuDay = STEMS[dayStemIdx] + BRANCHES[dayBranchIdx]

    // ===== 納音 =====
    const nayin = calcNayin(dayStemIdx, dayBranchIdx)

    // ===== 算命学 宿命星 =====
    const SANMEI_STARS = ["貫索", "石門", "紅艶", "天馬", "天禄", "天権", "逐門", "龍高", "玉堂", "寿星"]
    const sanmeiStar = SANMEI_STARS[(dayStemIdx + dayBranchIdx * 2) % 10]

    // ===== 宿曜 =====
    const sukuyo = getSukuyo(year, month, day)

    // ===== 数秘術 運命数 =====
    const birthStr = birthDate.replace(/-/g, '')
    let sum = 0
    for (const char of birthStr) sum += parseInt(char)
    while (sum >= 10) {
      let newSum = 0
      let n = sum
      while (n > 0) { newSum += n % 10; n = Math.floor(n / 10) }
      sum = newSum
    }
    const lifePathNumber = sum

    // ===== 九星気学 本命星 =====
    const KYUSEI_NAMES = ["一白水星", "二黒土星", "三碧木星", "四緑木星", "五黄土星", "六白金星", "七赤金星", "八白土星", "九紫火星"]
    const honmei = KYUSEI_NAMES[(year + month + day - 1) % 9]

    res.json({
      shichuYear,
      shichuMonth,
      shichuDay,
      nayin,
      sanmeiStar,
      sukuyo,
      lifePathNumber,
      honmeiName: honmei
    })
  } catch (err) {
    console.error('Divination calc error:', err)
    res.status(500).json({ error: '占術計算に失敗しました' })
  }
})
