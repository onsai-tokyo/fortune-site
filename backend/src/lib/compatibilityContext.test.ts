import assert from 'node:assert/strict'
import test from 'node:test'
import { compactCompatibilityContext, compactCompatibilityPerson } from './compatibilityContext.js'

const annual = Array.from({ length: 43 }, (_, year) => ({ year: 2000 + year, monthly: Array.from({ length: 12 }, (_, month) => ({ month, details: ['長い年運データ'] })) }))
const calculated = {
  shichuDay: '壬午', fourPillars: [{ label: '日柱', kanshi: '壬午' }], elementBalance: { scores: { 木: 1, 火: 2 } },
  sanmeiRelations: { relations: ['関係'] }, timing: { annual },
  ziwei: { available: true, annual, palaces: [{ name: '命宮', majorStars: ['A'] }, { name: '官禄宮', majorStars: ['B'] }, { name: '夫妻宮', majorStars: ['C'] }] },
  astrology: { available: true, annual, western: { ascendant: '双子座', planets: ['月'], aspects: ['月と金星'] }, vedic: { moonNakshatra: '星宿', planets: ['月'] } },
  _structuredReport: { cards: Array.from({ length: 20 }, () => ({ text: '保存済み本文' })) },
}

test('相性AI用データから43年分の年運と保存済みレポートを除く', () => {
  const compact = compactCompatibilityPerson(calculated)
  const json = JSON.stringify(compact)
  assert.doesNotMatch(json, /monthly|_structuredReport|保存済み本文/)
  assert.ok(json.length < JSON.stringify(calculated).length / 5)
  assert.equal((compact.ziwei as { palaces: unknown[] }).palaces.length, 2)
})

test('本人と相手を同じ圧縮規則で保持する', () => {
  const context = compactCompatibilityContext(calculated, { ...calculated, shichuDay: '乙亥' }, 'romantic')
  assert.equal(context.relationshipType, 'romantic')
  assert.equal(context.self.shichuDay, '壬午')
  assert.equal(context.partner.shichuDay, '乙亥')
})
