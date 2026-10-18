import type { TimingEvidenceBirthInput } from '../lib/report/timingEvidencePipeline.js'
import { buildEventPatternStudy, type EventStudyWindow } from './eventPatternStudy.js'
import type { EventFact } from './eventPatternRules.js'
import { supplementalSanmeiFacts } from './cohortSupplementalFacts.js'
import { candidateFeatures, matchCandidate } from './cohortPatternCandidates.js'

/** Six reviewed proposals from the existing cohort catalog, not six proven event predictors. */
export const CELEBRITY_READING_CANDIDATES = [
  {
    id: 'C01', allOf: ['vedic:minor-lord-house:7', 'ziwei:life:財帛'],
    title: '結婚・関係の具体化と、生活条件の調整',
    eventCandidates: ['結婚', '再婚', '離婚'],
    body: '二人の関係を、暮らしやお金の条件まで含めて具体的に考える時期の候補です。将来の約束を進めることと、続ける条件を見直すことの両方を検証します。',
    unresolved: '結婚と離婚を分ける条件は未確定。婚姻の成立は判定しない。',
    birthTimeRequired: true, stableVedicHousesRequired: true,
  },
  {
    id: 'C02', allOf: ['calendar:month:冲', 'vedic:minor-lord-house:8'],
    title: '近い関係や生活の形が切り替わる',
    eventCandidates: ['結婚', '再婚', '離婚'],
    body: '近い人との関係が、今までの生活の形に収まらなくなり、付き合い方を変える時期の候補です。関係を進める方向と、距離を変える方向を分けて検証します。',
    unresolved: '日支の冲を破局専用にしない。同居・初交際はこの標本で識別していない。',
    birthTimeRequired: true, stableVedicHousesRequired: true,
  },
  {
    id: 'C03', allOf: ['sanmei:month:chusatsu', 'vedic:minor-lord-house:12'],
    title: '関係と暮らしの前提を組み直す',
    eventCandidates: ['結婚', '再婚', '離婚'],
    body: 'これまでの関係や暮らしの前提を見直し、続けるものと変えるものを選び直す時期の候補です。新しい関係を生活に迎える場合と、続いていた関係を整理する場合の両方を検証します。',
    unresolved: '結末の方向と心理状態は未確定。天中殺・第12室から不幸を判定しない。',
    birthTimeRequired: true, stableVedicHousesRequired: true,
  },
  {
    id: 'C04', allOf: ['vedic:minor-lord-house:12', 'ziwei:life:財帛'],
    title: '別離・関係再編と、生活条件の見直し',
    eventCandidates: ['離婚', '結婚', '再婚'],
    body: '人との関係を見直すことが、生活の分担やお金の条件にも関わる時期の候補です。関係に区切りをつける場合だけでなく、関係を進めるために条件を変える場合も検証します。',
    unresolved: '離婚記録があっても発生確率は未算出。別離に限定しない。',
    birthTimeRequired: true, stableVedicHousesRequired: true,
  },
  {
    id: 'C05', allOf: ['western:土星:金星:90'],
    title: '恋愛の約束・責任・距離を確かめる',
    eventCandidates: ['結婚', '破局', '離婚'],
    body: '好きという気持ちに加えて、約束や負担を現実的に確かめる時期の候補です。将来を決めることにも、関わり方に区切りをつけることにも対応するかを検証します。',
    unresolved: '旧P02の具体的な90度条件。土星と金星だけで結婚・別れの方向を決めない。',
    birthTimeRequired: false, stableVedicHousesRequired: false,
  },
  {
    id: 'C06', allOf: ['western:冥王星:金星:120', 'ziwei:life:僕役'],
    title: '人とのつながりと、関係の進展',
    eventCandidates: ['結婚'],
    body: '人とのつながりの中で、近い関係を深めていく時期の候補です。結婚記録との対応はありますが、紹介・友人からの発展といった出会い方は、追加の事実がないため判定していません。',
    unresolved: '結婚の2人のみの探索候補。別離の反例が見つからないことを、反例がない証明にしない。',
    birthTimeRequired: true, stableVedicHousesRequired: false,
  },
] as const

export interface CelebrityCandidateContext {
  birthTimeKnown: boolean
  stableVedicHouses: boolean
  /** Separate supplied time from verified source. It never changes the number of supporting examples. */
  birthSourceVerified: boolean
}

/** Output hypotheses only. Event labels, people and saved narratives are never inputs. */
export function evaluateCelebrityReadingCandidates(facts: readonly EventFact[], context: CelebrityCandidateContext) {
  const features = candidateFeatures(facts)
  return CELEBRITY_READING_CANDIDATES.flatMap(rule => {
    if (rule.birthTimeRequired && !context.birthTimeKnown) return []
    if (rule.stableVedicHousesRequired && !context.stableVedicHouses) return []
    const days = matchCandidate({ allOf: [...rule.allOf] }, facts)
    if (!days.length) return []
    const evidence = rule.allOf.map(key => ({ key, label: features.find(f => f.key === key)!.label,
      days: [...new Set(features.filter(f => f.key === key).flatMap(f => f.days))].filter(d => days.includes(d)).sort() }))
    return [{ ...rule, evidence, days, version: 'celebrity-reading-candidates-v1',
      eventCandidatesMeaning: 'observed_categories_to_test_not_predicted_outcomes',
      outcome: 'undetermined', probability: null, directionResolved: false,
      birthSourceVerified: context.birthSourceVerified,
      productionEligible: false, trainingEligible: false, qualityEligible: false }]
  })
}

/** Standalone research entry point; production routes do not import it. */
export function buildCelebrityReadingPreview(birth: TimingEvidenceBirthInput, window: EventStudyWindow) {
  const study = buildEventPatternStudy(birth, window)
  const facts = [...study.facts, ...supplementalSanmeiFacts(birth, window)]
  return { input: study.input, window: study.window, conditions: study.conditions,
    candidates: evaluateCelebrityReadingCandidates(facts, { birthTimeKnown: birth.birthHour !== undefined,
      stableVedicHouses: study.housesStable, birthSourceVerified: false }),
    productionEligible: false }
}
