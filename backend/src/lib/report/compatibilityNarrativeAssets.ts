import type { PairTraitScore } from './derivedTraitScores.js'
import type { CompatibilityProfileScore } from './synastryFacts.js'

type ScoreBand = 'low' | 'middle' | 'high'

export interface CompatibilityScoreBlock {
  scoreKey: PairTraitScore['key'] | CompatibilityProfileScore['key']
  band: ScoreBand
  text: string
  source: string
}

const conversationalFlowText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、互いの話を受け取り、次の話題へつなぎやすい二人です。ただし、話が弾むことと心の奥まで分かることは別に確かめてください。`,
  middle: cue => `${cue}では、話題によって会話の自然さが変わります。分かりやすい話だけでなく、答えにくい気持ちにも時間を取ってください。`,
  low: cue => `${cue}では、考えを組み立てる順序に差が出やすい二人です。返事の速さを理解の深さと決めず、言い直せる余白を作ってください。`,
}

const emotionalIntimacyText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、相手の気持ちの変化を深く受け取りやすい二人です。ただし、強く感じ取れることと安心して頼れることは別に育ててください。`,
  middle: cue => `${cue}では、自然に分かる気持ちと、言葉にしないと届かない気持ちがあります。察したことを確認へ変えるほど親密さが育ちます。`,
  low: cue => `${cue}では、同じ出来事でも心に残る部分が違いやすい二人です。分かり合えないと決めず、何が痛かったかを一つずつ伝えてください。`,
}

const repairCapacityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、すれ違っても関係を終わりと決めず、戻るきっかけを見つけやすい二人です。謝り方を決めておくと、その力が安定します。`,
  middle: cue => `${cue}では、戻れる時と気持ちを残す時があります。話す前に時間を置くのか、その日のうちに確認するのかを決めてください。`,
  low: cue => `${cue}では、同じ方法で仲直りしようとすると片方が置き去りになりやすい二人です。謝罪、説明、時間のどれが必要かを先に尋ねてください。`,
}

const emotionalSafetyText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、揺れた気持ちを見せても関係がすぐ壊れるとは感じにくい二人です。それでも、沈黙を了承と決めず確認を続けてください。`,
  middle: cue => `${cue}では、安心して話せる場面と身を守りたくなる場面が分かれます。難しい話ほど、時間と場所を先に選んでください。`,
  low: cue => `${cue}では、気持ちを見せた時の反応に敏感になりやすい二人です。正しさより先に、否定せず最後まで聞く約束を作ってください。`,
}

const growthCompatibilityText: Record<ScoreBand, (cue: string) => string> = {
  high: cue => `${cue}では、一緒に新しい目標へ向かう時ほど関係が生き生きしやすい二人です。挑戦の大きさより、互いの前進を認めてください。`,
  middle: cue => `${cue}では、同じ目標が力になる時と、別々に進む方がよい時があります。応援と同行のどちらが必要か確かめてください。`,
  low: cue => `${cue}では、成長したい方向や速度が違いやすい二人です。同じ歩幅を求めず、相手の変化を関係への拒絶と決めないでください。`,
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

/** 相性§43・§44・§53。話しやすさ／感情の深さ／安心感を混同しない。 */
export function compatibilityProfileBlock(score: CompatibilityProfileScore | undefined, cue: string): CompatibilityScoreBlock | null {
  if (!score || score.confidence < 0.25) return null
  const scoreBand = band(score.value)
  const texts = score.key === 'conversational_flow' ? conversationalFlowText
    : score.key === 'emotional_intimacy' ? emotionalIntimacyText
    : score.key === 'repair_capacity' ? repairCapacityText
    : score.key === 'emotional_safety' ? emotionalSafetyText
    : growthCompatibilityText
  const source = score.key === 'conversational_flow' ? '相性§44・§53'
    : score.key === 'emotional_intimacy' ? '相性§43・§53・§54'
    : score.key === 'repair_capacity' ? '相性§7・§42・§53'
    : score.key === 'emotional_safety' ? '相性§7・§34・§42・§54'
    : '相性§45・§53・§54'
  return { scoreKey: score.key, band: scoreBand, text: texts[scoreBand](cue), source }
}

/** 相性§7・§42。衝突強度だけで関係の良否を決めず、修復力と安心感を併記する。 */
export function relationshipTensionBlock(
  conflict: CompatibilityProfileScore | undefined,
  repair: CompatibilityProfileScore | undefined,
  safety: CompatibilityProfileScore | undefined,
  cue: string,
): CompatibilityScoreBlock | null {
  if (!conflict || conflict.key !== 'conflict_intensity' || conflict.confidence < 0.25) return null
  const conflictBand = band(conflict.value)
  const repairAvailable = repair?.key === 'repair_capacity' && repair.confidence >= 0.25
  const safetyAvailable = safety?.key === 'emotional_safety' && safety.confidence >= 0.25
  const returnStrength = Math.max(repairAvailable ? repair.value : 0, safetyAvailable ? safety.value : 0)
  const text = conflictBand === 'high' && returnStrength >= 0.6
    ? `${cue}では、反応が強くぶつかっても、関係へ戻る手がかりを見つけやすい二人です。勢いに任せず、仲直りの順序を決めてください。`
    : conflictBand === 'high'
      ? `${cue}では、言葉や行動の反応が強くなりやすい二人です。その場で決着を求めず、落ち着く時刻と話し直す時刻を分けてください。`
      : conflictBand === 'low'
        ? `${cue}では、表立った衝突は起こりにくい二人です。静かであることを納得と決めず、小さな違和感を定期的に確かめてください。`
        : `${cue}では、話題によって反応の強さが変わります。勝ち負けを決める前に、事実と受け取った気持ちを分けてください。`
  return { scoreKey: conflict.key, band: conflictBand, text, source: '相性§7・§42' }
}
