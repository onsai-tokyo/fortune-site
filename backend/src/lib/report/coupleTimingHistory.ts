import { calcTimingCycles } from '../divination/index.js'
import { buildCoupleTimingHistory } from './coupleTimingCards.js'

function birth(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('BIRTH_UNAVAILABLE')
  const data = value as Record<string, unknown>
  const date = String(data.birthDate ?? data.birth_date ?? '')
  const time = String(data.birthTime ?? data.birth_time ?? '')
  const [year, month, day] = date.split('-').map(Number)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || year < 1900 || year > 2100) throw new Error('BIRTH_UNAVAILABLE')
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw new Error('BIRTH_UNAVAILABLE')
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('BIRTH_UNAVAILABLE')
  if (data.gender !== 'male' && data.gender !== 'female') throw new Error('BIRTH_UNAVAILABLE')
  const [hour, minute] = time ? time.split(':').map(Number) : [undefined, 0]
  return { year, annual: calcTimingCycles(year, month, day, hour, minute, data.gender).annual }
}

export function timingHistoryFromBirthSnapshot(snapshot: unknown, referenceYear?: number) {
  const value = snapshot as { self?: unknown; partner?: unknown } | null
  // Saved birth input is the only source. Never borrow another conversation or
  // a partner's subsequently edited profile to fill missing historical data.
  const self = birth(value?.self), partner = birth(value?.partner)
  return buildCoupleTimingHistory(self.annual, partner.annual, self.year, partner.year, referenceYear)
}
