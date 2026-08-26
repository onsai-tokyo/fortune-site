import { japanDateParts } from './japanDate.js'

export function calcAge(birthDate: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate.trim())
  if (!match) return null
  const [, year, month, day] = match
  const today = japanDateParts(now)
  let age = today.year - Number(year)
  if (today.month < Number(month) || (today.month === Number(month) && today.day < Number(day))) age -= 1
  return age
}

export function ageInYear(birthDate: string, targetYear: number): number | null {
  const match = /^(\d{4})/.exec(birthDate.trim())
  return match ? targetYear - Number(match[1]) : null
}

export function periodLabel(birthDate: string, targetYear: number, now = new Date()): string {
  const age = ageInYear(birthDate, targetYear)
  if (age == null) return `${targetYear}年`
  return targetYear === japanDateParts(now).year
    ? `${targetYear}年（${age}歳の年）`
    : `${targetYear}年（${age}歳になる年）`
}
