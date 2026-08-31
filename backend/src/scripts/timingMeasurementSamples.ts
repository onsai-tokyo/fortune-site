export interface TimingMeasurementProfile {
  id: string
  birthYear: number
  birthMonth: number
  birthDay: number
  birthHour: number
  birthMinute: number
  gender: 'male' | 'female'
  birthplace: string
}

/** 同一出生条件を重複させない、測定専用の決定論サンプル。 */
export function timingMeasurementProfiles(requested: number): TimingMeasurementProfile[] {
  if (!Number.isInteger(requested) || requested < 1 || requested > 10_000) throw new RangeError('sample count must be an integer in [1, 10000]')
  const result: TimingMeasurementProfile[] = []
  const seen = new Set<string>()
  const epoch = Date.UTC(1965, 0, 1)
  for (let index = 0; result.length < requested; index += 1) {
    const dayOffset = (index * 137) % (42 * 365)
    const date = new Date(epoch + dayOffset * 86_400_000)
    const birthHour = (index * 5) % 24
    const birthMinute = (index * 13) % 60
    const gender = index % 2 ? 'male' as const : 'female' as const
    const birthplace = index % 3 === 0 ? '東京都' : index % 3 === 1 ? '愛知県' : '沖縄県'
    const birthYear = date.getUTCFullYear(); const birthMonth = date.getUTCMonth() + 1; const birthDay = date.getUTCDate()
    const id = `${birthYear}-${birthMonth}-${birthDay}|${birthHour}:${birthMinute}|${gender}|${birthplace}`
    if (seen.has(id)) continue
    seen.add(id)
    result.push({ id, birthYear, birthMonth, birthDay, birthHour, birthMinute, gender, birthplace })
  }
  return result
}
