// cd backend && node --import tsx ../frontend/scripts/article-data/fortune-2027.ts [year]
// Data generation only. Production builds read the checked-in JSON.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { calcShichu, calcExpandedDivination } from '../../../backend/src/lib/divination/index.ts'

const require = createRequire(new URL('../../../backend/package.json', import.meta.url))
const { Solar } = require('lunar-javascript')
const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const slugs = ['kinoe', 'kinoto', 'hinoe', 'hinoto', 'tsuchinoe', 'tsuchinoto', 'kanoe', 'kanoto', 'mizunoe', 'mizunoto']
const terms = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒']
const termNames = ['立春', '啓蟄', '清明', '立夏', '芒種', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒']

export function termInstant(year: number, name: string): number {
  const table = Solar.fromYmdHms(year, 6, 1, 12, 0, 0).getLunar().getJieQiTable()
  const solar = table[name]
  if (!solar || solar.getYear() !== year) throw new Error(`Missing solar term ${year} ${name}`)
  // The calendar library reports solar-term times in China Standard Time.
  return Date.parse(solar.toYmdHms().replace(' ', 'T') + '+08:00')
}

export const jst = (instant: number) => new Date(instant + 9 * 3600000).toISOString().replace('.000Z', '+09:00')
export function chartAt(instant: number) {
  const date = new Date(instant + 9 * 3600000)
  return calcShichu(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes())
}

export function generateFortune(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new RangeError('Year must be 2000–2100')
  const start = termInstant(year, '立春'), end = termInstant(year + 1, '立春')
  // The reading API accepts minutes. Sample safely after a boundary with seconds.
  const annualChart = chartAt(start + 60000)
  const months = terms.map((name, i) => {
    const calendarYear = i === 11 ? year + 1 : year
    const calendarMonth = i === 11 ? 1 : i + 2
    const from = termInstant(calendarYear, name)
    const to = i === 11 ? end : termInstant(i === 10 ? year + 1 : year, terms[i + 1])
    const chart = chartAt(from + 60000)
    return { calendarYear, calendarMonth, term: termNames[i], startAt: jst(from), endAt: jst(to), pillar: chart.month.kanshi }
  })
  // Each reference day is a real engine-calculated day pillar, not an invented chart.
  const referenceDays = new Map<number, ReturnType<typeof calcShichu>['day']>()
  for (let offset = 0; offset < 60; offset++) {
    const date = new Date(Date.UTC(2000, 0, 1 + offset))
    const chart = calcShichu(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
    referenceDays.set(chart.day.stemIdx, chart.day)
  }
  const values = stems.map((stem, i) => {
    const day = referenceDays.get(i)!
    const relationship = (chart: ReturnType<typeof calcShichu>, key: 'year' | 'month') => {
      // Evaluate a transit pillar relative to the reference day stem with the same engine.
      const pillar = calcExpandedDivination({ ...chart, day }).fourPillars.find(p => p.key === key)!
      return { tenGod: pillar.stemTenGod, twelveStage: pillar.twelveStage }
    }
    return { stem, slug: slugs[i], annual: relationship(annualChart, 'year'), months: months.map(month => relationship(chartAt(Date.parse(month.startAt) + 60000), 'month')) }
  })
  return { year, timeZone: 'Asia/Tokyo', yearPillar: annualChart.year.kanshi, startAt: jst(start), endAt: jst(end), months, stems: values }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const year = Number(process.argv[2] ?? 2027)
  const data = generateFortune(year)
  if (year === 2027 && data.yearPillar !== '丁未') throw new Error('2027 must be 丁未')
  const dir = new URL('../../data/', import.meta.url)
  fs.mkdirSync(dir, { recursive: true })
  const file = new URL(`fortune-${year}.json`, dir)
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  console.log(`${year}: ${data.yearPillar}; ${data.startAt}; ${data.months.length} months; ${data.stems.length} stems`)
}
