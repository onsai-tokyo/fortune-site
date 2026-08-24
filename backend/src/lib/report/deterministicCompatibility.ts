import type { ReportCard, ReportCardPage, StructuredReport } from '../reportCards.js'
import type { ReportInput } from '../deterministicReport.js'
import { extractReportMetadata } from './metadata.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'
import { buildSynastryFacts, computeCompatibilityProfile, computeRelationScores, type CompatibilityProfileScore, type RelationAxis, type RelationScore } from './synastryFacts.js'
import { buildReportFactsV2 } from './factsV2.js'
import { ALL_TRAIT_SCORE_KEYS, computeTraitScores, TRAIT_SCORE_RULES, type TraitScoreSet } from './traitScores.js'
import { bootstrapTraitScoreScale } from './traitScoreScale.js'
import { computePairTraitScores, type PairTraitScore } from './derivedTraitScores.js'
import { compatibilityProfileBlock, compatibilityScoreBlock } from './compatibilityNarrativeAssets.js'

type RelationshipType = 'romantic' | 'friend' | 'family'
type PairKind = 'aligned' | 'complementary' | 'clashing'
type JsonRecord = Record<string, unknown>

interface PairContext {
  relationshipLabel: string
  relationshipType: RelationshipType
  selfStyle: string
  partnerStyle: string
  kind: PairKind
  shared: string
  difference: string
  evidence: ReportCard['evidence']
  strongestAxis: RelationAxis
  relationScores: RelationScore[]
  pairTraitScores: PairTraitScore[]
  compatibilityProfile: CompatibilityProfileScore[]
}

export interface CompatibilityTraitScoreBundle {
  self: TraitScoreSet
  partner: TraitScoreSet
  pair: PairTraitScore[]
  profile: CompatibilityProfileScore[]
}

/** 生年月日などの入力はここでのみ読み、相性レポートへは集計済みスコアだけを渡す。 */
export function buildCompatibilityTraitScoreBundle(self: ReportInput, partner: ReportInput): CompatibilityTraitScoreBundle {
  const scale = bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS)
  const selfScores = computeTraitScores(buildReportFactsV2(self, extractReportMetadata(self)), TRAIT_SCORE_RULES, scale)
  const partnerScores = computeTraitScores(buildReportFactsV2(partner, extractReportMetadata(partner)), TRAIT_SCORE_RULES, scale)
  const synastry = buildSynastryFacts(self, partner)
  const relations = computeRelationScores(synastry)
  return {
    self: selfScores,
    partner: partnerScores,
    pair: computePairTraitScores(selfScores, partnerScores, relations),
    profile: computeCompatibilityProfile(synastry, { self: Boolean(self.birthTime), partner: Boolean(partner.birthTime) }),
  }
}

const stemStyle: Record<string, string> = {
  甲: '先に動いて道を作ること', 乙: '時間をかけて関係を育てること', 丙: '気持ちを外へ表すこと', 丁: '小さな変化を丁寧に読むこと', 戊: '変化の中でも土台を守ること',
  己: '相手に合わせて形を整えること', 庚: '必要な答えをはっきり決めること', 辛: '違和感を見分けて選び直すこと', 壬: '離れたものを柔軟につなぐこと', 癸: '言葉になる前の気配を受け取ること',
}

function record(value: unknown): JsonRecord { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {} }
function text(value: unknown) { return typeof value === 'string' ? value : '' }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }

function relationshipFrame(label: string) {
  if (label === '片思い') return 'まだ関係を決める前だからこそ、相手の反応を急いで答えにしないこと'
  if (label === '復縁希望' || label === '元恋人') return '過去を戻すのではなく、以前と違う約束を作れるか確かめること'
  if (label === '夫婦' || label === '婚約中') return '気持ちと暮らしの条件を同じ言葉で確かめ続けること'
  if (label === 'お付き合い中') return '近さに甘えず、変わった気持ちを言い直せること'
  if (label === '家族' || label === '親' || label === '子' || label === '兄弟姉妹' || label === '配偶者の家族') return '役割を当然と思わず、いま必要な距離を話し直すこと'
  return '親しさだけに頼らず、互いが守りたい境界を確かめること'
}

function pairContext(selfValue: unknown, partnerValue: unknown, relationshipType: RelationshipType, relationshipLabel: string, scoreBundle?: CompatibilityTraitScoreBundle): PairContext {
  const self = record(selfValue); const partner = record(partnerValue)
  const selfDay = text(self.shichuDay); const partnerDay = text(partner.shichuDay)
  const selfStyle = stemStyle[selfDay[0]] ?? '自分の順序で答えを選ぶこと'
  const partnerStyle = stemStyle[partnerDay[0]] ?? '納得できる条件を確かめること'
  const selfNumber = number(self.lifePathNumber); const partnerNumber = number(partner.lifePathNumber)
  const sameStem = Boolean(selfDay && partnerDay && selfDay[0] === partnerDay[0])
  const sameNumberRhythm = selfNumber > 0 && partnerNumber > 0 && selfNumber % 3 === partnerNumber % 3
  const kind: PairKind = sameStem ? 'aligned' : sameNumberRhythm ? 'complementary' : 'clashing'
  const synastry = buildSynastryFacts(selfValue, partnerValue)
  const relationScores = computeRelationScores(synastry)
  const strongestAxis = relationScores.filter(item => item.confidence > 0).sort((a, b) => b.value * b.confidence - a.value * a.confidence || a.key.localeCompare(b.key))[0]?.key ?? 'communication'
  return {
    relationshipLabel, relationshipType, selfStyle, partnerStyle, kind,
    shared: sameStem ? '判断の入口が似ていること' : sameNumberRhythm ? '動き出す時のリズムが近いこと' : '大切な相手ほど真剣に向き合うこと',
    difference: selfStyle === partnerStyle ? '同じ結論でも伝える時機が違うこと' : `${selfStyle}と${partnerStyle}の違い`,
    evidence: [
      { family: '本人の命式', system: '複数占術の統合', detail: `day=${selfDay}; lifePath=${selfNumber}; sukuyo=${text(self.sukuyo)}` },
      { family: '相手の命式', system: '複数占術の統合', detail: `day=${partnerDay}; lifePath=${partnerNumber}; sukuyo=${text(partner.sukuyo)}` },
      ...synastry.slice(0, 8).map(fact => ({ family: '二人の照合', system: fact.kind, detail: `${fact.axis}:${fact.detail}` })),
    ],
    strongestAxis, relationScores, pairTraitScores: scoreBundle?.pair ?? [], compatibilityProfile: scoreBundle?.profile ?? [],
  }
}

const chapterAxes: Record<string, readonly RelationAxis[]> = {
  'compat-overview': ['values', 'communication', 'safety', 'growth'],
  'compat-beginning': ['attraction', 'communication', 'fun', 'safety'],
  'compat-attraction': ['attraction', 'binding', 'depth', 'fun'],
  'compat-caution': ['conflict', 'values', 'communication', 'depth'],
  'compat-friction': ['conflict', 'communication', 'values', 'growth'],
  'compat-repair': ['repair', 'safety', 'communication', 'depth'],
  'compat-growth': ['growth', 'values', 'repair', 'fun'],
  'compat-marriage': ['domestic', 'binding', 'safety', 'values'],
}

const pairScoreAxes: Record<PairTraitScore['key'], readonly RelationAxis[]> = {
  compatibility_transparency: ['communication', 'safety', 'repair'],
  compatibility_independence: ['domestic', 'safety'],
  compatibility_lifestyle: ['domestic', 'fun'],
  compatibility_value_match: ['values', 'growth'],
}

const chapterPairScores: Record<string, readonly PairTraitScore['key'][]> = {
  'compat-overview': ['compatibility_value_match', 'compatibility_lifestyle'],
  'compat-beginning': ['compatibility_transparency'],
  'compat-attraction': ['compatibility_lifestyle'],
  'compat-caution': ['compatibility_transparency', 'compatibility_value_match'],
  'compat-friction': ['compatibility_transparency', 'compatibility_value_match'],
  'compat-repair': ['compatibility_transparency'],
  'compat-growth': ['compatibility_value_match', 'compatibility_lifestyle'],
  'compat-marriage': ['compatibility_lifestyle', 'compatibility_independence', 'compatibility_value_match'],
}

function pairScoresForChapter(id: string, context: PairContext): PairTraitScore[] {
  const allowed = new Set(chapterPairScores[id] ?? [])
  return context.pairTraitScores.filter(score => allowed.has(score.key))
}

function effectiveRelationScores(id: string, context: PairContext): RelationScore[] {
  const pairScores = pairScoresForChapter(id, context).filter(score => score.confidence > 0)
  return context.relationScores.map(relation => {
    const related = pairScores.filter(score => pairScoreAxes[score.key].includes(relation.key))
    const profileKey = relation.key === 'communication' ? 'conversational_flow'
      : relation.key === 'depth' ? 'emotional_intimacy'
      : relation.key === 'repair' ? 'repair_capacity'
      : null
    const profile = profileKey ? context.compatibilityProfile.find(score => score.key === profileKey && score.confidence > 0) : undefined
    if (!related.length && !profile) return relation
    const pairWeight = related.reduce((sum, score) => sum + score.confidence, 0)
    const weightedPairValue = pairWeight ? related.reduce((sum, score) => sum + score.value * score.confidence, 0) / pairWeight : 0
    const profileWeight = profile?.confidence ?? 0
    const totalWeight = relation.confidence + pairWeight + profileWeight
    return {
      ...relation,
      value: Number(((relation.value * relation.confidence + weightedPairValue * pairWeight + (profile?.value ?? 0) * profileWeight) / totalWeight).toFixed(3)),
      confidence: Number(Math.min(1, Math.max(relation.confidence, related.length ? pairWeight / related.length : 0, profileWeight)).toFixed(3)),
    }
  })
}

function axisForChapter(id: string, context: PairContext): RelationAxis {
  const preferred = new Set(chapterAxes[id] ?? [])
  return effectiveRelationScores(id, context)
    .filter(score => preferred.has(score.key) && score.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence || Math.abs(b.value - 0.5) - Math.abs(a.value - 0.5) || a.key.localeCompare(b.key))[0]?.key
    ?? context.strongestAxis
}

function chapterAxisPlan(ids: readonly string[], context: PairContext): Map<string, RelationAxis> {
  const used = new Set<RelationAxis>()
  const plan = new Map<string, RelationAxis>()
  for (const id of ids) {
    const available = effectiveRelationScores(id, context)
      .filter(score => score.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence || Math.abs(b.value - 0.5) - Math.abs(a.value - 0.5) || a.key.localeCompare(b.key))
    const preferred = new Set(chapterAxes[id] ?? [])
    const selected = available.find(score => preferred.has(score.key) && !used.has(score.key))
      ?? available.find(score => !used.has(score.key))
      ?? available.find(score => preferred.has(score.key))
    const axis = selected?.key ?? axisForChapter(id, context)
    plan.set(id, axis)
    used.add(axis)
  }
  return plan
}

const axisLead: Record<RelationAxis, string> = {
  attraction: '惹かれる力が先に動く', depth: '言葉の奥まで感じ取る', communication: '言葉の選び方が距離を変える',
  fun: '一緒に動くほど楽しさが育つ', safety: '戻れる安心が二人を支える', values: '大切な基準を分かち合う',
  growth: '違いが次の成長を連れてくる', domestic: '暮らしのリズムが関係を整える', conflict: '進む速度の違いが表に出る',
  repair: 'すれ違った後の戻り方を覚える', binding: '節目を越えるほど結びつきが深まる',
}

function pagesFor(id: string, context: PairContext, resolvedAxis?: RelationAxis): ReportCardPage[] {
  const frame = relationshipFrame(context.relationshipLabel)
  const relation = context.relationshipLabel
  const axisCore: Record<RelationAxis, string> = { attraction: '互いの違いが強い魅力として動きやすい二人', depth: '言葉になる前の気持ちまで受け取りやすい二人', communication: '言葉の選び方が関係の鍵になる二人', fun: '一緒に動くほど自然な楽しさが育つ二人', safety: '戻れる安心を作るほど深まる二人', values: '大切にする基準を共有しやすい二人', growth: '違いを通して新しい自分へ進む二人', domestic: '暮らしのリズムを整えるほど安定する二人', conflict: '衝突を調整へ変えるほど強くなる二人', repair: '拗れたあとに戻る方法を育てる二人', binding: '節目を越えるたび結びつきが深まる二人' }
  const chapterAxis = resolvedAxis ?? axisForChapter(id, context)
  const core = axisCore[chapterAxis] ?? (context.kind === 'aligned' ? '似た反応を安心に変えやすい二人' : context.kind === 'complementary' ? '違う得意を自然に補い合う二人' : '違う速さを言葉でつなぐほど育つ二人')
  const chapter: Record<string, { cue: string; focus: string; action: string }> = {
    'compat-overview': { cue: '二人の輪郭', focus: core, action: '二人が自然にできることと、意識しないと抜けることを一つずつ話す' },
    'compat-beginning': { cue: '距離の始まり', focus: `${relation}として距離が縮まる入口`, action: '短い会話の回数を増やし、相手の返事を急いで意味づけない' },
    'compat-attraction': { cue: '魅力の正体', focus: `自分にない動きが、相手の魅力として見える理由`, action: '惹かれた場面を具体的に伝え、期待だけを膨らませない' },
    'compat-caution': { cue: '見落としやすい違い', focus: `親しさが増えたあとに、見落としやすい違い`, action: '分かっているはずをやめ、変わった条件を一つずつ言い直す' },
    'compat-friction': { cue: '衝突の扱い', focus: `二人の衝突が、気持ちより速度の違いから始まる場面`, action: '結論の前に、いま答えが要るのか時間が要るのかを確かめる' },
    'compat-repair': { cue: '安心への戻り道', focus: `拗れたあと、安心を取り戻すための順序`, action: '事実、受け取った気持ち、次に望む行動を分けて伝える' },
    'compat-growth': { cue: '関係が育つ力', focus: `違いを消さずに、関係の強さへ変える方法`, action: '同じでなくてよい項目と、揃えたい約束を分けて持つ' },
    'compat-marriage': { cue: '二人の暮らし', focus: `関係が暮らしになったあと、二人らしさを守る条件`, action: '時間、お金、家の役割を気持ちとは別に定期的に話す' },
  }
  const item = chapter[id]
  const conversationBlock = id === 'compat-beginning'
    ? compatibilityProfileBlock(context.compatibilityProfile.find(score => score.key === 'conversational_flow'), item.cue)
    : null
  const emotionalBlock = id === 'compat-attraction'
    ? compatibilityProfileBlock(context.compatibilityProfile.find(score => score.key === 'emotional_intimacy'), item.cue)
    : null
  const repairBlock = id === 'compat-repair'
    ? compatibilityProfileBlock(context.compatibilityProfile.find(score => score.key === 'repair_capacity'), item.cue)
    : null
  const pairScoreBlock = pairScoresForChapter(id, context)
    .map(score => ({ score, weight: score.confidence * Math.abs(score.value - 0.5) }))
    .sort((left, right) => right.weight - left.weight || left.score.key.localeCompare(right.score.key))
    .map(({ score }) => compatibilityScoreBlock(score, item.cue))
    .find((block): block is NonNullable<typeof block> => Boolean(block))
  const scoreBlock = conversationBlock ?? emotionalBlock ?? repairBlock ?? pairScoreBlock
  return [
    { role: 'opening', label: 'この関係の入口', text: `${relation}の二人には、${item.focus}という流れがあります。${context.shared}が、最初の安心になります。` },
    { role: 'core', label: '二人の核', text: `${item.cue}には、${core}という特徴と、あなたの${context.selfStyle}、あの人の${context.partnerStyle}が表れます。` },
    { role: 'scene', label: '日常に現れる場面', text: `${item.cue}は、予定を決める時や返事を待つ時に現れます。${context.difference}を拒絶と受け取らないことが大切です。` },
    { role: 'shadow', label: 'すれ違うとき', text: `${item.cue}を見失う時ほど、${frame}。言葉を省くと、互いに別の物語を想像しやすくなります。` },
    scoreBlock
      ? { role: 'exception', label: '二人に現れる特徴', text: scoreBlock.text }
      : { role: 'exception', label: '意外な強さ', text: `${item.cue}では、${context.shared}が違う答えを持った時の二人を支えます。戻って話せることが、この相性の強さです。` },
    { role: 'question', label: '確かめたいこと', text: `${item.cue}が最も表れたのはどんな場面でしょう。最近の出来事を一つ選ぶと、関係の現在地が見えてきます。` },
    { role: 'action', label: '二人で試すこと', text: `${item.action}。${context.selfStyle}と${context.partnerStyle}の両方を約束に含めてください。` },
    { role: 'core', label: '長く続く条件', text: `${item.cue}を長く育てる鍵は、${frame}です。${relation}の親しさが増えても、確認することを手放さないでください。` },
    { role: 'scene', label: '次の節目', text: `${item.cue}の次の節目では、${context.shared}を思い出してください。${context.difference}を勝ち負けでなく調整として扱えます。` },
    { role: 'closing', label: 'この章の余韻', text: `この章で見えてきたのは、${item.cue}に宿る${core}という二人の形です。違いを知ったあとも戻れる場所を作ることで育ちます。` },
  ]
}

const specs = [
  ['compat-overview', '二人の違いを知るほど、関係の輪郭がはっきりする'], ['compat-beginning', '答えを急がない時間が、二人の距離を近づける'],
  ['compat-attraction', '自分にない動きが、相手への魅力に変わる'], ['compat-caution', '親しさの中でも、確認をやめないことが信頼になる'],
  ['compat-friction', '衝突は気持ちより、進む速度の違いから始まる'], ['compat-repair', '事実と気持ちを分けると、二人は同じ場所へ戻れる'],
  ['compat-growth', '違いを残したまま約束を作ると、関係が強くなる'], ['compat-marriage', '暮らしの条件を話し続けるほど、二人らしい夫婦になる'],
] as const

export function buildDeterministicCompatibilityReport(self: unknown, partner: unknown, relationshipType: RelationshipType, relationshipLabel: string, scoreBundle?: CompatibilityTraitScoreBundle): StructuredReport {
  const context = pairContext(self, partner, relationshipType, relationshipLabel, scoreBundle)
  const selected = relationshipType === 'romantic' ? specs : specs.filter(([id]) => id !== 'compat-marriage')
  const axisPlan = chapterAxisPlan(selected.map(([id]) => id), context)
  const cards = selected.map(([id, title]) => {
    const chapterAxis = axisPlan.get(id) ?? axisForChapter(id, context)
    const chapterScores = pairScoresForChapter(id, context)
    const chapterProfileKeys: CompatibilityProfileScore['key'][] = id === 'compat-repair'
      ? ['repair_capacity', 'emotional_intimacy']
      : ['compat-attraction', 'compat-caution'].includes(id) ? ['emotional_intimacy']
      : ['compat-beginning', 'compat-friction'].includes(id) ? ['conversational_flow'] : []
    const chapterProfiles = context.compatibilityProfile.filter(score => chapterProfileKeys.includes(score.key))
    const resolvedTitle = `${axisLead[chapterAxis]}とき、${title}`
    return withCardProvenance({ id, kind: 'essence', scope: 'couple', tab: 'essence', title: resolvedTitle,
    summary: `${relationshipLabel}の二人には、${axisLead[chapterAxis]}という特徴があります。この章では「${title}」を手がかりに、${context.difference}を扱う順序を読み解きます。`, tags: ['相性', relationshipLabel], period: null,
    pages: pagesFor(id, context, chapterAxis),
    evidence: [
      ...context.evidence,
      ...chapterScores.map(score => ({
        family: '二人の特性比較', system: '決定論スコア', detail: `${score.key}=${score.value}; confidence=${score.confidence}`,
      })),
      ...chapterProfiles.map(profile => ({ family: '二人の相性プロファイル', system: '決定論スコア', detail: `${profile.key}=${profile.value}; confidence=${profile.confidence}` })),
    ],
    metadataRefs: [
      'self.shichuDay', 'partner.shichuDay', 'self.lifePathNumber', 'partner.lifePathNumber', `synastry.axis.${chapterAxis}`,
      ...chapterScores.map(score => `pairTraitScore.${score.key}`),
      ...chapterProfiles.map(profile => `compatibilityProfile.${profile.key}`),
    ] }, 'deterministic')
  })
  return finalizeReportProvenance({ version: 2, cards, reportText: cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n') }, 'compat-deterministic-v1')
}
