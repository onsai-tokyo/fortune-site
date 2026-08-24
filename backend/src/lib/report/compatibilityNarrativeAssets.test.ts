import assert from 'node:assert/strict'
import test from 'node:test'
import type { PairTraitScore } from './derivedTraitScores.js'
import { compatibilityProfileBlock, compatibilityScoreBlock, mutualUnderstandingBlock, relationshipTensionBlock } from './compatibilityNarrativeAssets.js'
import type { CompatibilityProfileScore, MutualUnderstandingProfile } from './synastryFacts.js'

const score = (key: PairTraitScore['key'], value: number, confidence = 0.8): PairTraitScore => ({
  key, value, confidence, inputScores: ['social_sensitivity'], relationAxes: [],
})

test('相性スコアを高・中・低の別文章へ変換する', () => {
  const low = compatibilityScoreBlock(score('compatibility_lifestyle', 0.2), '二人の暮らし')
  const middle = compatibilityScoreBlock(score('compatibility_lifestyle', 0.5), '二人の暮らし')
  const high = compatibilityScoreBlock(score('compatibility_lifestyle', 0.8), '二人の暮らし')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('確信度不足は一般論で埋めず既存文へフォールバックする', () => {
  assert.equal(compatibilityScoreBlock(score('compatibility_transparency', 0.9, 0.24), '会話'), null)
})

test('会話の流れを深い理解と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'conversational_flow', value, confidence, contributingFacts: ['cross-aspect:test'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '距離の始まり')
  const middle = compatibilityProfileBlock(profile(0.5), '距離の始まり')
  const high = compatibilityProfileBlock(profile(0.8), '距離の始まり')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /話が弾むことと心の奥まで分かることは別/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '距離の始まり'), null)
})

test('心の会話を会話量や同意と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'conversational_depth', value, confidence, contributingFacts: ['cross-aspect:moon-mercury'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '心の会話')
  const middle = compatibilityProfileBlock(profile(0.5), '心の会話')
  const high = compatibilityProfileBlock(profile(0.8), '心の会話')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /深く話せることを同意と決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /会話が多いから理解|必ず分かり合える/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('相互理解の3成分を平均せず文章へ残す', () => {
  const profile: MutualUnderstandingProfile = {
    key: 'mutual_understanding',
    components: {
      cognitive: { key: 'cognitive', value: 0.8, confidence: 0.7, contributingFacts: ['mercury'] },
      emotional: { key: 'emotional', value: 0.3, confidence: 0.6, contributingFacts: ['moon'] },
      deep: { key: 'deep', value: 0.5, confidence: 0.2, contributingFacts: [] },
    },
  }
  const block = mutualUnderstandingBlock(profile, '相手を理解する時')
  assert.equal(block?.scoreKey, 'mutual_understanding')
  assert.match(block?.text ?? '', /考えの筋道を受け取りやすい/)
  assert.match(block?.text ?? '', /感じていることは言葉で確かめて/)
  assert.ok([...(block?.text ?? '')].length <= 120)
  assert.equal(mutualUnderstandingBlock({ ...profile, components: {
    ...profile.components,
    cognitive: { ...profile.components.cognitive, confidence: 0.24 },
    emotional: { ...profile.components.emotional, confidence: 0.24 },
  } }, '相手を理解する時'), null)
})

test('掛け合いの楽しさを安心感の保証にしない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'humor_compatibility', value, confidence, contributingFacts: ['mercury-jupiter'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の会話')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の会話')
  const high = compatibilityProfileBlock(profile(0.8), '二人の会話')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /笑えることと安心できることは別/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず仲が良い|長続きする/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('友達的な近さを恋愛や長期継続の保証にしない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'friendship_compatibility', value, confidence, contributingFacts: ['mercury-mercury'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の自然さ')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の自然さ')
  const high = compatibilityProfileBlock(profile(0.8), '二人の自然さ')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /親友のような近さと、恋愛の約束は別/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず恋愛になる|長続きする/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('暮らしの相性を同棲時間や感情の深さと混同しない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'domestic_compatibility', value, confidence, contributingFacts: ['moon-venus'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の暮らし')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の暮らし')
  const high = compatibilityProfileBlock(profile(0.8), '二人の暮らし')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /一緒にいる時間の長さを心の深さとは決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /同棲すれば親密|必ず結婚/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('新体験の相性を刺激の強さや愛情の深さと混同しない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'novelty_compatibility', value, confidence, contributingFacts: ['jupiter-sun'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人で広げる世界')
  const middle = compatibilityProfileBlock(profile(0.5), '二人で広げる世界')
  const high = compatibilityProfileBlock(profile(0.8), '二人で広げる世界')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /刺激の強さを愛情の深さとは決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /刺激が強いほど相性が良い|必ず長続き/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('感情の深さを安心感と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'emotional_intimacy', value, confidence, contributingFacts: ['cross-aspect:moon'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '魅力の正体')
  const middle = compatibilityProfileBlock(profile(0.5), '魅力の正体')
  const high = compatibilityProfileBlock(profile(0.8), '魅力の正体')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /強く感じ取れることと安心して頼れることは別/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '魅力の正体'), null)
})

test('修復力を衝突の少なさや破局判定と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'repair_capacity', value, confidence, contributingFacts: ['cross-aspect:jupiter'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '安心への戻り道')
  const middle = compatibilityProfileBlock(profile(0.5), '安心への戻り道')
  const high = compatibilityProfileBlock(profile(0.8), '安心への戻り道')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /破局|別れる/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '安心への戻り道'), null)
})

test('許す力を我慢や修復手段そのものと混同しない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'forgiveness_capacity', value, confidence, contributingFacts: ['jupiter-moon'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '仲直りのあと')
  const middle = compatibilityProfileBlock(profile(0.5), '仲直りのあと')
  const high = compatibilityProfileBlock(profile(0.8), '仲直りのあと')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /許すことと我慢を続けることは分けて/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /何をされても許せる|必ず仲直り/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('感情的安心感を愛情の有無や親密度と混同しない文章へ変換する', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'emotional_safety', value, confidence, contributingFacts: ['cross-aspect:moon-sun'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '見落としやすい違い')
  const middle = compatibilityProfileBlock(profile(0.5), '見落としやすい違い')
  const high = compatibilityProfileBlock(profile(0.8), '見落としやすい違い')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /愛情がない|相性が悪い/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '見落としやすい違い'), null)
})

test('同じ衝突強度でも修復力によって扱い方を変える', () => {
  const profile = (key: CompatibilityProfileScore['key'], value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key, value, confidence, contributingFacts: [`fact:${key}`],
  })
  const supported = relationshipTensionBlock(profile('conflict_intensity', 0.8), profile('repair_capacity', 0.8), profile('emotional_safety', 0.7), '衝突の扱い')
  const unsupported = relationshipTensionBlock(profile('conflict_intensity', 0.8), profile('repair_capacity', 0.2), profile('emotional_safety', 0.2), '衝突の扱い')
  assert.notEqual(supported?.text, unsupported?.text)
  assert.match(supported?.text ?? '', /関係へ戻る手がかり/)
  assert.match(unsupported?.text ?? '', /話し直す時刻/)
  assert.doesNotMatch(`${supported?.text}${unsupported?.text}`, /破局|別れる|相性が悪い/)
  assert.equal(relationshipTensionBlock(profile('conflict_intensity', 0.8, 0.24), undefined, undefined, '衝突の扱い'), null)
})

test('衝突強度を単独プロフィール文へ誤って変換しない', () => {
  const conflict: CompatibilityProfileScore = {
    key: 'conflict_intensity', value: 0.8, confidence: 0.8, contributingFacts: ['cross-aspect:mars'],
  }
  assert.equal(compatibilityProfileBlock(conflict, '二人の価値観'), null)
  assert.equal(relationshipTensionBlock(conflict, undefined, undefined, '衝突の扱い')?.scoreKey, 'conflict_intensity')
})

test('共同成長を関係の継続保証とせず行動へ変換する', () => {
  const profile = (value: number, confidence = 0.6): CompatibilityProfileScore => ({
    key: 'growth_compatibility', value, confidence, contributingFacts: ['cross-aspect:jupiter-sun'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '関係が育つ力')
  const middle = compatibilityProfileBlock(profile(0.5), '関係が育つ力')
  const high = compatibilityProfileBlock(profile(0.8), '関係が育つ力')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /新しい目標/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず続く|成功する|運命/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '関係が育つ力'), null)
})

test('価値観の違いを相性不良とせず確認方法へ変換する', () => {
  const profile = (value: number, confidence = 0.6): CompatibilityProfileScore => ({
    key: 'value_alignment', value, confidence, contributingFacts: ['cross-aspect:sun-venus'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の輪郭')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の輪郭')
  const high = compatibilityProfileBlock(profile(0.8), '二人の輪郭')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(low?.text ?? '', /なぜ大切なのか/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /相性が悪い|合わない二人|別れる/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
  assert.equal(compatibilityProfileBlock(profile(0.8, 0.24), '二人の輪郭'), null)
})
