import { astro } from 'iztro'

export const FATE_LAB_ZIWEI_CONFIG = Object.freeze({
  yearDivide: 'normal' as const,
  horoscopeDivide: 'normal' as const,
  ageDivide: 'normal' as const,
  dayDivide: 'forward' as const,
  algorithm: 'default' as const,
})

export function configureFateLabZiwei(): void {
  astro.config({ ...FATE_LAB_ZIWEI_CONFIG, mutagens: {}, brightness: {} })
}

export function assertFateLabZiweiConfig(): void {
  const actual = astro.getConfig()
  for (const [key, expected] of Object.entries(FATE_LAB_ZIWEI_CONFIG)) {
    if (actual[key as keyof typeof FATE_LAB_ZIWEI_CONFIG] !== expected) {
      throw new Error(`iztro config drift: ${key}=${String(actual[key as keyof typeof FATE_LAB_ZIWEI_CONFIG])}; expected=${expected}`)
    }
  }
  if (Object.keys(actual.mutagens).length || Object.keys(actual.brightness).length) {
    throw new Error('iztro config drift: custom mutagens/brightness are not approved')
  }
}

// iztro 2.5.8の現行既定値を、FATE LABの明示設定として固定する。
configureFateLabZiwei()
assertFateLabZiweiConfig()

const STAR_DETAIL: Record<string, string> = {
  紫微: '統率、尊厳、全体をまとめる力', 天機: '思考、企画、変化への対応力', 太陽: '発信、行動力、社会への貢献', 武曲: '実務、決断、財務感覚',
  天同: '調和、受容、生活を楽しむ力', 廉貞: '情熱、規律、複雑な状況を扱う力', 天府: '安定、管理、資源を蓄える力', 太陰: '感受性、内面、蓄積と配慮',
  貪狼: '社交性、欲求、才芸と展開力', 巨門: '言葉、分析、疑問を深める力', 天相: '調整、公平性、支援と品位', 天梁: '保護、原則、経験から人を導く力',
  七殺: '突破、決断、緊張下での実行力', 破軍: '刷新、破壊と再構築、大きな転換力',
}

export function resolveZiweiStarDetail(value: string): string | undefined {
  const raw = value.trim()
  if (STAR_DETAIL[raw]) return STAR_DETAIL[raw]
  const stripped = raw.replace(/星$/, '')
  return STAR_DETAIL[stripped]
}

export function timeIndex(hour: number): number {
  return hour === 23 ? 12 : Math.floor((hour + 1) / 2)
}

export function calcZiwei(year: number, month: number, day: number, hour: number | undefined, gender: 'male' | 'female', birthplace?: string) {
  assertFateLabZiweiConfig()
  if (hour === undefined) {
    return { available: false as const, birthplace: birthplace || '未選択', reason: '紫微斗数は出生時刻が必要なため算出できません。' }
  }

  const chart = astro.bySolar(`${year}-${month}-${day}`, timeIndex(hour), gender, true, 'ja-JP')
  const palaces = chart.palaces.map(palace => ({
    name: palace.name,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
    isBodyPalace: palace.isBodyPalace,
    majorStars: palace.majorStars.map(star => ({
      name: star.name,
      brightness: star.brightness || '',
      mutagen: star.mutagen || '',
      detail: resolveZiweiStarDetail(star.name) ?? 'この宮位のテーマを具体化する主星',
    })),
    minorStars: palace.minorStars.map(star => star.name),
    decadal: palace.decadal,
  }))
  const annual = Array.from({ length: 43 }, (_, offset) => {
    const targetYear = year + 18 + offset
    const horoscope = chart.horoscope(`${targetYear}-${month}-${day}`, timeIndex(hour))
    const yearly = horoscope.yearly
    // yearly.index is the position where the yearly Life Palace lands in the
    // natal chart. yearly.palaceNames[yearly.index] is always "命宮", so using
    // it here made every year look like a Life-Palace year.
    const annualLifePalace = String(chart.palaces[yearly.index]?.name ?? '').replace('祿', '禄')
    const activePalaces = annualLifePalace ? [annualLifePalace] : []
    const palace = annualLifePalace.replace(/宮$/, '')
    const signals: string[] = []
    if (palace === '官禄' || palace === '財帛') signals.push('practicality', 'responsibility')
    if (palace === '夫妻') signals.push('harmony', 'stability')
    if (palace === '命') signals.push('initiative', 'transformation')
    if (palace === '遷移') signals.push('transformation', 'exploration')
    if (palace === '田宅') signals.push('stability', 'transformation')
    const mutagenNames = ['化禄', '化権', '化科', '化忌'] as const
    const mutagenPlacements = yearly.mutagen.map((starName, index) => {
      const owners = chart.palaces.filter(candidate => [...candidate.majorStars, ...candidate.minorStars].some(star => star.name === starName))
      const owner = owners.length === 1 ? owners[0] : undefined
      return { mutagen: mutagenNames[index]!, star: starName, palace: String(owner?.name ?? '').replace('祿', '禄').replace(/宮$/, '') }
    })
    return { year: targetYear, heavenlyStem: yearly.heavenlyStem, earthlyBranch: yearly.earthlyBranch, activePalaces, mutagenStars: yearly.mutagen, mutagenPlacements, signals: [...new Set(signals)] }
  })

  return {
    available: true as const,
    birthplace: birthplace || '未選択',
    standardTimeNote: '日本標準時（JST）の出生時刻で排盤',
    solarDate: chart.solarDate,
    lunarDate: chart.lunarDate,
    time: chart.time,
    timeRange: chart.timeRange,
    fiveElementsClass: chart.fiveElementsClass,
    soul: chart.soul,
    body: chart.body,
    earthlyBranchOfSoulPalace: chart.earthlyBranchOfSoulPalace,
    earthlyBranchOfBodyPalace: chart.earthlyBranchOfBodyPalace,
    palaces, annual,
  }
}
