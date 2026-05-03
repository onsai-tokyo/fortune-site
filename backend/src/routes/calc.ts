import { Router } from 'express'

export const calcRouter = Router()

// 占術データ計算（認証不要）
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

    // ===== 四柱推命計算 =====
    const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"]
    const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]

    function calcJDN(y: number, m: number, d: number): number {
      let yy = y, mm = m
      if (mm <= 2) { yy--; mm += 12 }
      const A = Math.floor(yy / 100)
      const B = 2 - A + Math.floor(A / 4)
      return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + B - 1524
    }

    function calcShichu(y: number, m: number, d: number): { year: string; month: string; day: string } {
      const jdn = calcJDN(y, m, d)
      const ly = y - 1900
      const lm = m - 1
      const yearStem = (ly * 10 + Math.floor(ly / 60) * 60) % 10
      const yearBranch = (ly + 8) % 12
      const monthStem = (ly * 10 + lm * 2 + 2) % 10
      const monthBranch = (m + 1) % 12
      const dayStem = (jdn + 9) % 10
      const dayBranch = (jdn + 1) % 12

      return {
        year: STEMS[yearStem] + BRANCHES[yearBranch],
        month: STEMS[monthStem] + BRANCHES[monthBranch],
        day: STEMS[dayStem] + BRANCHES[dayBranch]
      }
    }

    const shichu = calcShichu(year, month, day)

    // ===== 宿曜計算 =====
    const SUKUYO_NAMES = ["角", "亢", "氐", "房", "心", "尾", "箕", "斗", "牛", "女", "虚", "危",
      "室", "壁", "奎", "婁", "胃", "昴", "畢", "觜", "参", "井", "鬼", "柳", "星", "張", "翼", "軫"]
    const jdn = calcJDN(year, month, day)
    const sukuyoIdx = (jdn + 13) % 28
    const sukuyo = SUKUYO_NAMES[sukuyoIdx]

    // ===== 納音計算 =====
    const NAYIN_MAP: { [key: string]: string } = {
      "甲子": "海中金", "乙丑": "海中金",
      "丙寅": "炉中火", "丁卯": "炉中火",
      "戊辰": "大林木", "己巳": "大林木",
      "庚午": "路旁土", "辛未": "路旁土",
      "壬申": "剑锋金", "癸酉": "剑锋金",
      "甲戌": "山头火", "乙亥": "山头火",
      "丙子": "洞下水", "丁丑": "洞下水",
      "戊寅": "城头土", "己卯": "城头土",
      "庚辰": "白蜡金", "辛巳": "白蜡金",
      "壬午": "杨柳木", "癸未": "杨柳木",
      "甲申": "泉中水", "乙酉": "泉中水",
      "丙戌": "屋上土", "丁亥": "屋上土",
      "戊子": "霹雳火", "己丑": "霹雳火",
      "庚寅": "松柏木", "辛卯": "松柏木",
      "壬辰": "长流水", "癸巳": "长流水",
      "甲午": "砂中金", "乙未": "砂中金",
      "丙申": "山下火", "丁酉": "山下火",
      "戊戌": "平地木", "己亥": "平地木"
    }
    const dayKanshi = shichu.day
    const nayin = NAYIN_MAP[dayKanshi] || "不明"

    // ===== 算命学 宿命星 =====
    const dayStemIdx = parseInt(dayKanshi[0].charCodeAt(0).toString())
    const dayBranchIdx = BRANCHES.indexOf(dayKanshi[1])
    const SANMEI_STARS = ["貫索", "石門", "紅艶", "天馬", "天禄", "天権", "逐門", "龍高", "玉堂", "寿星"]
    const sanmeiStar = SANMEI_STARS[(dayStemIdx + dayBranchIdx * 2) % 10]

    // ===== 数秘術 運命数 =====
    const birthStr = birthDate.replace(/-/g, '')
    let sum = 0
    for (const char of birthStr) sum += parseInt(char)
    while (sum >= 10) {
      let newSum = 0
      while (sum > 0) { newSum += sum % 10; sum = Math.floor(sum / 10) }
      sum = newSum
    }
    const lifePathNumber = sum

    // ===== 九星気学 本命星 =====
    const KYUSEI_NAMES = ["一白水星", "二黒土星", "三碧木星", "四緑木星", "五黄土星", "六白金星", "七赤金星", "八白土星", "九紫火星"]
    const honmei = KYUSEI_NAMES[(year + month + day - 1) % 9]

    res.json({
      shichuYear: shichu.year,
      shichuMonth: shichu.month,
      shichuDay: shichu.day,
      nayin: nayin,
      sanmeiStar: sanmeiStar,
      sukuyo: sukuyo,
      lifePathNumber: lifePathNumber,
      honmeiName: honmei
    })
  } catch (err) {
    console.error('Divination calc error:', err)
    res.status(500).json({ error: '占術計算に失敗しました' })
  }
})
