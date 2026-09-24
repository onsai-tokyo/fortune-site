import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import {
  calculateSpouse, SPOUSE_BOUNDARY_SAFETY_SECONDS, SPOUSE_METHOD_VERSION,
  type SpouseCalculationInput, type SpousePendingReason,
} from './spouseCalculation.js'

const base: SpouseCalculationInput = { birthDate: '2026-01-06', birthTime: '00:00', timeZone: 'Asia/Tokyo' }
function expectPending(input: SpouseCalculationInput, reason: SpousePendingReason) {
  const result = calculateSpouse(input)
  assert.equal(result.status, 'pending')
  if (result.status !== 'pending') throw new Error('Expected pending calculation')
  assert.equal(result.reason, reason)
  assert.equal('star' in result, false)
  assert.equal(result.methodVersion, SPOUSE_METHOD_VERSION)
  return result
}

test('an unverified or unavailable runtime package version cannot claim the verified calendar method', () => {
  for (const version of ['1.7.8', null, '1.7.7']) {
    // Only this child process's JSON-module cache is changed. The installed
    // dependency and the parent test process remain untouched.
    const script = `
      import metadata from 'lunar-javascript/package.json' with { type: 'json' };
      metadata.version = ${JSON.stringify(version)};
      const { calculateSpouse } = await import(${JSON.stringify(new URL('./spouseCalculation.js', import.meta.url).href)});
      process.stdout.write(JSON.stringify(calculateSpouse(${JSON.stringify(base)})));
    `
    const result = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], { encoding: 'utf8' }))
    assert.equal(result.status, version === '1.7.7' ? 'ready' : 'pending')
    if (version !== '1.7.7') {
      assert.equal(result.reason, 'calendar_unavailable')
      assert.equal('star' in result, false)
    }
    assert.equal(result.methodVersion, SPOUSE_METHOD_VERSION)
  }
  assert.equal(calculateSpouse(base).status, 'ready', 'child version substitutions cannot leak into this process')
})

test('spouse calculation fails closed for missing, malformed, unsupported and mismatched inputs', () => {
  const cases: Array<[Partial<SpouseCalculationInput>, SpousePendingReason]> = [
    [{ birthDate: undefined }, 'missing_birth_date'], [{ birthTime: '' }, 'missing_birth_time'],
    [{ timeZone: undefined }, 'missing_time_zone'], [{ timeZone: 'America/New_York' }, 'unsupported_time_zone'],
    [{ timeZone: 'UTC+09:00' }, 'unsupported_time_zone'], [{ birthDate: '2026-02-30' }, 'invalid_birth_date'],
    [{ birthDate: '2026-13-01' }, 'invalid_birth_date'], [{ birthDate: '2026-1-06' }, 'invalid_birth_date'],
    [{ birthDate: '1951-12-31' }, 'unsupported_birth_date'], [{ birthDate: '2101-01-01' }, 'unsupported_birth_date'],
    [{ birthTime: '24:00' }, 'invalid_birth_time'], [{ birthTime: '00:60' }, 'invalid_birth_time'],
    [{ birthTime: '00:00:30' }, 'invalid_birth_time'], [{ birthTime: ' 00:00' }, 'invalid_birth_time'],
    [{ expectedDayPillar: '甲丑' }, 'invalid_day_pillar'], [{ expectedDayPillar: '甲子' }, 'day_pillar_mismatch'],
  ]
  for (const [overrides, reason] of cases) expectPending({ ...base, ...overrides }, reason)
  for (const [field, value, reason] of [
    ['birthDate', ['2026-01-06'], 'invalid_birth_date'], ['birthDate', 20260106, 'invalid_birth_date'],
    ['birthTime', ['00:00'], 'invalid_birth_time'], ['birthTime', {}, 'invalid_birth_time'],
    ['timeZone', ['Asia/Tokyo'], 'unsupported_time_zone'],
  ] as const) expectPending({ ...base, [field]: value } as unknown as SpouseCalculationInput, reason)
})

test('CST solar-term wall time is converted once to JST; elapsed days start at one', () => {
  const result = calculateSpouse({ ...base, expectedDayPillar: '庚辰' })
  assert.equal(result.status, 'ready')
  if (result.status !== 'ready') return
  assert.equal(result.dayPillar, '庚辰')
  assert.equal(result.star, '正財')
  assert.equal(result.branch, '辰')
  assert.equal(result.calculation.nthDay, 1)
  assert.equal(result.calculation.hiddenStem, '乙')
  assert.equal(result.calculation.setsuName, '小寒')
  assert.match(result.calculation.setsuAtJst, /^2026-01-05T17:23:/)
  assert.ok(Math.abs(Date.parse(result.calculation.setsuAtJst) - Date.parse('2026-01-05T17:22:53.352814+09:00')) <= 60_000)
  const tenth = calculateSpouse({ ...base, birthDate: '2026-01-15', birthTime: '12:00' })
  assert.equal(tenth.status, 'ready')
  if (tenth.status !== 'ready') return
  assert.equal(tenth.calculation.nthDay, 10)
  assert.equal(tenth.calculation.hiddenStem, '辛')
  assert.equal(tenth.star, '食神')
})

test('civil day changes at 00:00 JST, without a 23:00 switch or an astronomy margin at midnight', () => {
  for (const birthTime of ['22:59', '23:00', '23:59']) {
    const result = calculateSpouse({ ...base, birthDate: '2026-05-01', birthTime, expectedDayPillar: '乙亥' })
    assert.equal(result.status, 'ready')
    if (result.status !== 'ready') continue
    assert.equal(result.dayPillar, '乙亥')
    assert.equal(result.star, '印綬')
  }
  const next = calculateSpouse({ ...base, birthDate: '2026-05-02', birthTime: '00:00', expectedDayPillar: '丙子' })
  assert.equal(next.status, 'ready')
  if (next.status === 'ready') assert.equal(next.star, '正官')
})

test('minute precision and the sixty-second margin withhold solar and hidden-stem transitions', () => {
  for (const birthTime of ['05:01', '05:02', '05:03']) {
    const result = expectPending({ ...base, birthDate: '2026-02-04', birthTime }, 'boundary_uncertain')
    assert.equal(result.calculation?.boundary?.kind, 'solar_term')
  }
  assert.equal(calculateSpouse({ ...base, birthDate: '2026-02-04', birthTime: '05:04' }).status, 'ready')
  for (const birthTime of ['17:22', '17:23', '17:24']) {
    const result = expectPending({ ...base, birthDate: '2026-01-19', birthTime }, 'boundary_uncertain')
    assert.equal(result.calculation?.boundary?.kind, 'hidden_stem')
  }
  const before = calculateSpouse({ ...base, birthDate: '2026-01-19', birthTime: '17:20' })
  const after = calculateSpouse({ ...base, birthDate: '2026-01-19', birthTime: '17:25' })
  assert.equal(before.status, 'ready'); assert.equal(after.status, 'ready')
  if (before.status === 'ready' && after.status === 'ready') {
    assert.equal(before.calculation.hiddenStem, '庚'); assert.equal(after.calculation.hiddenStem, '丙')
    assert.notEqual(before.star, after.star)
  }
  assert.equal(SPOUSE_BOUNDARY_SAFETY_SECONDS, 60)
  assert.ok(SPOUSE_METHOD_VERSION.includes(`guard${SPOUSE_BOUNDARY_SAFETY_SECONDS}s`))
})

test('unverified table repairs stay pending, including the day 10 to 11 source-eligibility boundary', () => {
  expectPending({ ...base, birthDate: '2026-01-05', birthTime: '12:00' }, 'unresolved_table_convention')
  expectPending({ ...base, birthDate: '2026-06-15', birthTime: '12:00' }, 'unresolved_table_convention')
  expectPending({ ...base, birthDate: '2025-01-15', birthTime: '11:29' }, 'unresolved_table_convention')
  for (const birthTime of ['11:31', '11:32', '11:33']) {
    const result = expectPending({ ...base, birthDate: '2025-01-15', birthTime }, 'boundary_uncertain')
    assert.equal(result.calculation?.boundary?.kind, 'table_convention')
  }
  const confirmed = calculateSpouse({ ...base, birthDate: '2025-01-15', birthTime: '11:34' })
  assert.equal(confirmed.status, 'ready')
  if (confirmed.status === 'ready') {
    assert.equal(confirmed.calculation.nthDay, 11)
    assert.equal(confirmed.star, '偏印')
  }
})

interface RawReference {
  dayPillar: string; branch: string; star: string; hiddenStem: string; primaryStar: string
  setsuName: string; setsuAtJst: string; nthDay: number; tableProvisionalReasons: string[]
}
interface IndependentFixture {
  id: string; category: string; input: SpouseCalculationInput
  rawAtMinuteStart: RawReference; rawBeforeMinuteEnd: RawReference; crossesDecisionBoundaryWithinMinute: boolean
}
const reference = JSON.parse(readFileSync(new URL('./__fixtures__/spouseCalculation.sxtwl.json', import.meta.url), 'utf8')) as {
  reference: string; library: { name: string; version: string }; tableSha256: string; fixtures: IndependentFixture[]
  pendingInputs: Array<{ id: string; input: SpouseCalculationInput }>
}

test('independent corrected-sxtwl fixtures agree for every ready result and exercise the adopted table', () => {
  assert.equal(reference.library.name, 'sxtwl')
  assert.equal(reference.library.version, '2.0.7')
  assert.equal(reference.tableSha256, 'f2bf0e18373722beaa528ab11610e64a382bd82478ee1c15170b21f99e3105d7')
  assert.ok(reference.fixtures.length >= 140)
  let ready = 0, pending = 0
  const covered = new Set<string>()
  for (const fixture of reference.fixtures) {
    const raw = fixture.rawAtMinuteStart
    const result = calculateSpouse({ ...fixture.input, expectedDayPillar: raw.dayPillar })
    const away = fixture.category === 'table_coverage' || fixture.category === 'civil_midnight_and_23h'
      || fixture.id.endsWith('--3m') || fixture.id.endsWith('-+3m')
    if (fixture.crossesDecisionBoundaryWithinMinute || fixture.id.endsWith('-+0m')) {
      assert.equal(result.status, 'pending', fixture.id)
    }
    if (away && !raw.tableProvisionalReasons.length) assert.equal(result.status, 'ready', fixture.id)
    if (result.status === 'ready') {
      ready++
      for (const expected of [raw, fixture.rawBeforeMinuteEnd]) {
        assert.equal(result.dayPillar, expected.dayPillar, fixture.id)
        assert.equal(result.branch, expected.branch, fixture.id)
        assert.equal(result.star, expected.star, fixture.id)
        assert.equal(result.calculation.hiddenStem, expected.hiddenStem, fixture.id)
        assert.equal(expected.tableProvisionalReasons.length, 0, fixture.id)
      }
      assert.equal(result.calculation.primaryStar, raw.primaryStar, fixture.id)
      assert.equal(result.calculation.setsuName, raw.setsuName, fixture.id)
      assert.ok(Math.abs(Date.parse(result.calculation.setsuAtJst) - Date.parse(raw.setsuAtJst)) <= 60_000, fixture.id)
      if (fixture.category === 'table_coverage') covered.add(`${result.branch}:${result.calculation.hiddenStem}`)
    } else {
      pending++
      assert.ok(['boundary_uncertain', 'unresolved_table_convention'].includes(result.reason), `${fixture.id}: ${result.reason}`)
    }
  }
  assert.ok(ready >= 50)
  assert.ok(pending >= 30)
  assert.equal(covered.size, 27, 'all non-provisional hidden-stem cells')
  for (const fixture of reference.pendingInputs) assert.equal(calculateSpouse(fixture.input).status, 'pending', fixture.id)
})
