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
]
