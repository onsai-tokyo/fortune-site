/**
 * Timeline v3 — Vedic (sidereal, Lahiri) helpers.
 * - Longitudes are true ecliptic of date (EQJ -> ECT), then Lahiri ayanamsha is subtracted.
 * - Vimshottari year length is a named constant so it can be matched to the owner's reference software.
 * - Everything here REQUIRES a recorded birth time. Callers must not call these without one.
 */
import { Astronomy } from '../../astronomyEngineAdapter.js'
import { lahiriAyanamsha, resolveCapital, tropicalAscendant } from '../../astrology.js'

export const VIMSHOTTARI_YEAR_DAYS = 365.25
export const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const
export type DashaLord = typeof DASHA_ORDER[number]
const DASHA_YEARS: Record<DashaLord, number> = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 }
/** Whole-sign lords, index 0 = Aries. */
const SIGN_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const
const YEAR_MS = VIMSHOTTARI_YEAR_DAYS * 86_400_000
const norm = (x: number) => ((x % 360) + 360) % 360

export interface DashaPeriod { md: DashaLord; ad: DashaLord; start: number; end: number }
export interface VedicNatal {
  moonSidereal: number
  nakshatraIndex: number
  /** null when the birthplace cannot be resolved to a prefecture capital */
  lagnaSign: number | null
  natalSigns: Record<string, number>
  dashas: DashaPeriod[]
}

/** True-ecliptic-of-date longitude (tropical), degrees. */
export function tropicalLongitudeOfDate(body: string, date: Date): number {
  const b = (Astronomy.Body as any)[body]
  const eqj = Astronomy.GeoVector(b, date, true)
  const ect = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(date), eqj)
  return norm(Astronomy.SphereFromVector(ect).lon)
}
export const siderealLongitude = (body: string, date: Date) => norm(tropicalLongitudeOfDate(body, date) - lahiriAyanamsha(date))
export const siderealSign = (body: string, date: Date) => Math.floor(siderealLongitude(body, date) / 30)

/** birthUtc: the exact birth instant. */
export function vedicNatal(birthUtc: Date, birthplace?: string): VedicNatal {
  const moon = siderealLongitude('Moon', birthUtc)
  const nakLen = 360 / 27
  const nak = Math.floor(moon / nakLen)
  const fraction = (moon % nakLen) / nakLen
  let i = nak % 9
  let t = birthUtc.getTime() - fraction * DASHA_YEARS[DASHA_ORDER[i]] * YEAR_MS
  const dashas: DashaPeriod[] = []
  while (t < Date.UTC(2110, 0, 1)) {
    const md = DASHA_ORDER[i]
    let u = t
    for (let k = 0; k < 9; k++) {
      const ad = DASHA_ORDER[(i + k) % 9]
      const len = DASHA_YEARS[md] * DASHA_YEARS[ad] / 120 * YEAR_MS
      dashas.push({ md, ad, start: u, end: u + len })
      u += len
    }
    t += DASHA_YEARS[md] * YEAR_MS
    i = (i + 1) % 9
  }
  const capital = resolveCapital(birthplace)
  const lagnaSign = capital
    ? Math.floor(norm(tropicalAscendant(birthUtc, capital.coordinates[0], capital.coordinates[1]) - lahiriAyanamsha(birthUtc)) / 30)
    : null
  const natalSigns: Record<string, number> = {}
  for (const b of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) natalSigns[b] = siderealSign(b, birthUtc)
  return { moonSidereal: moon, nakshatraIndex: nak, lagnaSign, natalSigns, dashas }
}

/** Days of calendar year `year` (JST) covered by any antardasha of `lord`, and the covering periods. */
export function antardashaOverlap(v: VedicNatal, lord: DashaLord, year: number) {
  const ys = Date.UTC(year, 0, 1, -9), ye = Date.UTC(year + 1, 0, 1, -9)
  const periods = v.dashas.filter(d => d.ad === lord && d.end > ys && d.start < ye)
  const days = periods.reduce((n, d) => n + (Math.min(d.end, ye) - Math.max(d.start, ys)) / 86_400_000, 0)
  return { days, periods }
}

/** Mahadasha starts inside calendar year (JST). */
export function mahadashaStarts(v: VedicNatal, year: number) {
  const ys = Date.UTC(year, 0, 1, -9), ye = Date.UTC(year + 1, 0, 1, -9)
  return v.dashas.filter(d => d.md === d.ad && d.start >= ys && d.start < ye)
}

const JUPITER_ASPECT = new Set([0, 4, 6, 8])   // conj, 5th, 7th, 9th
const SATURN_ASPECT = new Set([0, 2, 6, 9])    // conj, 3rd, 7th, 10th
const influences = (planetSign: number, target: number, set: Set<number>) => set.has(((target - planetSign) % 12 + 12) % 12)

/**
 * Double transit on a house (whole sign from lagna): in a month, both Jupiter and Saturn
 * influence the house sign or the natal sign of its lord. Sampled on the 15th of each month, 12:00 JST.
 * Returns number of qualifying months (0-12). Requires lagna.
 */
export function doubleTransitMonths(v: VedicNatal, house: number, year: number): number {
  if (v.lagnaSign === null) return 0
  const houseSign = (v.lagnaSign + house - 1) % 12
  const lordSign = v.natalSigns[SIGN_LORD[houseSign]]
  let months = 0
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(year, m, 15, 3))
    const j = siderealSign('Jupiter', d), s = siderealSign('Saturn', d)
    const jOk = influences(j, houseSign, JUPITER_ASPECT) || influences(j, lordSign, JUPITER_ASPECT)
    const sOk = influences(s, houseSign, SATURN_ASPECT) || influences(s, lordSign, SATURN_ASPECT)
    if (jOk && sOk) months++
  }
  return months
}

export const formatMonth = (ms: number) => { const d = new Date(ms + 9 * 3600_000); return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月` }
