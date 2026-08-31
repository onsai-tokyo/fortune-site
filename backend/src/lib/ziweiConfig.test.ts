import assert from 'node:assert/strict'
import test from 'node:test'
import { astro } from 'iztro'
import { assertFateLabZiweiConfig, calcZiwei, configureFateLabZiwei, FATE_LAB_ZIWEI_CONFIG } from './ziwei.js'

test('iztro 2.5.8の現行方式をFATE LAB設定として明示固定する', () => {
  assert.deepEqual(
    Object.fromEntries(Object.keys(FATE_LAB_ZIWEI_CONFIG).map(key => [key, astro.getConfig()[key as keyof typeof FATE_LAB_ZIWEI_CONFIG]])),
    FATE_LAB_ZIWEI_CONFIG,
  )
  assert.doesNotThrow(assertFateLabZiweiConfig)
})

test('他処理が紫微斗数設定を変更した場合は静かに別結果を返さず停止する', () => {
  astro.config({ ...FATE_LAB_ZIWEI_CONFIG, algorithm: 'zhongzhou' })
  try {
    assert.throws(() => calcZiwei(1995, 2, 20, 3, 'female', '愛知県'), /iztro config drift/)
  } finally {
    configureFateLabZiwei()
  }
  assert.equal(calcZiwei(1995, 2, 20, 3, 'female', '愛知県').available, true)
})

test('dayDivide=forwardの22時・晩子時23時・早子時0時の命盤境界を固定する', () => {
  const charts = [22, 23, 0].map(hour => calcZiwei(1995, 2, 20, hour, 'female', '愛知県'))
  assert.ok(charts.every(chart => chart.available))
  if (charts.some(chart => !chart.available)) return
  assert.deepEqual(charts.map(chart => chart.time), ['亥時', '晚子時', '早子時'])
  assert.deepEqual(
    charts.map(chart => chart.palaces.find(palace => palace.name === '命宮')?.majorStars.map(star => star.name) ?? []),
    [[], ['天機', '太陰'], ['廉貞']],
  )
})
