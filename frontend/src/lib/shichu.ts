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

function calcJDN(year: number, month: number, day: number): number {
  let y = year, m = month
  if (m <= 2) { y--; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524
}

export function calcShichu(
  year: number,
  month: number,
  day: number,
  hour?: number
): ShichuResult {
  // 年柱
  const yearStemIdx   = ((year - 1984) % 10 + 10) % 10
  const yearBranchIdx = ((year - 1984) % 12 + 12) % 12
  const yearPillar    = makePillar(yearStemIdx, yearBranchIdx)

  // 月柱（節入り考慮なし、単純計算）
  const monthBranchIdx = month % 12
  const monthStemIdx   = (yearStemIdx % 5 * 2 + monthBranchIdx) % 10
  const monthPillar    = makePillar(monthStemIdx, monthBranchIdx)

  // 日柱（JDN法）
  const JDN = calcJDN(year, month, day)
  const dayStemIdx   = ((JDN - 11) % 10 + 10) % 10
  const dayBranchIdx = ((JDN - 11) % 12 + 12) % 12
  const dayPillar    = makePillar(dayStemIdx, dayBranchIdx)

  // 時柱（時刻不明の場合は null）
  let hourPillar: Pillar | null = null
  if (hour !== undefined) {
    const hourBranchIdx = Math.floor((hour + 1) / 2) % 12
    const hourStemIdx   = (dayStemIdx % 5 * 2 + hourBranchIdx) % 10
    hourPillar = makePillar(hourStemIdx, hourBranchIdx)
  }

  return { year: yearPillar, month: monthPillar, day: dayPillar, hour: hourPillar }
}
