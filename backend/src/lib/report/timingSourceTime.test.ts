import test from 'node:test'
import assert from 'node:assert/strict'
import { containsInstant, resolveSourceTime, parseGregorianObservation, type SourceTimeInput, type SourceTimeProvider, type SourceTimeResolution } from './timingSourceTime.js'
const input: SourceTimeInput = { sourceId: 'fixture-ziwei', calendarSystem: 'fixture-lunar', grain: 'year', observed: 'fixture-year', timezone: 'fixture-zone', place: { kind: 'unknown' }, asOfMs: 1000 }
const provider: SourceTimeProvider = { sourceId: input.sourceId, calendarSystem: input.calendarSystem, canonVersion: 'synthetic-1', tzdbVersion: 'synthetic-1', purpose: 'synthetic_fixture', requiresExactPlace: false, supportedRange: { startMs: 0, endMs: 10000 }, resolve: () => ({ status: 'resolved', support: { kind: 'interval', interval: { startMs: 100, endMs: 900 } } }) }

test('source calendars keep separate synthetic boundaries and half-open membership', () => {
  const lunar = resolveSourceTime(input, provider)
  const solarInput = { ...input, sourceId: 'fixture-stem', calendarSystem: 'fixture-solar-term' }
  const solar = resolveSourceTime(solarInput, { ...provider, sourceId: solarInput.sourceId, calendarSystem: solarInput.calendarSystem, resolve: () => ({ status: 'resolved', support: { kind: 'interval', interval: { startMs: 200, endMs: 1000 } } }) })
  assert.equal(lunar.status, 'resolved'); assert.equal(solar.status, 'resolved')
  if (lunar.status !== 'resolved' || solar.status !== 'resolved' || lunar.support.kind !== 'interval' || solar.support.kind !== 'interval') throw new Error('interval required')
  assert.equal(containsInstant(lunar.support.interval, 150), true)
  assert.equal(containsInstant(solar.support.interval, 150), false)
  assert.equal(containsInstant(lunar.support.interval, 900), false)
  assert.equal(resolveSourceTime(solarInput, provider).status, 'unknown')
  assert.equal(lunar.productionEligible, false)
})
test('coarse observations retain intervals, explicit asOf and timezone version', () => {
  for (const grain of ['year', 'month', 'day'] as const) {
    const result = resolveSourceTime({ ...input, grain }, provider)
    assert.equal(result.status, 'resolved'); assert.equal(result.asOfMs, 1000)
    assert.equal(resolveSourceTime({ ...input, grain }, { ...provider, resolve: () => ({ status: 'resolved', support: { kind: 'instant', atMs: 100 } }) }).status, 'unknown')
  }
})
test('DST gaps/folds, unsupported range and absent canon never auto-resolve', () => {
  for (const reason of ['dst_gap', 'dst_fold'] as const) {
    const result = resolveSourceTime(input, { ...provider, resolve: () => ({ status: 'unknown', reason }) })
    assert.equal(result.status, 'unknown'); if (result.status === 'unknown') assert.equal(result.reason, reason)
  }
  assert.equal(resolveSourceTime(input).status, 'unknown')
  assert.equal(resolveSourceTime(input, { ...provider, supportedRange: { startMs: 101, endMs: 900 } }).status, 'unknown')
  assert.equal(resolveSourceTime(input, { ...provider, resolve: () => ({ status: 'resolved', support: { kind: 'interval', interval: { startMs: 100, endMs: 100 } } }) }).status, 'unknown')
})
test('region names never become exact places; geographic-independent provider can proceed', () => {
  const region = { ...input, place: { kind: 'region' as const, label: '愛知県' } }
  assert.equal(resolveSourceTime(region, provider).status, 'resolved')
  const result = resolveSourceTime(region, { ...provider, requiresExactPlace: true })
  assert.equal(result.status, 'unknown'); if (result.status === 'unknown') assert.equal(result.reason, 'location_not_exact')
  assert.equal(resolveSourceTime(input, { ...provider, requiresExactPlace: true }).status, 'unknown')
})


test('Gregorian input validates leap days without date rollover or invented month/day', () => {
  for (const date of ['2000-02-29', '2024-02-29', '2026-04-30', '0001-01-01', '9999-12-31']) {
    assert.ok(parseGregorianObservation(date, 'day'), date)
  }
  for (const date of ['1900-02-29', '2100-02-29', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '0000-01-01', '2026-2-01', '2026-01-01T00:00:00Z', '2024-02-29\n', ' 2024-02-29']) {
    assert.equal(parseGregorianObservation(date, 'day'), null, date)
  }
  assert.deepEqual(parseGregorianObservation('2024', 'year'), { calendarSystem: 'proleptic-gregorian', grain: 'year', year: 2024, month: null, day: null })
  assert.deepEqual(parseGregorianObservation('2024-02', 'month'), { calendarSystem: 'proleptic-gregorian', grain: 'month', year: 2024, month: 2, day: null })
  assert.equal(parseGregorianObservation('2024-02-29', 'month'), null)
  assert.equal(parseGregorianObservation('2024', 'day'), null)
})

test('Gregorian validation runs before provider and never applies to other source calendars', () => {
  let calls = 0
  const gregorianProvider: SourceTimeProvider = { ...provider, calendarSystem: 'proleptic-gregorian', resolve: source => { calls++; assert.equal(source.observed, '2024-02-29'); return provider.resolve(source) } }
  const invalid = resolveSourceTime({ ...input, calendarSystem: 'proleptic-gregorian', grain: 'day', observed: '1900-02-29' }, gregorianProvider)
  assert.equal(invalid.status, 'unknown')
  if (invalid.status === 'unknown') assert.equal(invalid.reason, 'invalid_input')
  assert.equal(calls, 0)
  assert.equal(resolveSourceTime({ ...input, calendarSystem: 'proleptic-gregorian', grain: 'day', observed: '2024-02-29' }, gregorianProvider).status, 'resolved')
  assert.equal(calls, 1)
  assert.equal(resolveSourceTime({ ...input, observed: 'source-specific-leap-month' }, provider).status, 'resolved')
})


test('provider failures and malformed responses stay unknown without fabricated support', () => {
  const failure = resolveSourceTime(input, { ...provider, resolve: () => { throw new Error('provider unavailable') } })
  assert.equal(failure.status, 'unknown')
  if (failure.status === 'unknown') assert.equal(failure.reason, 'provider_failure')
  for (const response of [null, undefined, {}, { status: 'ready' }, { status: 'unknown', reason: 'made-up' },
    { status: 'resolved', support: null }, { status: 'resolved', support: { kind: 'other' } },
    { status: 'resolved', support: { kind: 'interval', interval: null } }]) {
    const result = resolveSourceTime(input, { ...provider, resolve: () => response as SourceTimeResolution })
    assert.equal(result.status, 'unknown')
    if (result.status === 'unknown') assert.equal(result.reason, 'invalid_provider_result')
    assert.equal('support' in result, false)
  }
})

test('malformed place and missing provider metadata cannot pass the contract', () => {
  for (const place of [null, {}, { kind: 'city' }, { kind: 'region', label: ' ' }, { kind: 'coordinates', latitude: null, longitude: 135 }]) {
    assert.equal(resolveSourceTime({ ...input, place: place as SourceTimeInput['place'] }, provider).status, 'unknown')
  }
  for (const overrides of [{ supportedRange: null }, { tzdbVersion: ' ' }, { canonVersion: ' ' }, { resolve: undefined }, { requiresExactPlace: undefined }]) {
    assert.equal(resolveSourceTime(input, { ...provider, ...overrides } as SourceTimeProvider).status, 'unknown')
  }
})
