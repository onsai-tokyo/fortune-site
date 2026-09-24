import { readFileSync } from 'node:fs'
export interface AnnualText {
  pattern_id: string; day_index: number; year_cycle_index: number; source_pattern_id: string
  title: string; description: string; relationship: string; career: string; life: string
}
const cache = new Map<number, ReadonlyArray<Readonly<AnnualText>>>()
export const cycleIndex = (year: number) => ((year - 1984) % 60 + 60) % 60
export function annualText(day: number, year: number): Readonly<AnnualText> {
  if (!Number.isInteger(day) || day < 0 || day >= 60 || !Number.isInteger(year)) throw new RangeError('Invalid annual catalogue key')
  let records = cache.get(day)
  if (!records) {
    const file = new URL(`./data/${String(day + 1).padStart(2, '0')}.json`, import.meta.url)
    records = Object.freeze((JSON.parse(readFileSync(file, 'utf8')).records as AnnualText[]).map(record => Object.freeze(record)))
    if (cache.size >= 8) cache.delete(cache.keys().next().value!)
    cache.set(day, records)
  }
  return records[cycleIndex(year)]
}
