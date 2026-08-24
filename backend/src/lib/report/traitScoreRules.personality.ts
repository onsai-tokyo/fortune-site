import type { TraitScoreRule } from './traitScores.js'

/**
 * PR-2c confirmed subset.
 *
 * Only rules quoted explicitly in the reviewed PR-2 design are included here.
 * Do not infer the remaining personality rules: add them only after the complete
 * PERSONALITY_RULES.md source has been committed and its section is reviewable.
 */
export const CONFIRMED_PERSONALITY_SCORE_RULES: readonly TraitScoreRule[] = [
  { score: 'private_introversion', source: '性格§2', match: { system: ['西洋占星術'], factorPrefix: ['planet:月:蟹座', 'planet:月:蠍座', 'planet:月:魚座'] }, weight: 0.9 },
  { score: 'private_introversion', source: '性格§2', match: { system: ['西洋占星術'], factorPrefix: ['planet:月:牡牛座', 'planet:月:乙女座', 'planet:月:山羊座'] }, weight: 0.6 },
  { score: 'private_introversion', source: '性格§2', match: { system: ['西洋占星術'], factorPrefix: ['house:4:', 'house:8:', 'house:12:'] }, weight: 0.5 },
  { score: 'private_introversion', source: '性格§2', match: { system: ['西洋占星術'], factorPrefix: ['planet:冥王星'], axis: ['shadow'] }, weight: 0.3 },

  { score: 'social_extraversion', source: '性格§1', match: { factorPrefix: ['ascendant:牡羊座', 'ascendant:獅子座', 'ascendant:射手座', 'ascendant:双子座', 'ascendant:天秤座', 'ascendant:水瓶座'] }, weight: 1 },
  { score: 'social_extraversion', source: '性格§1', match: { factorPrefix: ['planet:太陽:牡羊座', 'planet:太陽:獅子座', 'planet:太陽:射手座'] }, weight: 0.7 },
  { score: 'social_extraversion', source: '性格§1', match: { factorPrefix: ['elementDominant:fire', 'elementDominant:air'] }, weight: 0.5 },

  { score: 'attraction_respect', source: '性格§7', match: { factorPrefix: ['structuredAspect:金星:', 'structuredAspect:月:'], signal: ['responsibility'] }, weight: 0.8 },
  { score: 'attraction_respect', source: '性格§7', match: { factorPrefix: ['house:10:金星', 'house:10:月'] }, weight: 0.9 },
  { score: 'attraction_status', source: '性格§7', match: { factorPrefix: ['house:10:金星'] }, weight: 1 },
  { score: 'attraction_status', source: '性格§8', match: { factorPrefix: ['structuredAspect:金星:コンジャンクション:木星', 'structuredAspect:木星:コンジャンクション:金星'] }, weight: 0.7 },

  // §3: 8室・蠍座・火星/冥王星・固定宮は「一つを深く追う」共通の入力になる。
  { score: 'immersion_intensity', source: '性格§3', match: { factorPrefix: ['house:8:'] }, weight: 0.9 },
  { score: 'immersion_intensity', source: '性格§3', match: { factorPrefix: ['planet:太陽:蠍座', 'planet:月:蠍座', 'planet:水星:蠍座', 'planet:金星:蠍座', 'planet:火星:蠍座'] }, weight: 0.7 },
  { score: 'immersion_intensity', source: '性格§3', match: { factorPrefix: ['planet:火星:', 'planet:冥王星:'] }, weight: 0.3 },
  { score: 'immersion_intensity', source: '性格§3', match: { factorPrefix: ['modalityDominant:fixed:'] }, weight: 0.6 },

  // §14: Pride Sensitivityは自己肯定感ではなく、能力・実績への評価に対する敏感さ。
  { score: 'pride_sensitivity', source: '性格§14', match: { factorPrefix: ['planet:太陽:獅子座', 'house:10:太陽', 'midheaven:獅子座'] }, weight: 0.9 },
  { score: 'pride_sensitivity', source: '性格§14', match: { factorPrefix: ['house:10:月'] }, weight: 0.8 },
  { score: 'social_neutrality', source: '性格§14', match: { factorPrefix: ['elementDominant:air:'] }, weight: 0.6 },
  { score: 'neutrality_pride', source: '性格§14', match: { factorPrefix: ['planet:太陽:山羊座', 'planet:土星:山羊座', 'elementDominant:air:'] }, weight: 0.5 },

  // §16: 公的な気遣い。親しい場での自己主張はスコア間条件なのでここでは捏造しない。
  { score: 'social_sensitivity', source: '性格§16', match: { factorPrefix: ['planet:月:蟹座', 'planet:月:蠍座', 'planet:月:魚座', 'planet:月:天秤座', 'planet:月:乙女座'] }, weight: 0.8 },
  { score: 'social_sensitivity', source: '性格§16', match: { factorPrefix: ['elementDominant:water:', 'house:7:月'] }, weight: 0.6 },
  { score: 'public_agreeableness', source: '性格§16', match: { factorPrefix: ['planet:月:天秤座', 'planet:月:乙女座', 'house:7:月'] }, weight: 0.7 },

  // §24: 強い太陽–月、月–火星/天王星/冥王星と、水・柔軟宮の受容性を分けて保持する。
  { score: 'emotional_volatility', source: '性格§24', match: { factorPrefix: ['structuredAspect:太陽:スクエア:月', 'structuredAspect:月:スクエア:太陽', 'structuredAspect:太陽:オポジション:月', 'structuredAspect:月:オポジション:太陽'] }, weight: 1 },
  { score: 'emotional_volatility', source: '性格§24', match: { factorPrefix: ['structuredAspect:月:', 'structuredAspect:火星:', 'structuredAspect:天王星:', 'structuredAspect:冥王星:'], axis: ['shadow'] }, weight: 0.8 },
  { score: 'emotional_volatility', source: '性格§24', match: { factorPrefix: ['elementDominant:water:', 'modalityDominant:mutable:'] }, weight: 0.5 },

  // §4: 仕事領域へ没頭要素が入る場合。時期の活性度はここへ混ぜない。
  { score: 'career_absorption', source: '性格§4', match: { factorPrefix: ['house:10:火星', 'house:10:土星', 'house:10:冥王星'] }, weight: 0.9 },
  { score: 'career_absorption', source: '性格§4', match: { factorPrefix: ['midheaven:山羊座', 'midheaven:蠍座'] }, weight: 0.7 },

  // §5: 恋愛領域の金星・火星・冥王星と強い接触を、仕事没頭とは別に保持する。
  { score: 'romantic_absorption', source: '性格§5', match: { factorPrefix: ['house:5:金星', 'house:5:火星', 'house:7:金星', 'house:7:火星', 'house:8:金星', 'house:8:火星'] }, weight: 0.8 },
  { score: 'romantic_absorption', source: '性格§5', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '冥王星'] }, weight: 0.8 },
  { score: 'attraction_intensity', source: '性格§5', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '冥王星'] }, weight: 0.9 },

  // §6: 「好かれること」と社会的魅力を混同せず、月・金星が評価領域にある時だけ加点する。
  { score: 'approval_need', source: '性格§6', match: { factorPrefix: ['house:10:月', 'house:10:金星'] }, weight: 0.8 },

  // §9: 強い引力・新奇性。外惑星単独ではなく必ず金星または火星との接触を要求する。
  { score: 'charisma_attraction', source: '性格§9', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '冥王星'] }, weight: 0.8 },
  { score: 'attraction_charisma', source: '性格§9', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '冥王星'] }, weight: 0.8 },
  { score: 'novelty_attraction', source: '性格§9', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '天王星'] }, weight: 0.8 },
  { score: 'attraction_novelty', source: '性格§9', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '天王星'] }, weight: 0.8 },

  // §10: 引力とは独立した「続けやすさ」。土星・4室・7室の生活/継続Factだけを使う。
  { score: 'compatibility_stability', source: '性格§10', match: { factorPrefix: ['structuredAspect:'], factorIncludesAll: ['金星', '土星'] }, weight: 0.8 },
  { score: 'compatibility_reliability', source: '性格§10', match: { factorPrefix: ['house:7:土星', 'house:4:土星'] }, weight: 0.8 },
  { score: 'compatibility_domestic', source: '性格§10', match: { factorPrefix: ['house:4:月', 'house:4:金星'] }, weight: 0.8 },
]
