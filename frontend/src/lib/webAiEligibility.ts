export const WEB_AI_ADULT_NOTICE = 'AIの相談ブック作成・質問は18歳以上の方が利用できます。無料の読みもの・年表は15歳以上の方が利用できます。'

// Display gating only; the Web API independently checks the saved self reading.
export function webAiAdult(birthDate: unknown, now = new Date()): boolean {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false
  const parsed = new Date(birthDate + 'T00:00:00Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) return false
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => Number(parts.find(p => p.type === type)!.value)
  const [year, month, day] = birthDate.split('-').map(Number)
  const age = part('year') - year - (part('month') < month || (part('month') === month && part('day') < day) ? 1 : 0)
  return age >= 18
}
