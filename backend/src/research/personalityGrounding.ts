import type { ReportFactV2 } from '../lib/report/factsV2.js'

/** Research-only. No DOB/identity/event input, score tuning, fallback, or production imports. */
export const PERSONALITY_GROUNDING_VERSION = 'personality-grounding-candidate-v1'
type Condition = { label: string; pattern: RegExp }
export interface GroundedPersonalityRule {
  id: string
  chapter: 'core-mind-3' | 'love-pattern'
  title: string
  body: string
  conditions: readonly Condition[]
  sources: readonly string[]
  interpretationNote: string
  counterexample: string
}
const source = (section: number) => `src/lib/report/rules/PERSONALITY_RULES.md#${section}`
const aspect = (a: string, angle: string, b: string): RegExp =>
  new RegExp(`^structuredAspect:(?:${a}:${angle}:${b}|${b}:${angle}:${a}):orb[0-9]+(?:\\.[0-9]+)?$`)

// These are explicit interpretive hypotheses, not measured probabilities. Existing
// calculator aspect/orb decisions are consumed unchanged; no new orb cutoff is added.
export const GROUNDED_PERSONALITY_RULES: readonly GroundedPersonalityRule[] = [
  {
    id: 'pg-vs-sextile', chapter: 'love-pattern',
    title: '好きなことを、続けられる関係の形に育てる',
    body: '気持ちが動いた相手とは、楽しさをその場だけで終わらせず、互いに支えられる形へ育てていく傾向の候補です。「次の予定が決まるだけで安心する」とは限らず、好意と現実的な工夫を結びつける点を読みます。',
    conditions: [{ label: '金星と土星のセクスタイル（60°）', pattern: aspect('金星', 'セクスタイル', '土星') }],
    sources: ['https://www.astrology.com/aspects-transits/venus-sextile-saturn/'],
    interpretationNote: '出生図の好み・価値観と継続的努力の結びつきを、関係づくりに限定して解釈した候補。幸福や長続きの実証ではありません。',
    counterexample: '好きでも継続の工夫には関心が向かず、その時の楽しさだけを優先することが多い。',
  },
  {
    id: 'pg-vs-square', chapter: 'love-pattern',
    title: '親しくなりたい気持ちと、傷つかないための線引き',
    body: '価値観が合う相手との関係を大切にする一方、傷ついた場面では自分を守るために距離を取りやすい、という候補です。関係を築く力がないという意味ではなく、近づく気持ちと身を守る気持ちの両方を読みます。',
    conditions: [{ label: '金星と土星のスクエア（90°）', pattern: aspect('金星', 'スクエア', '土星') }],
    sources: ['https://www.astrology.com/aspects-transits/venus-square-saturn/'],
    interpretationNote: '出生図の価値観・自己防衛という解釈。失恋の発生、時期、相手の行動は導けません。',
    counterexample: '傷ついても距離を取ることは少なく、親しくなる際にも自己防衛をほとんど意識しない。',
  },
  {
    id: 'pg-outgoing-private-moon', chapter: 'core-mind-3',
    title: '外では動けても、落ち着くには静かな時間がいる',
    body: '初対面や外の場では活発に関われても、気持ちを整えるときは落ち着いた環境を選びやすい、という候補です。社交性と回復の仕方を分けて読みます。いつでも一人が好き、という断定はしません。',
    conditions: [
      { label: 'ASCが火または風のサイン', pattern: /^ascendant:(牡羊座|獅子座|射手座|双子座|天秤座|水瓶座):/ },
      { label: '月が水または土のサイン', pattern: /^planet:月:(蟹座|蠍座|魚座|牡牛座|乙女座|山羊座)(:R)?$/ },
    ], sources: [source(1), source(2)],
    interpretationNote: '既存の性格§1に明示されたAND条件。2条件とも同じ西洋出生図由来で、独立した2占術とは数えません。',
    counterexample: '外の場に参加すること自体が苦手、または一人より大勢の刺激の中で回復する。',
  },
  {
    id: 'pg-earth-asc-fire-sun', chapter: 'core-mind-3',
    title: '外ではきちんと、安心できる場ではのびのびと',
    body: '外では手順や周囲への対応を整えつつ、自分らしさは明るく自由に出したい、という候補です。親しい場所では外向けの緊張がほどけやすい、と読みます。だらしなさや勤勉さの優劣を決める条件ではありません。',
    conditions: [
      { label: 'ASCが土のサイン', pattern: /^ascendant:(牡牛座|乙女座|山羊座):/ },
      { label: '太陽が火のサイン', pattern: /^planet:太陽:(牡羊座|獅子座|射手座)(:R)?$/ },
    ], sources: [source(1)], interpretationNote: '既存の性格§1に明示された組み合わせ。同一出生図の2条件です。',
    counterexample: '外でも形式やきちんとした対応を気にせず、親しい場でも緊張の程度が変わらない。',
  },
  {
    id: 'pg-private-fourth', chapter: 'core-mind-3',
    title: '外の評価とは別に、自分の居場所を持つ',
    body: '家や慣れた場所、自分の土台となる人間関係に意識が向きやすい、という候補です。外で活動できるかどうかとは分けて、安心して戻れる場所があるかを読みます。家族仲や実際の生活環境を言い当てる条件ではありません。',
    conditions: [{ label: '太陽が第4室（現行計算のホールサイン方式）', pattern: /^house:4:太陽$/ }],
    sources: [source(1), source(34)], interpretationNote: '第4室の一般的な意味からの研究仮説。出生時刻と出生地に依存します。',
    counterexample: '慣れた場所や居場所への関心が薄く、変化する外部環境だけで十分落ち着ける。',
  },
  {
    id: 'pg-moon-neptune-square', chapter: 'core-mind-3',
    title: '相手の気持ちを読むとき、自分の想像も混ざりやすい',
    body: '周囲の雰囲気に気持ちが動く一方、相手が実際に示した気持ちと、自分が想像した気持ちの区別が難しくなる場面がある、という候補です。「いつも人の気持ちが正しくわかる」とは判定せず、その境目を読みます。',
    conditions: [{ label: '月と海王星のスクエア（90°）', pattern: aspect('月', 'スクエア', '海王星') }],
    sources: [source(17)], interpretationNote: '性格§17の感受性／投影の区別をスクエアに限定した新しい候補。原文に角度の指定はなく、この限定自体も未検証です。',
    counterexample: '相手の明確な言動だけで判断し、場の雰囲気や自分の想像にほぼ左右されない。',
  },
  {
    id: 'pg-venus-jupiter-sextile', chapter: 'love-pattern',
    title: '自分の世界が広がる相手に、気持ちが向く',
    body: '知識や経験に触れ、自分の見方が広がることが恋愛の魅力につながりやすい、という候補です。年収や肩書そのものではなく、一緒にいることで得られる発見を読みます。年上の相手を選ぶとまでは決めません。',
    conditions: [{ label: '金星と木星のセクスタイル（60°）', pattern: aspect('金星', 'セクスタイル', '木星') }],
    sources: [source(7)], interpretationNote: '性格§7の金星・木星の関与をセクスタイルに限定した新しい候補。原文の強い関与をこの角度に限定する妥当性は未検証です。',
    counterexample: '相手の知識や経験に触れても恋愛感情にはつながらず、未知の発見より慣れた価値観だけを重視する。',
  },
  {
    id: 'pg-venus-pluto-square', chapter: 'love-pattern',
    title: '惹かれた相手との関係が、気持ちの大きな比重を占める',
    body: '好きな相手と深くつながりたい気持ちが強まり、関係の動きに意識を奪われやすい、という候補です。気持ちの強さと心地よい距離が両立しているかを読みます。浮気や裏切りが起きるという判定ではありません。',
    conditions: [{ label: '金星と冥王星のスクエア（90°）', pattern: aspect('金星', 'スクエア', '冥王星') }],
    sources: [source(5)], interpretationNote: '性格§5の金星・冥王星の関与をスクエアに限定した新しい候補。外惑星単独では成立しません。角度限定は未検証です。',
    counterexample: '恋愛が深まっても関心の比重や距離感がほとんど変わらず、関係の変動にも影響されにくい。',
  },
]

export const WITHHELD_PERSONALITY_CLAIMS = [
  { claimId: 'cm3-15', reason: '五行の金不足だけから、相手の非の有無・区切りが半年遅れることは導けないため、比較版では採用しません。' },
  { claimId: 'lp-30', reason: '金星と土星の異なる角度を一律に安定と判定できず、次回の予定で安心するという特定行動まで導けないため、比較版では採用しません。' },
] as const

export function evaluateGroundedPersonality(facts: readonly ReportFactV2[], hasBirthTime: boolean) {
  // Never fill absent evidence with a score, an axis, a generation planet or a DOB seed.
  const usable = facts.filter(f => f.system === '西洋占星術' && (hasBirthTime || !f.requiresBirthTime))
    .slice().sort((a, b) => a.factor.localeCompare(b.factor) || a.id.localeCompare(b.id))
  const rules = GROUNDED_PERSONALITY_RULES.map(rule => {
    const conditions = rule.conditions.map(condition => ({
      label: condition.label,
      evidence: usable.filter(f => condition.pattern.test(f.factor))
        .filter((fact, index, all) => all.findIndex(other => other.factor === fact.factor) === index)
        .map(f => ({ id: f.id, factor: f.factor, system: f.system, canonicalSourceId: f.canonicalSourceId })),
    }))
    const matched = conditions.every(condition => condition.evidence.length > 0)
    return { ...rule, conditions, matched, status: 'unvalidated-hypothesis' as const,
      dataNote: hasBirthTime ? '出生時刻あり。現行計算器の配置に基づく候補。' : '出生時刻不明。時刻依存の条件は除外。残るアスペクトは暫定計算で、日内変動の頑健性は未検証。',
      independentSystemCount: matched ? 1 : 0,
    }
  })
  return { version: PERSONALITY_GROUNDING_VERSION, candidates: rules.filter(r => r.matched),
    audit: rules, withheldLegacyClaims: WITHHELD_PERSONALITY_CLAIMS,
    validation: { outcomeAccuracy: null, deployment: 'research-only' as const } }
}
