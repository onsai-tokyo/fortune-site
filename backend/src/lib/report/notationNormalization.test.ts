import assert from 'node:assert/strict'
import test from 'node:test'
import { NAYIN, SUKUYO_ORDER } from '../divination/index.js'
import { NAYIN_DETAIL, SUKUYO_DETAIL } from '../deterministicReport.js'
import { buildChartSections } from './chartSections.js'
import {
  NAYIN_ALIAS, NAYIN_MAPPING, SUKUYO_MAPPING, ZIWEI_MAJOR_MAPPING, ZIWEI_MINOR_MAPPING,
  normalizeSukuyo, resolveNayin, resolveZiweiStar,
} from './keywordSignalMappings.js'

test('納音・宿曜の定義表は相互に一致する', () => {
  const uniqueNayin = [...new Set(NAYIN)]
  assert.equal(uniqueNayin.length, 30)
  for (const name of uniqueNayin) {
    assert.ok(NAYIN_DETAIL[name], `NAYIN_DETAIL missing: ${name}`)
    assert.ok(NAYIN_MAPPING[name], `NAYIN_MAPPING missing: ${name}`)
  }
  for (const [oldName, canonicalName] of Object.entries(NAYIN_ALIAS)) {
    assert.ok(NAYIN_MAPPING[canonicalName], `NAYIN_ALIAS target missing: ${canonicalName}`)
    assert.ok(!NAYIN.includes(oldName as typeof NAYIN[number]), `legacy NAYIN remains: ${oldName}`)
  }

  assert.equal(SUKUYO_ORDER.length, 27)
  for (const name of SUKUYO_ORDER) {
    assert.match(name, /^[^宿]$/)
    assert.ok(SUKUYO_DETAIL[name], `SUKUYO_DETAIL missing: ${name}`)
    assert.ok(SUKUYO_MAPPING[name], `SUKUYO_MAPPING missing: ${name}`)
  }
})

test('保存済みの旧納音表記を新表記と同じ意味へ解決する', () => {
  assert.deepEqual(resolveNayin('涧下水'), resolveNayin('澗下水'))
  assert.deepEqual(resolveNayin('白蜡金'), resolveNayin('白鑞金'))
  assert.equal(NAYIN_ALIAS.泉中水, '井泉水')
})

test('宿曜は内部単字へ正規化する', () => {
  assert.equal(normalizeSukuyo('心宿'), '心')
  assert.equal(normalizeSukuyo('心'), '心')
})

test('紫微斗数は完全一致を優先して火星と鈴星を壊さない', () => {
  assert.strictEqual(resolveZiweiStar('火星'), ZIWEI_MINOR_MAPPING.火星)
  assert.strictEqual(resolveZiweiStar('鈴星'), ZIWEI_MINOR_MAPPING.鈴星)
  assert.strictEqual(resolveZiweiStar('祿存'), ZIWEI_MINOR_MAPPING.禄存)
  assert.strictEqual(resolveZiweiStar('紫微星'), ZIWEI_MAJOR_MAPPING.紫微)
  assert.strictEqual(resolveZiweiStar('紫微'), ZIWEI_MAJOR_MAPPING.紫微)
})

test('命式詳細の表示は旧納音を新表記へ直し宿を重ねない', () => {
  const section = buildChartSections({ shichuDay: '甲子', sukuyo: '心宿', nayin: '涧下水' })
    .find(item => item.id === 'chart-lunar')
  assert.deepEqual(section?.list, [
    { label: '本命宿', value: '心宿' },
    { label: '納音', value: '澗下水' },
  ])
})
