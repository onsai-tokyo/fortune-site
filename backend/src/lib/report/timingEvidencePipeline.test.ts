import assert from 'node:assert/strict'
import test from 'node:test'
import { calcAstrology } from '../astrology.js'
import { assertTimingEvidenceBirthInput, buildTimingEvidenceTimeline, buildTimingScoreTimeline } from './timingEvidencePipeline.js'
import { TIMING_SCORE_KEYS } from './timingClaim.js'
import { computeTimingScore } from './timingScoreEngine.js'

const base = { birthYear: 1995, birthMonth: 2, birthDay: 20, gender: 'female' as const, birthplace: '愛知県' }

test('4系統のEvidenceを43年分の同一timelineへ統合する', () => {
  const timeline = buildTimingEvidenceTimeline({ ...base, birthHour: 3, birthMinute: 2 })
  assert.equal(timeline.hasBirthTime, true)
  assert.equal(timeline.years.length, 43)
  assert.deepEqual([...timeline.byYear.keys()], timeline.years)
  const all = [...timeline.byYear.values()].flat()
  assert.deepEqual(new Set(all.map(item => item.sourceFamily)), new Set(['western', 'vedic', 'stem_branch', 'ziwei']))
})

test('時刻なしでは角度・紫微斗数を成立させず、時刻非依存Evidenceを維持する', () => {
  const untimed = buildTimingEvidenceTimeline(base)
  const timed = buildTimingEvidenceTimeline({ ...base, birthHour: 3, birthMinute: 2 })
  const untimedAll = [...untimed.byYear.values()].flat()
  const timedAll = [...timed.byYear.values()].flat()
  assert.equal(untimed.hasBirthTime, false)
  // 正午1点の代表値は日内不変の証明にならないため、時刻なしWesternは安全側で未利用。
  assert.ok(untimedAll.filter(item => item.sourceFamily === 'western').every(item => !item.available && !item.matched))
  // この日は出生当日に月宿が切り替わるためvedicは安全側に未確定となる。
  // 時刻入力だけを理由に定義を消したりavailableへ昇格させないことを確認する。
  assert.ok(untimedAll.some(item => item.sourceFamily === 'vedic'))
  assert.ok(untimedAll.filter(item => item.sourceFamily === 'vedic').every(item => !item.available))
  assert.ok(timedAll.filter(item => item.sourceFamily === 'vedic').every(item => item.available))
  assert.ok(untimedAll.some(item => item.sourceFamily === 'stem_branch' && item.available))
  assert.ok(untimedAll.filter(item => item.sourceFamily === 'ziwei').every(item => !item.available && !item.matched))
  assert.ok(timedAll.some(item => item.sourceFamily === 'ziwei' && item.available))
  const timedById = new Map(timedAll.map(item => [item.id, item]))
  // 干支系はこの出生時刻では日界をまたがないため同じ結果を維持する。
  for (const item of untimedAll.filter(entry => entry.available && entry.sourceFamily === 'stem_branch')) {
    const timedItem = timedById.get(item.id)
    assert.ok(timedItem, `時刻非依存Evidenceが時刻あり経路で欠落: ${item.id}`)
    assert.deepEqual(
      [timedItem.available, timedItem.matched, timedItem.support],
      [item.available, item.matched, item.support],
      `時刻非依存Evidenceが時刻入力で変化: ${item.id}`,
    )
  }
  // 西洋の個人天体は時刻あり経路で正午固定値を再利用せず、実出生時刻から再計算する。
  assert.ok(untimedAll.some(item => {
    const timedItem = timedById.get(item.id)
    return item.sourceFamily === 'western' && timedItem
      && (item.matched !== timedItem.matched || item.support !== timedItem.support)
  }))
})

test('同一入力はEvidence順序・内容まで再現する', () => {
  const input = { ...base, birthHour: 3, birthMinute: 2 }
  assert.deepEqual(buildTimingEvidenceTimeline(input), buildTimingEvidenceTimeline(input))
})

test('43年すべてで18スコアを返し、未実装スコアは安全なゼロに留める', () => {
  const timeline = buildTimingScoreTimeline({ ...base, birthHour: 3, birthMinute: 2 })
  assert.equal(timeline.scoresByYear.size, 43)
  for (const year of timeline.years) {
    const scores = timeline.scoresByYear.get(year)
    assert.ok(scores)
    assert.deepEqual(Object.keys(scores), TIMING_SCORE_KEYS)
    for (const result of Object.values(scores)) {
      assert.ok(Number.isFinite(result.rawSupport))
      assert.ok(Number.isFinite(result.relativeStrength))
      assert.ok(Number.isFinite(result.confidence))
    }
    assert.equal(scores.relationship_activation.rawSupport, 0)
  }
})

test('品質係数はスコア値を変えずconfidenceだけへ反映する', () => {
  const input = { ...base, birthHour: 3, birthMinute: 2 }
  const normal = buildTimingScoreTimeline(input)
  const uncertain = buildTimingScoreTimeline(input, { birthTimePrecision: .8, locationPrecision: .9 })
  for (const year of normal.years) {
    const left = normal.scoresByYear.get(year)!
    const right = uncertain.scoresByYear.get(year)!
    for (const key of TIMING_SCORE_KEYS) {
      assert.equal(right[key].rawSupport, left[key].rawSupport)
      assert.equal(right[key].relativeStrength, left[key].relativeStrength)
      assert.ok(right[key].confidence <= left[key].confidence)
    }
  }
})

test('missingness用の旧qualityキーを拒否しavailabilityとの二重減衰を防ぐ', () => {
  const timeline = buildTimingEvidenceTimeline(base)
  const definitions = timeline.byYear.get(timeline.years[0]!) ?? []
  assert.throws(
    () => computeTimingScore('relationship_disruption', definitions, { birthplace: 0.9 } as never),
    /Unknown timing quality key: birthplace/,
  )
})

test('市区町村付き出生地は都道府県へ解決し、未知の出生地を東京都へ置換しない', () => {
  const resolved = calcAstrology(1995, 2, 20, 3, 2, '愛知県名古屋市')
  assert.equal(resolved.available, true)
  assert.match(resolved.method, /出生地愛知県/)

  const unknown = calcAstrology(1995, 2, 20, 3, 2, '不明な場所')
  assert.equal(unknown.available, true)
  assert.equal(unknown.anglesAvailable, false)
  assert.equal(unknown.method, '出生時刻による個人天体のみ・出生地未解決')
  assert.ok((unknown.western?.planets.length ?? 0) > 0)
  assert.ok((unknown.annual?.flatMap(item => item.westernAspects).filter(aspect => !['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)).length ?? 0) > 0)
  assert.doesNotMatch(unknown.reason ?? '', /東京都/)

  const blank = calcAstrology(1995, 2, 20, 3, 2, '   ')
  assert.equal(blank.anglesAvailable, false)
  assert.doesNotMatch(blank.method, /東京都/)

  const negativePrefix = calcAstrology(1995, 2, 20, 3, 2, '東京都ではない')
  assert.equal(negativePrefix.anglesAvailable, false)
  assert.equal(negativePrefix.method, '出生時刻による個人天体のみ・出生地未解決')
  const descriptivePrefix = calcAstrology(1995, 2, 20, 3, 2, '東京都ではないが新宿区')
  assert.equal(descriptivePrefix.anglesAvailable, false)
  assert.equal(descriptivePrefix.method, '出生時刻による個人天体のみ・出生地未解決')

  const tokyoAddress = calcAstrology(1995, 2, 20, 3, 2, ' 東京都　新宿区 ')
  assert.equal(tokyoAddress.anglesAvailable, true)
  assert.match(tokyoAddress.method, /出生地東京都/)

  const timeline = buildTimingEvidenceTimeline({ ...base, birthHour: 3, birthMinute: 2, birthplace: '不明な場所' })
  const definitions = [...timeline.byYear.values()].flat()
  assert.ok(definitions.filter(item => item.id.startsWith('uranus-mc-ic:')).every(item => !item.available))
  assert.ok(definitions.some(item => item.id.startsWith('saturn-venus-hard:') && item.available))
  assert.ok(definitions.filter(item => item.factLineageId === 'vedic:antardasha:house10lord').every(item => !item.available))
})

test('不正な時刻と分だけの入力を時刻ありとして計算しない', () => {
  for (const birthHour of [Number.NaN, -1, 24, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertTimingEvidenceBirthInput({ ...base, birthHour }), /birthHour/)
    assert.throws(() => buildTimingEvidenceTimeline({ ...base, birthHour }), /birthHour/)
  }
  for (const birthMinute of [Number.NaN, -1, 60, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => assertTimingEvidenceBirthInput({ ...base, birthHour: 3, birthMinute }), /birthMinute/)
  }
  assert.throws(() => assertTimingEvidenceBirthInput({ ...base, birthMinute: 2 }), /requires birthHour/)
  assert.doesNotThrow(() => assertTimingEvidenceBirthInput(base))
  assert.doesNotThrow(() => assertTimingEvidenceBirthInput({ ...base, birthHour: 0, birthMinute: 0 }))
  assert.doesNotThrow(() => assertTimingEvidenceBirthInput({ ...base, birthHour: 23, birthMinute: 59 }))
})

test('共通出生入力schemaは不正日付・性別・出生地型を占術計算前に拒否する', () => {
  for (const input of [
    { ...base, birthYear: Number.NaN },
    { ...base, birthYear: 1899 },
    { ...base, birthMonth: 13 },
    { ...base, birthDay: 0 },
    { ...base, birthMonth: 2, birthDay: 30 },
    { ...base, gender: 'unknown' },
    { ...base, birthplace: 123 },
  ]) assert.throws(() => assertTimingEvidenceBirthInput(input as never))
  assert.doesNotThrow(() => assertTimingEvidenceBirthInput(base))
})

test('JST基準で今日を受理し、同一年の未来日を拒否する', () => {
  const reference = new Date('2026-08-30T15:30:00.000Z') // JST 2026-08-31
  assert.doesNotThrow(() => assertTimingEvidenceBirthInput({ ...base, birthYear: 2026, birthMonth: 8, birthDay: 31 }, reference))
  assert.throws(() => assertTimingEvidenceBirthInput({ ...base, birthYear: 2026, birthMonth: 9, birthDay: 1 }, reference), /future/)
  assert.throws(() => assertTimingEvidenceBirthInput({ ...base, birthYear: 2026, birthMonth: 12, birthDay: 31 }, reference), /future/)
})
