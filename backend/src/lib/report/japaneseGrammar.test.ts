import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoupleTimingCards, type CoupleTurningPoint } from './coupleTimingCards.js'

const BROKEN_PARTICLE = /(やすい|にくい|できる|しやすい)[へにをがはと](?![ぁ-んァ-ヶ一-龠])/

export function assertNoBrokenParticle(text: string, label: string) {
  assert.doesNotMatch(text, BROKEN_PARTICLE, `${label}: 述語節が格助詞へ接続しています → ${text}`)
}

const samples: CoupleTurningPoint[] = [
  {
    year: 2027,
    selfAge: 32,
    partnerAge: 42,
    kind: 'aligned',
    selfThemes: ['収入と暮らしの基準を整えること', '縁がまとまること'],
    partnerThemes: ['仲間との役割を組み替えること', '活動範囲を広げること'],
    score: 8,
  },
  {
    year: 2029,
    selfAge: 34,
    partnerAge: 44,
    kind: 'divergent',
    selfThemes: ['移動や配置転換で関係を組み替えること'],
    partnerThemes: ['隠れていたずれや前提を見直すこと'],
    score: 6,
  },
]

test('二人の時期カードに非文がない', () => {
  for (const card of buildCoupleTimingCards(samples, 2026)) {
    assertNoBrokenParticle(card.summary, `${card.id}/summary`)
    for (const page of card.pages) assertNoBrokenParticle(page.text, `${card.id}/${page.label}`)
  }
})

test('二人の時期カードは1文が80文字を超えない', () => {
  for (const card of buildCoupleTimingCards(samples, 2026)) {
    for (const page of card.pages) {
      for (const sentence of page.text.split('。').filter(Boolean)) {
        assert.ok(sentence.length <= 80, `${card.id}/${page.label}: ${sentence.length}文字`)
      }
    }
  }
})
