import assert from 'node:assert/strict'
import test from 'node:test'
import { realizeClaimParagraph } from './claimComposer.js'
import { CLAIM_ASSETS } from './claimAssets.js'
import { containsJargon } from './jargon.js'
import { realizeTimingParagraph } from './timingCards.js'
import { TIMING_CLAIM_ASSETS } from './timingClaimAssets.js'

const BAD_SEQUENCES = ['。。', '、、', 'ますという', 'です。です', 'に、に', '、。', 'ことこと']
const COUNTER_OPENING = /^(一方で|その反面|ただし|逆に|そのわりに|反対に)/

function assertParagraphQuality(id: string, position: number, body: string) {
  assert.ok(body.endsWith('。'), `${id}@${position}: 句点で終わっていません`)
  assert.ok([...body].length <= 220, `${id}@${position}: 本文が220字を超えています`)
  assert.ok(!COUNTER_OPENING.test(body), `${id}@${position}: 対比語から始まっています`)
  for (const sequence of BAD_SEQUENCES) {
    assert.ok(!body.includes(sequence), `${id}@${position}: 不正な連結「${sequence}」`)
  }
  const sentences = body.split('。').filter(Boolean)
  assert.ok(sentences.length >= 3, `${id}@${position}: 3文未満です`)
  for (const sentence of sentences) {
    assert.ok((sentence.match(/とき/g) ?? []).length < 3, `${id}@${position}: 1文内の「とき」が多すぎます`)
    assert.ok((sentence.match(/場面/g) ?? []).length < 3, `${id}@${position}: 1文内の「場面」が多すぎます`)
    assert.ok((sentence.match(/年/g) ?? []).length < 4, `${id}@${position}: 1文内の「年」が多すぎます`)
  }
}

test('確定版の自己221件・時期199件を欠落なく保持する', () => {
  assert.equal(CLAIM_ASSETS.length, 221)
  assert.equal(TIMING_CLAIM_ASSETS.length, 199)
  const all = [...CLAIM_ASSETS, ...TIMING_CLAIM_ASSETS]
  assert.equal(new Set(all.map(asset => asset.id)).size, 420)
  assert.equal(new Set(all.map(asset => asset.typeLabel)).size, 420)
})

test('自己鑑定221件を6位置で実現しても文法欠陥・専門用語がなく、命題を保持する', () => {
  for (const asset of CLAIM_ASSETS) {
    const variants = Array.from({ length: 6 }, (_, position) => realizeClaimParagraph(asset, position))
    assert.equal(new Set(variants).size, 6, `${asset.id}: 6位置の文章が重複しています`)
    for (const [position, body] of variants.entries()) {
      assertParagraphQuality(asset.id, position, body)
      assert.ok(body.includes(asset.proposition), `${asset.id}@${position}: propositionが欠落しています`)
      if (asset.counterpart) assert.ok(body.includes(asset.counterpart), `${asset.id}@${position}: counterpartが欠落しています`)
      assert.equal(containsJargon(body), false, `${asset.id}@${position}: 本文に専門用語があります`)
    }
  }
})

test('時期199件を6位置で実現しても文法欠陥がなく、命題を対比より先に保持する', () => {
  for (const asset of TIMING_CLAIM_ASSETS) {
    const variants = Array.from({ length: 6 }, (_, position) => realizeTimingParagraph(asset, position))
    assert.equal(new Set(variants).size, 6, `${asset.id}: 6位置の文章が重複しています`)
    for (const [position, body] of variants.entries()) {
      assertParagraphQuality(asset.id, position, body)
      const propositionAt = body.indexOf(asset.proposition)
      assert.ok(propositionAt >= 0, `${asset.id}@${position}: propositionが欠落しています`)
      if (asset.counterpart) {
        const counterpartAt = body.indexOf(asset.counterpart)
        assert.ok(counterpartAt > propositionAt, `${asset.id}@${position}: counterpartが命題より前です`)
      }
    }
  }
})
