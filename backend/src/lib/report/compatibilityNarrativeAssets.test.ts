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

test('共同プロジェクトの相性を恋愛の充実や競争心と混同しない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'shared_project_compatibility', value, confidence, contributingFacts: ['mars-jupiter'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人でできること')
  const middle = compatibilityProfileBlock(profile(0.5), '二人でできること')
  const high = compatibilityProfileBlock(profile(0.8), '二人でできること')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /共同作業の充実を恋愛の充実とは決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /仕事ができれば恋愛も成功|競争心がない/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('旅行・外出の相性を日常の安定性と混同しない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'adventure_compatibility', value, confidence, contributingFacts: ['jupiter-mars'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の外出')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の外出')
  const high = compatibilityProfileBlock(profile(0.8), '二人の外出')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /旅行中の高揚を日常の安定とは分けて/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /旅行が楽しいから結婚|必ず長続き/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('相互尊敬を服従や競争心の低さと混同しない', () => {
  const profile = (value: number, confidence = 0.6): CompatibilityProfileScore => ({
    key: 'admiration_mutual', value, confidence, contributingFacts: ['jupiter-sun'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '惹かれ合う理由')
  const middle = compatibilityProfileBlock(profile(0.5), '惹かれ合う理由')
  const high = compatibilityProfileBlock(profile(0.8), '惹かれ合う理由')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /尊敬することと相手の意見に従うことは分けて/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず従える|競争しない/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('プライド衝突を喧嘩全般や破局判定と混同しない', () => {
  const profile = (value: number, confidence = 0.7): CompatibilityProfileScore => ({
    key: 'pride_collision', value, confidence, contributingFacts: ['sun-mars-square'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '衝突の扱い')
  const middle = compatibilityProfileBlock(profile(0.5), '衝突の扱い')
  const high = compatibilityProfileBlock(profile(0.8), '衝突の扱い')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /何を尊重してほしかったか/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず別れる|相性が悪い/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('競争心を尊敬や共同作業の不成立と混同しない', () => {
  const profile = (value: number, confidence = 0.7): CompatibilityProfileScore => ({
    key: 'ego_competition', value, confidence, contributingFacts: ['self-pride', 'partner-pride'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の目標')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の目標')
  const high = compatibilityProfileBlock(profile(0.8), '二人の目標')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /相手の力を認めるほど/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /尊敬できない|協力できない|相性が悪い/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('衝突頻度だけで不仲や破局を断定しない', () => {
  const profile = (value: number, confidence = 0.7): CompatibilityProfileScore => ({
    key: 'conflict_frequency', value, confidence, contributingFacts: ['sun-mars-square'],
  })
  const low = compatibilityProfileBlock(profile(0.2), 'すれ違う場面')
  const middle = compatibilityProfileBlock(profile(0.5), 'すれ違う場面')
  const high = compatibilityProfileBlock(profile(0.8), 'すれ違う場面')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /回数だけで関係の良し悪しを決めず/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず別れる|不仲|相性が悪い/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('目標志向の一致を進路の一致や恋愛の保証と混同しない', () => {
  const profile = (value: number, confidence = 0.7): CompatibilityProfileScore => ({
    key: 'ambition_alignment', value, confidence, contributingFacts: ['self-career', 'partner-career'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の目標')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の目標')
  const high = compatibilityProfileBlock(profile(0.8), '二人の目標')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /目指す先が同じとは決めず/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず成功|恋愛も順調|同じ進路/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('生活リズムを家事分担や感情の深さと混同しない', () => {
  const profile = (value: number, confidence = 0.7): CompatibilityProfileScore => ({
    key: 'lifestyle_alignment', value, confidence, contributingFacts: ['moon-moon'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の暮らし')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の暮らし')
  const high = compatibilityProfileBlock(profile(0.8), '二人の暮らし')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /家事や役割の一致とは決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず同棲できる|愛情が深い|家事が得意/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('共有自己感を運命や継続保証と混同しない', () => {
  const profile = (value: number, confidence = 0.6): CompatibilityProfileScore => ({
    key: 'shared_identity', value, confidence, contributingFacts: ['sun-moon'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の本質')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の本質')
  const high = compatibilityProfileBlock(profile(0.8), '二人の本質')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /運命や関係の継続保証とは決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /運命の相手|必ず続く|別れられない/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('チーム感を恋愛の深さや常時一緒に動くことと混同しない', () => {
  const profile = (value: number, confidence = 0.6): CompatibilityProfileScore => ({
    key: 'partnership_team_feeling', value, confidence, contributingFacts: ['project', 'ambition'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人だからできること')
  const middle = compatibilityProfileBlock(profile(0.5), '二人だからできること')
  const high = compatibilityProfileBlock(profile(0.8), '二人だからできること')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /恋愛の深さとは決めない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /いつも一緒|必ず成功|運命共同体/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('人生の一部として残る感覚を運命や将来保証へ変換しない', () => {
  const profile = (value: number, confidence = 0.55): CompatibilityProfileScore => ({
    key: 'fate_companion_feeling', value, confidence, contributingFacts: ['identity', 'team'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の本質')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の本質')
  const high = compatibilityProfileBlock(profile(0.8), '二人の本質')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /運命の相手や将来の継続を断定しない/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず結ばれる|前世|別れられない/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('刺激必要度を愛情不足や停滞の断定へ変換しない', () => {
  const profile = (value: number, confidence = 0.55): CompatibilityProfileScore => ({
    key: 'relationship_stimulation_need', value, confidence, contributingFacts: ['novelty', 'growth'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '関係が育つ力')
  const middle = compatibilityProfileBlock(profile(0.5), '関係が育つ力')
  const high = compatibilityProfileBlock(profile(0.8), '関係が育つ力')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /刺激の不足を愛情の不足と決めず/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず飽きる|愛情がない|別れる/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('マンネリ化リスクを破局や愛情消失の予測へ変換しない', () => {
  const profile = (value: number, confidence = 0.55): CompatibilityProfileScore => ({
    key: 'relationship_boredom_risk', value, confidence, contributingFacts: ['novelty', 'stimulation'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '関係が育つ力')
  const middle = compatibilityProfileBlock(profile(0.5), '関係が育つ力')
  const high = compatibilityProfileBlock(profile(0.8), '関係が育つ力')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /破局の兆しと決めず/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず別れる|愛情が消える|浮気する/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('信頼安定性を秘密や裏切りの有無の予測へ変換しない', () => {
  const profile = (value: number, confidence = 0.55): CompatibilityProfileScore => ({
    key: 'trust_stability', value, confidence, contributingFacts: ['reliability', 'safety', 'repair'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '見落としやすい違い')
  const middle = compatibilityProfileBlock(profile(0.5), '見落としやすい違い')
  const high = compatibilityProfileBlock(profile(0.8), '見落としやすい違い')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /秘密や裏切りがないとは予測できません/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /浮気しない|裏切る人|必ず続く/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('長期結合を将来保証や交際期間の逆算へ変換しない', () => {
  const profile = (value: number, confidence = 0.5): CompatibilityProfileScore => ({
    key: 'long_term_binding', value, confidence, contributingFacts: ['safety', 'domestic', 'repair'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '二人の暮らし')
  const middle = compatibilityProfileBlock(profile(0.5), '二人の暮らし')
  const high = compatibilityProfileBlock(profile(0.8), '二人の暮らし')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /将来を保証しません/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /必ず続く|結婚できる|長く付き合ったから/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('透明性を対称な開示量や秘密の有無へ変換しない', () => {
  const profile = (value: number, confidence = 0.65): CompatibilityProfileScore => ({
    key: 'transparency', value, confidence, contributingFacts: ['self', 'partner'],
    directions: { selfToPartner: 0.8, partnerToSelf: 0.3 },
  })
  const low = compatibilityProfileBlock(profile(0.2), '見落としやすい違い')
  const middle = compatibilityProfileBlock(profile(0.5), '見落としやすい違い')
  const high = compatibilityProfileBlock(profile(0.8), '見落としやすい違い')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /二方向で異なる/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /隠し事がない|同じだけ話す|嘘をつく/)
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

test('依存強度を幸福・安心・関係継続の証明へ変換しない', () => {
  const profile = (value: number, confidence = 0.5): CompatibilityProfileScore => ({
    key: 'dependency_intensity', value, confidence, contributingFacts: ['moon-pluto'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '見落としやすい違い')
  const middle = compatibilityProfileBlock(profile(0.5), '見落としやすい違い')
  const high = compatibilityProfileBlock(profile(0.8), '見落としやすい違い')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /安心や幸福の証明にはせず/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /運命の相手|必ず続く|別れられない/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
})

test('力関係の高値を良好な均衡や優劣へ変換しない', () => {
  const profile = (value: number, confidence = 0.8): CompatibilityProfileScore => ({
    key: 'power_balance', value, confidence, contributingFacts: ['self', 'partner'],
  })
  const low = compatibilityProfileBlock(profile(0.2), '衝突の扱い')
  const middle = compatibilityProfileBlock(profile(0.5), '衝突の扱い')
  const high = compatibilityProfileBlock(profile(0.8), '衝突の扱い')
  assert.deepEqual([low?.band, middle?.band, high?.band], ['low', 'middle', 'high'])
  assert.equal(new Set([low?.text, middle?.text, high?.text]).size, 3)
  assert.match(high?.text ?? '', /拮抗しやすい/)
  assert.doesNotMatch([low?.text, middle?.text, high?.text].join(''), /相性が良い|上の立場|下の立場|支配される/)
  assert.ok([low, middle, high].every(block => block && [...block.text].length <= 120))
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
