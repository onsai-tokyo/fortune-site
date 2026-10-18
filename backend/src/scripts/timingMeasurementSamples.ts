import { createHash } from 'node:crypto'
export interface TimingMeasurementProfile {
  id: string; birthYear: number; birthMonth: number; birthDay: number
  birthHour: number; birthMinute: number; gender: 'male' | 'female'; birthplace: string
}
export const TIMING_MEASUREMENT_DATASET = { version: 'independent-draw-v2', purpose: 'synthetic_calibration', populationClaim: false } as const
/** Independent dimension streams, unbiased rejection sampling and explicit seed. */
export function timingDraw(seed: string, index: number, dimension: string, bound: number): number {
  if (!Number.isInteger(bound) || bound < 1 || bound > 0xffffffff) throw new RangeError('Invalid draw bound')
  const limit = Math.floor(0x100000000 / bound) * bound
  for (let retry = 0; ; retry++) {
    const value = createHash('sha256').update(JSON.stringify([seed, index, dimension, retry])).digest().readUInt32BE(0)
    if (value < limit) return value % bound
  }
}
export function timingMeasurementProfiles(requested: number, seed = 'fatelab-synthetic-v2'): TimingMeasurementProfile[] {
  if (!Number.isInteger(requested) || requested < 1 || requested > 10_000) throw new RangeError('sample count must be an integer in [1, 10000]')
  const result: TimingMeasurementProfile[] = [], seen = new Set<string>()
  const epoch = Date.UTC(1965, 0, 1), days = (Date.UTC(2007, 0, 1) - epoch) / 86_400_000
  for (let index = 0; result.length < requested; index++) {
    const date = new Date(epoch + timingDraw(seed, index, 'date', days) * 86_400_000)
    const minute = timingDraw(seed, index, 'minute-of-day', 1440)
    const birthHour = Math.floor(minute / 60), birthMinute = minute % 60
    const gender = timingDraw(seed, index, 'gender', 2) ? 'male' as const : 'female' as const
    const birthplace = ['東京都', '愛知県', '沖縄県'][timingDraw(seed, index, 'place', 3)]
    const birthYear = date.getUTCFullYear(), birthMonth = date.getUTCMonth() + 1, birthDay = date.getUTCDate()
    const id = `${birthYear}-${birthMonth}-${birthDay}|${birthHour}:${birthMinute}|${gender}|${birthplace}`
    if (seen.has(id)) continue
    seen.add(id); result.push({ id, birthYear, birthMonth, birthDay, birthHour, birthMinute, gender, birthplace })
  }
  return result
}
export function timingMidrank(value: number, population: readonly number[]) {
  if (!Number.isFinite(value) || population.some(v => !Number.isFinite(v))) throw new Error('Rank requires finite observations')
  if (!population.length) return { value: null, usable: false, reason: 'empty_population' }
  const rank = (population.filter(v => v < value).length + .5 * population.filter(v => v === value).length) / population.length
  const usable = new Set(population).size > 1
  return { value: rank, usable, reason: usable ? null : 'all_tied' }
}
