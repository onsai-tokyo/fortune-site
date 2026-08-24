import type { PairTraitScore } from './derivedTraitScores.js'

type ScoreBand = 'low' | 'middle' | 'high'

export interface CompatibilityScoreBlock {
  scoreKey: PairTraitScore['key']
  band: ScoreBand
  text: string
  source: string
}

function band(value: number): ScoreBand {
  if (value >= 0.6) return 'high'
  if (value <= 0.4) return 'low'
  return 'middle'
}

const textByScore: Record<PairTraitScore['key'], Record<ScoreBand, (cue: string) => string>> = {
  compatibility_transparency: {
    high: cue => `${cue}では、言葉になる前の変化にも互いが気づきやすい二人です。気づいたことを確認できると、理解が信頼へ変わります。`,
    middle: cue => `${cue}では、察し合える時と説明が必要な時があります。小さな違和感ほど言葉にすると、思い込みを残しません。`,
    low: cue => `${cue}では、相手も同じように感じているという前提を置かないこと。事実と気持ちを分けて伝えるほど、誤解が減ります。`,
  },
  compatibility_independence: {
    high: cue => `${cue}では、一人で整える時間の感覚が近い二人です。離れている時間を拒絶と受け取らないことが、親しさを守ります。`,
    middle: cue => `${cue}では、一人でいたい時機をその都度確かめる必要があります。近さと自由を交互に選べる関係です。`,
    low: cue => `${cue}では、一人で整える時間の必要量が違います。距離を愛情の不足と決めず、戻る時刻まで約束してください。`,
  },
  compatibility_lifestyle: {
    high: cue => `${cue}では、日々の速度や休み方を揃えやすい二人です。小さな習慣を共有するほど、関係が自然に安定します。`,
    middle: cue => `${cue}では、合う習慣と別々にした方がよい習慣が混ざります。全部を揃えず、暮らしの要所だけ決めてください。`,
    low: cue => `${cue}では、生活の速度や休み方に差が出やすい二人です。正しさを競わず、互いの回復時間を先に確保してください。`,
  },
  compatibility_value_match: {
    high: cue => `${cue}では、大切にしたい基準を共有しやすい二人です。似ているからこそ、変化した考えを定期的に言い直してください。`,
    middle: cue => `${cue}では、重なる価値観と譲れない違いが同時にあります。何を揃え、何を別々に持つかを決めると安定します。`,
    low: cue => `${cue}では、同じ出来事にも異なる意味を置きやすい二人です。結論より先に、なぜ大切なのかを交換してください。`,
  },
}

/** 相性§41・§52・§53。確信度不足では一般論を生成せずnullへ戻す。 */
export function compatibilityScoreBlock(score: PairTraitScore | undefined, cue: string): CompatibilityScoreBlock | null {
  if (!score || score.confidence < 0.25) return null
  const scoreBand = band(score.value)
  return { scoreKey: score.key, band: scoreBand, text: textByScore[score.key][scoreBand](cue), source: '相性§41・§52・§53' }
}
