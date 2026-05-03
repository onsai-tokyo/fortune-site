import { Router } from 'express'

export const calcRouter = Router()

// ===== 定数 =====
const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"]
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]
const ELEMENTS = ["木","木","火","火","土","土","金","金","水","水"]
const YIN_YANG = ["陽","陰","陽","陰","陽","陰","陽","陰","陽","陰"]
const SUKUYO_ORDER = ["婁","胃","昴","畢","觜","参","井","鬼","柳","星","張","翼","軫","角","亢","氐","房","心","尾","箕","斗","女","虚","危","室","壁","奎"]
const KYUSEI_NAMES = ['', '一白水星', '二黒土星', '三碧木星', '四緑木星', '五黄土星', '六白金星', '七赤金星', '八白土星', '九紫火星']

// ===== 四柱推命計算 =====
function calcJDN(year: number, month: number, day: number): number {
  let y = year, m = month
  if (m <= 2) { y--; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524
}

function makePillar(stemIdx: number, branchIdx: number) {
  const si = ((stemIdx % 10) + 10) % 10
  const bi = ((branchIdx % 12) + 12) % 12
  return {
    stemIdx: si,
    branchIdx: bi,
    stem: STEMS[si],
    branch: BRANCHES[bi],
    element: ELEMENTS[si],
    yinYang: YIN_YANG[si],
    kanshi: STEMS[si] + BRANCHES[bi],
  }
}

function calcShichu(year: number, month: number, day: number, hour?: number) {
  const yearStemIdx = ((year - 1984) % 10 + 10) % 10
  const yearBranchIdx = ((year - 1984) % 12 + 12) % 12
  const yearPillar = makePillar(yearStemIdx, yearBranchIdx)

  const monthBranchIdx = month % 12
  const monthStemIdx = (yearStemIdx % 5 * 2 + monthBranchIdx) % 10
  const monthPillar = makePillar(monthStemIdx, monthBranchIdx)

  const JDN = calcJDN(year, month, day)
  const dayStemIdx = ((JDN - 11) % 10 + 10) % 10
  const dayBranchIdx = ((JDN - 11) % 12 + 12) % 12
  const dayPillar = makePillar(dayStemIdx, dayBranchIdx)

  let hourPillar = null
  if (hour !== undefined) {
    const hourBranchIdx = Math.floor((hour + 1) / 2) % 12
    const hourStemIdx = (dayStemIdx % 5 * 2 + hourBranchIdx) % 10
    hourPillar = makePillar(hourStemIdx, hourBranchIdx)
  }

  return { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar }
}

// ===== 納音計算 =====
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

// ===== 算命学 宿命星 =====
function calcSanmei(dayStemIdx: number, dayBranchIdx: number, monthBranchIdx: number) {
  const BRANCH_HONKI = [9, 5, 0, 1, 4, 2, 5, 5, 6, 7, 4, 8]
  const GEN = [1, 2, 3, 4, 0]
  const CTRL = [2, 3, 4, 0, 1]
  const CHUSATSU: { [key: string]: string } = {
    "子": "申酉天中殺", "丑": "申酉天中殺",
    "寅": "午未天中殺", "卯": "午未天中殺",
    "辰": "辰巳天中殺", "巳": "辰巳天中殺",
    "午": "寅卯天中殺", "未": "寅卯天中殺",
    "申": "子丑天中殺", "酉": "子丑天中殺",
    "戌": "戌亥天中殺", "亥": "戌亥天中殺",
  }

  const tgt = BRANCH_HONKI[monthBranchIdx]
  const de = Math.floor(dayStemIdx / 2)
  const te = Math.floor(tgt / 2)
  const sameYY = (dayStemIdx % 2) === (tgt % 2)

  let shukumeiStar = "不明"
  if (de === te) shukumeiStar = sameYY ? '貫索星' : '石門星'
  else if (GEN[de] === te) shukumeiStar = sameYY ? '鳳閣星' : '調舒星'
  else if (GEN[te] === de) shukumeiStar = sameYY ? '龍高星' : '玉堂星'
  else if (CTRL[de] === te) shukumeiStar = sameYY ? '禄存星' : '司禄星'
  else shukumeiStar = sameYY ? '車騎星' : '牽牛星'

  const dayBranch = BRANCHES[dayBranchIdx]
  const chusatsu = CHUSATSU[dayBranch] ?? "不明"

  return { shukumeiStar, chusatsu }
}

// ===== 宿曜計算（簡易版） =====
function getSukuyo(year: number, month: number, day: number): string {
  const SAKUJITSU_SHU = [24, 26, 1, 3, 5, 7, 10, 13, 15, 17, 20, 22]
  const targetJDN = calcJDN(year, month, day)

  // 簡易版: 旧暦月の推定
  let kyuMonth = month
  if (month >= 11) kyuMonth = month - 10
  else if (month >= 1) kyuMonth = month + 2

  const sakuIdx = SAKUJITSU_SHU[(kyuMonth - 1 + 12) % 12]
  const monthFirstJDN = calcJDN(year, month, 1)
  const dayInMonth = targetJDN - monthFirstJDN + 1

  return SUKUYO_ORDER[(sakuIdx + dayInMonth - 1) % 27]
}

// ===== 九星気学 本命星 =====
function calcHonmeiStar(birthYear: number, birthMonth: number, birthDay: number): number {
  const year = (birthMonth === 1 || (birthMonth === 2 && birthDay < 4)) ? birthYear - 1 : birthYear
  return ((1999 - year) % 9 + 9) % 9 + 1
}

// ===== エンドポイント =====
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

    const shichu = calcShichu(year, month, day)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const sukuyo = getSukuyo(year, month, day)

    const birthStr = birthDate.replace(/-/g, '')
    let lifePathNumber = 0
    for (const char of birthStr) lifePathNumber += parseInt(char)
    while (lifePathNumber >= 10) {
      let newSum = 0
      let n = lifePathNumber
      while (n > 0) { newSum += n % 10; n = Math.floor(n / 10) }
      lifePathNumber = newSum
    }

    const honmei = calcHonmeiStar(year, month, day)

    res.json({
      shichuYear: shichu.year.kanshi,
      shichuMonth: shichu.month.kanshi,
      shichuDay: shichu.day.kanshi,
      nayin,
      sanmeiStar: sanmei.shukumeiStar,
      chusatsu: sanmei.chusatsu,
      sukuyo,
      lifePathNumber,
      honmeiName: KYUSEI_NAMES[honmei]
    })
  } catch (err) {
    console.error('Divination calc error:', err)
    res.status(500).json({ error: '占術計算に失敗しました' })
  }
})
