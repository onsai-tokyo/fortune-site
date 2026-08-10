import { Solar } from 'lunar-javascript'

export const STEMS    = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"]
export const BRANCHES = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]
export const ELEMENTS = ["木","木","火","火","土","土","金","金","水","水"]
export const YIN_YANG = ["陽","陰","陽","陰","陽","陰","陽","陰","陽","陰"]

export interface Pillar {
  stemIdx: number
  branchIdx: number
  stem: string
  branch: string
  element: string
  yinYang: string
  kanshi: string
}

export interface ShichuResult {
  year: Pillar
  month: Pillar
  day: Pillar
  hour: Pillar | null
}

function makePillar(stemIdx: number, branchIdx: number): Pillar {
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

function pillarFromKanshi(kanshi: string): Pillar {
  const stemIdx = STEMS.indexOf(kanshi[0])
  const branchIdx = BRANCHES.indexOf(kanshi[1])
  if (stemIdx < 0 || branchIdx < 0) throw new Error(`不正な干支です: ${kanshi}`)
  return makePillar(stemIdx, branchIdx)
}

// lunar-javascript の節気時刻は中国標準時。日本標準時の入力を1時間戻して
// 同一瞬間の中国標準時に変換し、年柱・月柱の節入り判定だけに使用する。
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

export function calcShichu(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute = 0,
): ShichuResult {
  // 時刻不明時は正午として節入り日の誤判定を最小化する。
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

export interface DaiyunPeriod {
  kanshi: string
  startAge: number
  endAge: number
}

// 流年干支（指定年の年柱）
export function calcRyunen(year: number): string {
  const stemIdx   = ((year - 1984) % 10 + 10) % 10
  const branchIdx = ((year - 1984) % 12 + 12) % 12
  return STEMS[stemIdx] + BRANCHES[branchIdx]
}

// 大運（10年周期）を計算
// 簡易版：起運年齢を birth→次節までの日数÷3 で近似（固定値5歳）
export function calcDaiyun(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  gender: 'male' | 'female',
  count = 8
): DaiyunPeriod[] {
  const shichu = calcShichu(birthYear, birthMonth, birthDay)
  const yearYinYang = shichu.year.yinYang

  // 順行：男×陽年 or 女×陰年、逆行：男×陰年 or 女×陽年
  const isForward =
    (gender === 'male'   && yearYinYang === '陽') ||
    (gender === 'female' && yearYinYang === '陰')

  // 起運年齢：簡易的に5歳固定（本来は節入りまでの日数÷3）
  const startAge = 5

  const msi = shichu.month.stemIdx
  const mbi = shichu.month.branchIdx

  return Array.from({ length: count }, (_, i) => {
    const si = isForward
      ? (msi + i + 1) % 10
      : ((msi - i - 1 + 100) % 10)
    const bi = isForward
      ? (mbi + i + 1) % 12
      : ((mbi - i - 1 + 120) % 12)
    return {
      kanshi: STEMS[si] + BRANCHES[bi],
      startAge: startAge + i * 10,
      endAge:   startAge + (i + 1) * 10 - 1,
    }
  })
}
