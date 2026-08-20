import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReportInput } from '../deterministicReport.js'
import { extractReportMetadata, prioritizeCardsForConcern } from './metadata.js'

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    birthDate: '1990-01-01', age: 36, shichuDay: '甲子', nayin: '海中金', sanmeiStar: '貫索星',
    chusatsu: '戌亥天中殺', sukuyo: '角', lifePathNumber: 3, honmeiName: '一白水星',
    elementBalance: { scores: { 木: 5, 火: 0, 土: 2, 金: 1, 水: 0 }, method: 'test' },
    ...overrides,
  }
}

test('五行ゼロを欠落要素として抽出する', () => {
  const result = extractReportMetadata(input())
  assert.deepEqual(result.missingElements.filter(item => item.severity === 'missing').map(item => item.element).sort(), ['水', '火'])
  assert.deepEqual(result.dominantElements, [{ element: '木', score: 5 }])
})

test('追加3項目はすべて未回答でも成立する', () => {
  const result = extractReportMetadata(input())
  assert.deepEqual(result.profile, {})
  assert.equal(result.lifeStage, '30s')
})

test('任意プロフィールを正規化して保持する', () => {
  const result = extractReportMetadata(input(), { nickname: '  まなみ  ', currentRole: 'owner', currentConcern: 'work' })
  assert.deepEqual(result.profile, { nickname: 'まなみ', currentRole: 'owner', currentConcern: 'work' })
})

test('異なる生年月日の10件は異なる組み合わせ署名になる', () => {
  const signatures = Array.from({ length: 10 }, (_, index) => extractReportMetadata(input({
    birthDate: `199${index}-01-01`,
    lifePathNumber: index + 1,
  })).combinationSignature)
  assert.equal(new Set(signatures).size, 10)
})

test('気になるテーマを選ぶと該当カードを先頭へ移す', () => {
  const cards = [
    { id: 'core', kind: 'essence' as const, title: '本質', summary: '軸', tags: ['本質'], period: null, pages: [], evidence: [] },
    { id: 'work', kind: 'essence' as const, title: '仕事で活きる力', summary: '仕事', tags: ['仕事'], period: null, pages: [], evidence: [] },
  ]
  assert.deepEqual(prioritizeCardsForConcern(cards, 'work').map(card => card.id), ['work', 'core'])
  assert.equal(prioritizeCardsForConcern(cards), cards)
})
