/** Shadow-only contract. This module contains no calendar, timezone or astrology oracle. */
export type TimeGrain = 'instant' | 'day' | 'month' | 'year'
export interface HalfOpenTimeInterval { startMs: number; endMs: number }
export type PlacePrecision =
  | { kind: 'coordinates'; latitude: number; longitude: number }
  | { kind: 'region'; label: string }
  | { kind: 'unknown' }
export interface SourceTimeInput {
  sourceId: string
  calendarSystem: string
  grain: TimeGrain
  /** Source notation, interpreted only by its explicitly supplied provider. */
  observed: string
  timezone: string
  place: PlacePrecision
  asOfMs: number
}
export type TimeUnknownReason = 'canon_unapproved' | 'unsupported_timezone_range' | 'dst_gap' | 'dst_fold'
  | 'location_unknown' | 'location_not_exact' | 'invalid_input' | 'invalid_provider_result' | 'provider_failure'
export type SourceTimeResolution =
  | { status: 'unknown'; reason: TimeUnknownReason }
  | { status: 'resolved'; support: { kind: 'instant'; atMs: number } | { kind: 'interval'; interval: HalfOpenTimeInterval } }
export interface SourceTimeProvider {
  sourceId: string
  calendarSystem: string
  canonVersion: string
  tzdbVersion: string
  supportedRange: HalfOpenTimeInterval
  purpose: 'synthetic_fixture'
  requiresExactPlace: boolean
  resolve(input: Readonly<SourceTimeInput>): SourceTimeResolution
}
const instant = (value: number) => Number.isSafeInteger(value) && Math.abs(value) <= 8_640_000_000_000_000
export const validTimeInterval = (interval: HalfOpenTimeInterval | null | undefined): interval is HalfOpenTimeInterval =>
  Boolean(interval && instant(interval.startMs) && instant(interval.endMs) && interval.startMs < interval.endMs)
export const containsInstant = (interval: HalfOpenTimeInterval, atMs: number) =>
  validTimeInterval(interval) && instant(atMs) && interval.startMs <= atMs && atMs < interval.endMs

/** Proleptic Gregorian notation only, years 0001–9999. No historical calendar adoption or timezone conversion. */
export function parseGregorianObservation(observed: string, grain: Exclude<TimeGrain, 'instant'>) {
  const pattern = grain === 'year' ? /^(\d{4})$/ : grain === 'month' ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/
  const match = typeof observed === 'string' ? pattern.exec(observed) : null
  if (!match || match[0] !== observed) return null
  const year = Number(match[1])
  if (year < 1) return null
  const month = grain === 'year' ? null : Number(match[2])
  if (month !== null && (month < 1 || month > 12)) return null
  const day = grain === 'day' ? Number(match[3]) : null
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (day !== null && (day < 1 || day > daysInMonth[month! - 1])) return null
  return { calendarSystem: 'proleptic-gregorian' as const, grain, year, month, day }
}

export function resolveSourceTime(input: SourceTimeInput, provider?: SourceTimeProvider) {
  const envelope = { sourceId: input.sourceId, calendarSystem: input.calendarSystem, grain: input.grain,
    asOfMs: input.asOfMs, purpose: 'synthetic_fixture' as const, productionEligible: false as const }
  const unknown = (reason: TimeUnknownReason) => ({ ...envelope, status: 'unknown' as const, reason })
  const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  if (!instant(input.asOfMs) || !nonempty(input.sourceId) || !nonempty(input.calendarSystem)
    || !nonempty(input.observed) || !nonempty(input.timezone)
    || !['instant', 'day', 'month', 'year'].includes(input.grain)) return unknown('invalid_input')
  if (input.calendarSystem === 'proleptic-gregorian' && input.grain !== 'instant'
    && !parseGregorianObservation(input.observed, input.grain)) return unknown('invalid_input')
  if (!provider || provider.purpose !== 'synthetic_fixture' || provider.sourceId !== input.sourceId
    || provider.calendarSystem !== input.calendarSystem || !nonempty(provider.canonVersion) || !nonempty(provider.tzdbVersion)) return unknown('canon_unapproved')
  if (typeof provider.resolve !== 'function' || typeof provider.requiresExactPlace !== 'boolean'
    || !validTimeInterval(provider.supportedRange)) return unknown('invalid_provider_result')
  if (!input.place || !['coordinates', 'region', 'unknown'].includes(input.place.kind)
    || (input.place.kind === 'region' && !nonempty(input.place.label))) return unknown('invalid_input')
  if (input.place.kind === 'coordinates' && (!Number.isFinite(input.place.latitude) || Math.abs(input.place.latitude) > 90
    || !Number.isFinite(input.place.longitude) || Math.abs(input.place.longitude) > 180)) return unknown('invalid_input')
  if (provider.requiresExactPlace && input.place.kind !== 'coordinates') {
    return unknown(input.place.kind === 'unknown' ? 'location_unknown' : 'location_not_exact')
  }
  let result: SourceTimeResolution
  try { result = provider.resolve(input) } catch { return unknown('provider_failure') }
  if (!result || typeof result !== 'object') return unknown('invalid_provider_result')
  if (result.status === 'unknown') {
    const reasons: readonly TimeUnknownReason[] = ['canon_unapproved', 'unsupported_timezone_range', 'dst_gap', 'dst_fold',
      'location_unknown', 'location_not_exact', 'invalid_input', 'invalid_provider_result', 'provider_failure']
    return unknown(reasons.includes(result.reason) ? result.reason : 'invalid_provider_result')
  }
  if (result.status !== 'resolved' || !result.support || !['instant', 'interval'].includes(result.support.kind)) {
    return unknown('invalid_provider_result')
  }
  const support = result.support
  if (support.kind === 'instant') {
    // A year/month/day observation must never be silently narrowed to a point.
    if (input.grain !== 'instant' || !instant(support.atMs)) return unknown('invalid_provider_result')
    if (!containsInstant(provider.supportedRange, support.atMs)) return unknown('unsupported_timezone_range')
  } else {
    if (!validTimeInterval(support.interval)) return unknown('invalid_provider_result')
    if (support.interval.startMs < provider.supportedRange.startMs || support.interval.endMs > provider.supportedRange.endMs) {
      return unknown('unsupported_timezone_range')
    }
  }
  return { ...envelope, status: 'resolved' as const, support, canonVersion: provider.canonVersion, tzdbVersion: provider.tzdbVersion }
}
