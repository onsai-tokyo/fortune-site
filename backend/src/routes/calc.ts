import { Router } from 'express'
import { calcAstrology } from '../lib/astrology.js'
import { Solar } from 'lunar-javascript'
import { calcZiwei } from '../lib/ziwei.js'

export const calcRouter = Router()

// ===== 定数 =====
const STEMS = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"]
const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]
const ELEMENTS = ["木","木","火","火","土","土","金","金","水","水"]
const YIN_YANG = ["陽","陰","陽","陰","陽","陰","陽","陰","陽","陰"]
const SUKUYO_ORDER = ["婁","胃","昴","畢","觜","参","井","鬼","柳","星","張","翼","軫","角","亢","氐","房","心","尾","箕","斗","女","虚","危","室","壁","奎"]
export const KYUSEI_NAMES = ['', '一白水星', '二黒土星', '三碧木星', '四緑木星', '五黄土星', '六白金星', '七赤金星', '八白土星', '九紫火星']

// ===== 四柱推命計算 =====
function calcJDN(year: number, month: number, day: number): number {
  let y = year, m = month
  if (m <= 2) { y--; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524
}

function pillarFromKanshi(kanshi: string) {
  const stemIdx = STEMS.indexOf(kanshi[0])
  const branchIdx = BRANCHES.indexOf(kanshi[1])
  if (stemIdx < 0 || branchIdx < 0) throw new Error(`不正な干支です: ${kanshi}`)
  return makePillar(stemIdx, branchIdx)
}

function toChineseStandardTime(year: number, month: number, day: number, hour: number, minute: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day, hour - 1, minute))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
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

export function calcShichu(year: number, month: number, day: number, hour?: number, minute = 0) {
  const localHour = hour ?? 12
  const localLunar = Solar.fromYmdHms(year, month, day, localHour, minute, 0).getLunar()
  const localEightChar = localLunar.getEightChar()
  const cst = toChineseStandardTime(year, month, day, localHour, minute)
  const solarTermLunar = Solar.fromYmdHms(cst.year, cst.month, cst.day, cst.hour, cst.minute, 0).getLunar()

  const yearPillar = pillarFromKanshi(solarTermLunar.getYearInGanZhiExact())
  const monthPillar = pillarFromKanshi(solarTermLunar.getMonthInGanZhiExact())
  const dayPillar = pillarFromKanshi(localEightChar.getDay())
  const hourPillar = hour === undefined ? null : pillarFromKanshi(localEightChar.getTime())

  return { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar }
}

// ===== 四柱推命・算命学 詳細計算 =====
// 蔵干は本気・中気・余気の順。五行配点では順に 0.6 / 0.3 / 0.1 とする。
const HIDDEN_STEMS = [
  [9], [5, 9, 7], [0, 2, 4], [1], [4, 1, 9], [2, 4, 6],
  [3, 5], [5, 3, 1], [6, 8, 4], [7], [4, 7, 3], [8, 0],
]
const ELEMENT_ORDER = ['木', '火', '土', '金', '水']
const GENERATES = [1, 2, 3, 4, 0]
const CONTROLS = [2, 3, 4, 0, 1]

export function calcTenGod(dayStemIdx: number, targetStemIdx: number): string {
  const dayElement = Math.floor(dayStemIdx / 2)
  const targetElement = Math.floor(targetStemIdx / 2)
  const samePolarity = dayStemIdx % 2 === targetStemIdx % 2
  if (dayElement === targetElement) return samePolarity ? '比肩' : '劫財'
  if (GENERATES[dayElement] === targetElement) return samePolarity ? '食神' : '傷官'
  if (CONTROLS[dayElement] === targetElement) return samePolarity ? '偏財' : '正財'
  if (CONTROLS[targetElement] === dayElement) return samePolarity ? '偏官' : '正官'
  return samePolarity ? '偏印' : '正印'
}

function calcPrimaryStar(dayStemIdx: number, targetStemIdx: number): string {
  const dayElement = Math.floor(dayStemIdx / 2)
  const targetElement = Math.floor(targetStemIdx / 2)
  const samePolarity = dayStemIdx % 2 === targetStemIdx % 2
  if (dayElement === targetElement) return samePolarity ? '貫索星' : '石門星'
  if (GENERATES[dayElement] === targetElement) return samePolarity ? '鳳閣星' : '調舒星'
  if (CONTROLS[dayElement] === targetElement) return samePolarity ? '禄存星' : '司禄星'
  if (CONTROLS[targetElement] === dayElement) return samePolarity ? '車騎星' : '牽牛星'
  return samePolarity ? '龍高星' : '玉堂星'
}

const GROWTH_STAGES = ['長生', '沐浴', '冠帯', '建禄', '帝旺', '衰', '病', '死', '墓', '絶', '胎', '養']
const SUBORDINATE_STARS: Record<string, string> = {
  長生: '天貴星', 沐浴: '天恍星', 冠帯: '天南星', 建禄: '天禄星', 帝旺: '天将星', 衰: '天堂星',
  病: '天胡星', 死: '天極星', 墓: '天庫星', 絶: '天馳星', 胎: '天報星', 養: '天印星',
}
const GROWTH_START_BRANCH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]

function calcSubordinateStar(dayStemIdx: number, branchIdx: number) {
  const direction = dayStemIdx % 2 === 0 ? 1 : -1
  const stageIdx = ((direction * (branchIdx - GROWTH_START_BRANCH[dayStemIdx])) % 12 + 12) % 12
  const stage = GROWTH_STAGES[stageIdx]
  return { star: SUBORDINATE_STARS[stage], stage }
}

export function calcExpandedDivination(shichu: ReturnType<typeof calcShichu>) {
  const dayStemIdx = shichu.day.stemIdx
  const entries = [
    ['year', '年柱', shichu.year], ['month', '月柱', shichu.month],
    ['day', '日柱', shichu.day], ...(shichu.hour ? [['hour', '時柱', shichu.hour] as const] : []),
  ] as const
  const hiddenWeights = [0.6, 0.3, 0.1]
  const elementScores = Object.fromEntries(ELEMENT_ORDER.map(element => [element, 0])) as Record<string, number>

  const pillars = entries.map(([key, label, pillar]) => {
    elementScores[pillar.element] += 1
    const hiddenStems = HIDDEN_STEMS[pillar.branchIdx].map((stemIdx, index) => {
      elementScores[ELEMENTS[stemIdx]] += hiddenWeights[index] ?? 0.1
      return { stem: STEMS[stemIdx], element: ELEMENTS[stemIdx], tenGod: calcTenGod(dayStemIdx, stemIdx) }
    })
    return {
      key, label, kanshi: pillar.kanshi, stem: pillar.stem, branch: pillar.branch,
      stemTenGod: key === 'day' ? '日主' : calcTenGod(dayStemIdx, pillar.stemIdx), hiddenStems,
    }
  })
  for (const element of ELEMENT_ORDER) elementScores[element] = Math.round(elementScores[element] * 10) / 10

  // 月支の本気を季節の強さとして 1.5 加点し、扶助側（日主と印）とそれ以外を比較する簡易判定。
  const seasonalScores = { ...elementScores }
  seasonalScores[ELEMENTS[HIDDEN_STEMS[shichu.month.branchIdx][0]]] += 1.5
  const dayElementIdx = Math.floor(dayStemIdx / 2)
  const resourceElementIdx = (dayElementIdx + 4) % 5
  const support = seasonalScores[ELEMENT_ORDER[dayElementIdx]] + seasonalScores[ELEMENT_ORDER[resourceElementIdx]]
  const total = Object.values(seasonalScores).reduce((sum, score) => sum + score, 0)
  const ratio = support / total
  const strengthLabel = ratio >= 0.56 ? '身旺寄り' : ratio <= 0.44 ? '身弱寄り' : '中和寄り'
  const favorableElements = strengthLabel === '身弱寄り'
    ? [ELEMENT_ORDER[resourceElementIdx], ELEMENT_ORDER[dayElementIdx]]
    : strengthLabel === '身旺寄り'
      ? [ELEMENT_ORDER[GENERATES[dayElementIdx]], ELEMENT_ORDER[CONTROLS[dayElementIdx]]]
      : [...ELEMENT_ORDER].sort((a, b) => elementScores[a] - elementScores[b]).slice(0, 2)

  const bodyChart = {
    north: { label: '北（頭）', star: calcPrimaryStar(dayStemIdx, shichu.year.stemIdx) },
    west: { label: '西（右手）', star: calcPrimaryStar(dayStemIdx, HIDDEN_STEMS[shichu.day.branchIdx][0]) },
    center: { label: '中央（胸）', star: calcPrimaryStar(dayStemIdx, HIDDEN_STEMS[shichu.month.branchIdx][0]) },
    east: { label: '東（左手）', star: calcPrimaryStar(dayStemIdx, HIDDEN_STEMS[shichu.year.branchIdx][0]) },
    south: { label: '南（腹）', star: calcPrimaryStar(dayStemIdx, shichu.month.stemIdx) },
  }
  const subordinateStars = {
    early: { label: '初年期', ...calcSubordinateStar(dayStemIdx, shichu.year.branchIdx) },
    middle: { label: '中年期', ...calcSubordinateStar(dayStemIdx, shichu.month.branchIdx) },
    late: { label: '晩年期', ...calcSubordinateStar(dayStemIdx, shichu.day.branchIdx) },
  }

  return {
    fourPillars: pillars,
    elementBalance: { scores: elementScores, method: '天干1.0、蔵干は本気0.6・中気0.3・余気0.1で集計' },
    strength: {
      label: strengthLabel, supportRatio: Math.round(ratio * 100), favorableElements,
      note: '月令を加味した簡易旺衰です。格局・調候を含む流派固有の喜神／忌神の確定ではありません。',
    },
    sanmeiChart: { bodyChart, subordinateStars },
  }
}

const BRANCH_HARM: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' }
const PUNISH_PAIRS = new Set(['子卯', '卯子', '寅巳', '巳寅', '巳申', '申巳', '申寅', '寅申', '丑戌', '戌丑', '戌未', '未戌', '未丑', '丑未'])

export function calcSanmeiRelations(shichu: ReturnType<typeof calcShichu>, chusatsu: string) {
  const pillars = [
    { label: '年支', branch: shichu.year.branch, branchIdx: shichu.year.branchIdx },
    { label: '月支', branch: shichu.month.branch, branchIdx: shichu.month.branchIdx },
    { label: '日支', branch: shichu.day.branch, branchIdx: shichu.day.branchIdx },
    ...(shichu.hour ? [{ label: '時支', branch: shichu.hour.branch, branchIdx: shichu.hour.branchIdx }] : []),
  ]
  const relations: Array<{ pillars: string; branches: string; relation: string; meaning: string }> = []
  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const a = pillars[i], b = pillars[j]
      if (BRANCH_COMBINE[a.branch] === b.branch) relations.push({ pillars: `${a.label}・${b.label}`, branches: `${a.branch}${b.branch}`, relation: '六合', meaning: '異なる領域が結びつき、協力や縁としてまとまりやすい' })
      if ((a.branchIdx - b.branchIdx + 12) % 12 === 6) relations.push({ pillars: `${a.label}・${b.label}`, branches: `${a.branch}${b.branch}`, relation: '冲', meaning: '二つの領域が刺激し合い、移動・変更・再編を起こしやすい' })
      if (BRANCH_HARM[a.branch] === b.branch) relations.push({ pillars: `${a.label}・${b.label}`, branches: `${a.branch}${b.branch}`, relation: '害', meaning: '表面化しにくい違和感を、対話と確認で調整する課題' })
      if (PUNISH_PAIRS.has(`${a.branch}${b.branch}`) || (a.branch === b.branch && ['辰', '午', '酉', '亥'].includes(a.branch))) relations.push({ pillars: `${a.label}・${b.label}`, branches: `${a.branch}${b.branch}`, relation: '刑', meaning: 'こだわりや緊張を、訓練・専門性・境界線へ変えるテーマ' })
    }
  }
  const voidBranches = chusatsu.slice(0, 2).split('')
  const affectedPillars = pillars.filter(pillar => voidBranches.includes(pillar.branch)).map(pillar => `${pillar.label}${pillar.branch}`)
  return { relations, voidBranches, affectedPillars }
}

export interface TimingPeriod {
  startYear: number
  endYear: number
  startAge: number
  endAge: number
  kanshi: string
  tenGod: string
  themes: string[]
}

export interface AnnualTiming {
  year: number
  ageRange: string
  kanshi: string
  tenGod: string
  score: number
  relationshipSignals: string[]
  themes: string[]
}

const BRANCH_COMBINE: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
}
const PEACH_BLOSSOM: Record<string, string> = {
  申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 亥: '子', 卯: '子', 未: '子', 巳: '午', 酉: '午', 丑: '午',
}

function timingThemes(tenGod: string, branchRelation?: string): string[] {
  const themes = tenGod.includes('財')
    ? ['成果・収入・現実的な選択']
    : tenGod.includes('官')
      ? ['責任・肩書・関係の正式化']
      : ['食神', '傷官'].includes(tenGod)
        ? ['発信・創作・新しい挑戦']
        : tenGod.includes('印')
          ? ['学び・資格・支援を受けること']
          : ['自立・仲間・活動範囲の変化']
  if (branchRelation === '六合') themes.push('縁がまとまりやすい')
  if (branchRelation === '冲') themes.push('環境や関係の組み替え')
  return themes
}

// 大運・流年は lunar-javascript の節入り基準（sect=2）で算出する。
// 配偶者星は伝統的な男女別の見方で候補年を抽出するが、出来事の確定には用いない。
export function calcTimingCycles(year: number, month: number, day: number, hour: number | undefined, minute: number, gender: 'male' | 'female') {
  const localHour = hour ?? 12
  const cst = toChineseStandardTime(year, month, day, localHour, minute)
  const lunar = Solar.fromYmdHms(cst.year, cst.month, cst.day, cst.hour, cst.minute, 0).getLunar()
  // The package runtime exposes getYun, but the bundled TypeScript declaration omits it.
  const yun = (lunar.getEightChar() as any).getYun(gender === 'male' ? 1 : 0, 2)
  const shichu = calcShichu(year, month, day, hour, minute)
  const dayStemIdx = shichu.day.stemIdx
  const dayBranch = shichu.day.branch
  const spouseGods = gender === 'male' ? ['偏財', '正財'] : ['偏官', '正官']
  const favorable = calcExpandedDivination(shichu).strength.favorableElements

  const decades: TimingPeriod[] = yun.getDaYun(8).slice(1).map((period: any) => {
    const pillar = pillarFromKanshi(period.getGanZhi())
    const tenGod = calcTenGod(dayStemIdx, pillar.stemIdx)
    const relation = BRANCH_COMBINE[dayBranch] === pillar.branch ? '六合' : ((pillar.branchIdx - shichu.day.branchIdx + 12) % 12 === 6 ? '冲' : undefined)
    return {
      startYear: period.getStartYear(), endYear: period.getEndYear(),
      startAge: period.getStartYear() - year, endAge: period.getEndYear() - year,
      kanshi: period.getGanZhi(), tenGod, themes: timingThemes(tenGod, relation),
    }
  })

  const annual: AnnualTiming[] = yun.getDaYun(8).flatMap((period: any) => period.getLiuNian())
    .filter((item: any) => item.getYear() >= year + 18 && item.getYear() <= year + 60)
    .map((item: any) => {
      const pillar = pillarFromKanshi(item.getGanZhi())
      const tenGod = calcTenGod(dayStemIdx, pillar.stemIdx)
      const hiddenTenGod = calcTenGod(dayStemIdx, HIDDEN_STEMS[pillar.branchIdx][0])
      const relationshipSignals: string[] = []
      let score = 0
      if (spouseGods.includes(tenGod)) { score += 3; relationshipSignals.push(`天干に配偶者星の${tenGod}`) }
      if (spouseGods.includes(hiddenTenGod)) { score += 2; relationshipSignals.push(`地支に配偶者星の${hiddenTenGod}`) }
      let relation: string | undefined
      if (BRANCH_COMBINE[dayBranch] === pillar.branch) { score += 2; relation = '六合'; relationshipSignals.push('日支と六合（縁がまとまりやすい）') }
      if ((pillar.branchIdx - shichu.day.branchIdx + 12) % 12 === 6) { score += 1; relation = '冲'; relationshipSignals.push('日支と冲（関係が動きやすい）') }
      if (PEACH_BLOSSOM[dayBranch] === pillar.branch) { score += 1; relationshipSignals.push('桃花（交流や注目が増えやすい）') }
      if (favorable.includes(pillar.element)) score += 1
      return {
        year: item.getYear(), ageRange: `${item.getYear() - year - 1}〜${item.getYear() - year}歳`,
        kanshi: item.getGanZhi(), tenGod, score, relationshipSignals, themes: timingThemes(tenGod, relation),
      }
    })

  return {
    direction: yun.isForward() ? '順行' : '逆行',
    startDate: yun.getStartSolar().toYmd(),
    decades,
    annual,
    marriageCandidates: annual.filter(item => item.score >= 4).sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 8).sort((a, b) => a.year - b.year),
  }
}

// ===== 納音計算 =====
export function calcNayin(stemIdx: number, branchIdx: number): string {
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
export function calcSanmei(dayStemIdx: number, dayBranchIdx: number, monthBranchIdx: number) {
  const BRANCH_HONKI = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]
  const GEN = [1, 2, 3, 4, 0]
  const CTRL = [2, 3, 4, 0, 1]

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

  const kanshiIndex = Array.from({ length: 60 }, (_, i) => i)
    .find(i => i % 10 === dayStemIdx && i % 12 === dayBranchIdx)
  const chusatsuByJun = ['戌亥天中殺', '申酉天中殺', '午未天中殺', '辰巳天中殺', '寅卯天中殺', '子丑天中殺']
  const chusatsu = kanshiIndex === undefined ? '不明' : chusatsuByJun[Math.floor(kanshiIndex / 10)]

  return { shukumeiStar, chusatsu }
}

// ===== 数秘術（ライフパス） =====
// ピタゴラス式。11・22・33はマスターナンバーとして還元しない。
export function calcLifePathNumber(birthDate: string): number {
  let sum = birthDate.replace(/\D/g, '').split('').reduce((total, digit) => total + Number(digit), 0)
  while (sum > 9 && ![11, 22, 33].includes(sum)) {
    sum = String(sum).split('').reduce((total, digit) => total + Number(digit), 0)
  }
  return sum
}

function reduceNumerology(value: number, keepMaster = true): number {
  let result = value
  while (result > 9 && !(keepMaster && [11, 22, 33].includes(result))) {
    result = String(result).split('').reduce((sum, digit) => sum + Number(digit), 0)
  }
  return result
}

export function calcNumerologyProfile(year: number, month: number, day: number, targetYear = new Date().getFullYear()) {
  const yearDigitSum = String(targetYear).split('').reduce((sum, digit) => sum + Number(digit), 0)
  return {
    birthDayNumber: reduceNumerology(day),
    attitudeNumber: reduceNumerology(month + day),
    personalYearNumber: reduceNumerology(month + day + yearDigitSum, false),
    personalYear: targetYear,
  }
}

// ===== 宿曜計算（フロントと同一の正確な計算） =====
function newMoonJDE(k: number): number {
  const T = k / 1236.85
  const DEG = Math.PI / 180
  let JDE = 2451550.09766 + 29.530588861 * k
    + 0.00015437 * T * T - 0.000000150 * T * T * T + 0.00000000073 * T * T * T * T
  const M  = (2.5534  + 29.10535670  * k - 0.0000014 * T * T) * DEG
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T) * DEG
  const F  = (160.7108 + 390.67050284 * k - 0.0016118 * T * T) * DEG
  const Om = (124.7746 -   1.56375588 * k + 0.0020672 * T * T) * DEG
  JDE += -0.40720 * Math.sin(Mp) + 0.17241 * Math.sin(M)
       +  0.01608 * Math.sin(2 * Mp) + 0.01039 * Math.sin(2 * F)
       +  0.00739 * Math.sin(Mp - M) - 0.00514 * Math.sin(Mp + M)
       +  0.00208 * Math.sin(2 * M)  - 0.00111 * Math.sin(Mp - 2 * F)
       -  0.00057 * Math.sin(Mp + 2 * F) + 0.00056 * Math.sin(2 * Mp + M)
       -  0.00042 * Math.sin(3 * Mp) + 0.00042 * Math.sin(M + 2 * F)
       +  0.00038 * Math.sin(M - 2 * F) - 0.00024 * Math.sin(2 * Mp - M)
       -  0.00017 * Math.sin(Om) - 0.00007 * Math.sin(Mp + 2 * M)
  return JDE
}

function prevNewMoonJDN(targetJDN: number): { sakuJDN: number; k: number } {
  let k = Math.round((targetJDN - 0.5 - 2451550.09766) / 29.530588861)
  for (let dk = -2; dk <= 1; dk++) {
    const nm0 = Math.floor(newMoonJDE(k + dk)     + 21 / 24)
    const nm1 = Math.floor(newMoonJDE(k + dk + 1) + 21 / 24)
    if (nm0 <= targetJDN && targetJDN < nm1) {
      return { sakuJDN: nm0, k: k + dk }
    }
  }
  return { sakuJDN: Math.floor(newMoonJDE(k) + 21 / 24), k }
}

function solarLongitude(JD: number): number {
  const T = (JD - 2451545.0) / 36525.0
  const DEG = Math.PI / 180
  const M = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360 + 360) % 360
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * DEG)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M * DEG)
          + 0.000289 * Math.sin(3 * M * DEG)
  return ((M + C + 282.9372) % 360 + 360) % 360
}

function findChuki(targetLon: number, nearJD: number): number {
  let lo = nearJD - 20, hi = nearJD + 20
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    let lon = solarLongitude(mid)
    if (targetLon < 30 && lon > 300)  lon -= 360
    if (targetLon > 300 && lon < 30) lon += 360
    if (lon < targetLon) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

function getKyureikiMonth(targetJDN: number): number {
  const { sakuJDN } = prevNewMoonJDN(targetJDN)
  let solsticeYear = Math.floor((targetJDN - 1721425.5) / 365.25)
  let toji = findChuki(270, calcJDN(solsticeYear, 12, 22))
  if (targetJDN < Math.floor(toji + 21 / 24)) {
    solsticeYear--
    toji = findChuki(270, calcJDN(solsticeYear, 12, 22))
  }
  const m11saku = prevNewMoonJDN(Math.floor(toji + 21 / 24)).sakuJDN
  const chukiLons = [270, 300, 330, 0, 30, 60, 90, 120, 150, 180, 210, 240]
  let kyuMon = 11
  let chukiIdx = 0
  let k11 = Math.round((m11saku - 0.5 - 2451550.09766) / 29.530588861)

  for (let i = 0; i < 18; i++) {
    const currSaku = Math.floor(newMoonJDE(k11 + i)     + 21 / 24)
    const nextSaku = Math.floor(newMoonJDE(k11 + i + 1) + 21 / 24)
    const isTarget = currSaku <= sakuJDN && sakuJDN < nextSaku
    const targetLon = chukiLons[chukiIdx % 12]
    const chukiJST = findChuki(targetLon, currSaku + 15) + 21 / 24
    const hasChuki = chukiJST >= currSaku && chukiJST < nextSaku

    if (hasChuki) {
      if (isTarget) return kyuMon > 12 ? kyuMon - 12 : kyuMon
      chukiIdx++
      kyuMon = kyuMon >= 12 ? 1 : kyuMon + 1
    } else {
      if (isTarget) {
        const prevMon = kyuMon > 12 ? kyuMon - 13 : kyuMon - 1
        return prevMon <= 0 ? 12 : prevMon
      }
    }
  }
  const months = Math.round((sakuJDN - m11saku) / 29.5)
  return ((10 + months) % 12) + 1
}

export function getSukuyo(year: number, month: number, day: number): string {
  const SAKUJITSU_SHU = [24, 26, 1, 3, 5, 7, 10, 13, 15, 17, 20, 22]
  const targetJDN = calcJDN(year, month, day)
  const { sakuJDN } = prevNewMoonJDN(targetJDN)
  const kyuDay   = targetJDN - sakuJDN + 1
  const kyuMonth = getKyureikiMonth(targetJDN)
  const sakuIdx  = SAKUJITSU_SHU[kyuMonth - 1]
  return SUKUYO_ORDER[(sakuIdx + kyuDay - 1) % 27]
}

// ===== 九星気学 本命星 =====
export function calcHonmeiStar(birthYear: number, birthMonth: number, birthDay: number): number {
  const year = (birthMonth === 1 || (birthMonth === 2 && birthDay < 4)) ? birthYear - 1 : birthYear
  return ((1999 - year) % 9 + 9) % 9 + 1
}

function nineStarName(star: any): string {
  const color = ({ 绿: '緑', 黑: '黒' } as Record<string, string>)[star.getColor()] ?? star.getColor()
  return `${star.getNumber()}${color}${star.getWuXing()}星`
}

export function calcKyuseiProfile(year: number, month: number, day: number, hour?: number, minute = 0) {
  const lunar: any = Solar.fromYmdHms(year, month, day, hour ?? 12, minute, 0).getLunar()
  return {
    yearStar: nineStarName(lunar.getYearNineStar(2)),
    monthStar: nineStarName(lunar.getMonthNineStar(2)),
    dayStar: nineStarName(lunar.getDayNineStar()),
    timeStar: hour === undefined ? null : nineStarName(lunar.getTimeNineStar()),
  }
}

// ===== エンドポイント =====
calcRouter.post('/divination', (req, res) => {
  try {
    const { birthDate, birthTime, birthplace, gender } = req.body as { birthDate?: string; birthTime?: string; birthplace?: string; gender?: string }

    if (!birthDate || !gender) {
      res.status(400).json({ error: '生年月日と性別は必須です' })
      return
    }

    const [year, month, day] = birthDate.split('-').map(Number)
    if (!year || !month || !day) {
      res.status(400).json({ error: '生年月日の形式が正しくありません' })
      return
    }

    const [birthHour, birthMinute] = birthTime
      ? birthTime.split(':').map(Number)
      : [undefined, 0]
    const shichu = calcShichu(year, month, day, birthHour, birthMinute)
    const nayin = calcNayin(shichu.day.stemIdx, shichu.day.branchIdx)
    const sanmei = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx)
    const expanded = calcExpandedDivination(shichu)
    const sukuyo = getSukuyo(year, month, day)

    const lifePathNumber = calcLifePathNumber(birthDate)
    const numerologyProfile = calcNumerologyProfile(year, month, day)

    const honmei = calcHonmeiStar(year, month, day)
    const kyuseiProfile = calcKyuseiProfile(year, month, day, birthHour, birthMinute)
    const sanmeiRelations = calcSanmeiRelations(shichu, sanmei.chusatsu)
    const ziwei = calcZiwei(year, month, day, birthHour, gender === 'male' ? 'male' : 'female', birthplace)
    const astrology = calcAstrology(year, month, day, birthHour, birthMinute, birthplace)

    res.json({
      shichuYear: shichu.year.kanshi,
      shichuMonth: shichu.month.kanshi,
      shichuDay: shichu.day.kanshi,
      shichuHour: shichu.hour?.kanshi ?? null,
      nayin,
      sanmeiStar: sanmei.shukumeiStar,
      chusatsu: sanmei.chusatsu,
      sukuyo,
      lifePathNumber,
      numerologyProfile,
      honmeiName: KYUSEI_NAMES[honmei],
      kyuseiProfile,
      birthplace: birthplace || null,
      sanmeiRelations,
      ziwei,
      astrology,
      ...expanded,
    })
  } catch (err) {
    console.error('Divination calc error:', err)
    res.status(500).json({ error: '占術計算に失敗しました' })
  }
})
