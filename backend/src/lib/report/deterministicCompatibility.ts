import type { ReportCard, ReportCardPage, StructuredReport } from '../reportCards.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'

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

function pairContext(selfValue: unknown, partnerValue: unknown, relationshipType: RelationshipType, relationshipLabel: string): PairContext {
  const self = record(selfValue); const partner = record(partnerValue)
  const selfDay = text(self.shichuDay); const partnerDay = text(partner.shichuDay)
  const selfStyle = stemStyle[selfDay[0]] ?? '自分の順序で答えを選ぶこと'
  const partnerStyle = stemStyle[partnerDay[0]] ?? '納得できる条件を確かめること'
  const selfNumber = number(self.lifePathNumber); const partnerNumber = number(partner.lifePathNumber)
  const sameStem = Boolean(selfDay && partnerDay && selfDay[0] === partnerDay[0])
  const sameNumberRhythm = selfNumber > 0 && partnerNumber > 0 && selfNumber % 3 === partnerNumber % 3
  const kind: PairKind = sameStem ? 'aligned' : sameNumberRhythm ? 'complementary' : 'clashing'
  return {
    relationshipLabel, relationshipType, selfStyle, partnerStyle, kind,
    shared: sameStem ? '判断の入口が似ていること' : sameNumberRhythm ? '動き出す時のリズムが近いこと' : '大切な相手ほど真剣に向き合うこと',
    difference: selfStyle === partnerStyle ? '同じ結論でも伝える時機が違うこと' : `${selfStyle}と${partnerStyle}の違い`,
    evidence: [
      { family: '本人の命式', system: '複数占術の統合', detail: `day=${selfDay}; lifePath=${selfNumber}; sukuyo=${text(self.sukuyo)}` },
      { family: '相手の命式', system: '複数占術の統合', detail: `day=${partnerDay}; lifePath=${partnerNumber}; sukuyo=${text(partner.sukuyo)}` },
    ],
  }
}

function pagesFor(id: string, context: PairContext): ReportCardPage[] {
  const frame = relationshipFrame(context.relationshipLabel)
  const relation = context.relationshipLabel
  const core = context.kind === 'aligned' ? '似た反応を安心に変えやすい二人' : context.kind === 'complementary' ? '違う得意を自然に補い合う二人' : '違う速さを言葉でつなぐほど育つ二人'
  const chapter: Record<string, { focus: string; action: string }> = {
    'compat-overview': { focus: core, action: '二人が自然にできることと、意識しないと抜けることを一つずつ話す' },
    'compat-beginning': { focus: `${relation}として距離が縮まる入口`, action: '短い会話の回数を増やし、相手の返事を急いで意味づけない' },
    'compat-attraction': { focus: `自分にない動きが、相手の魅力として見える理由`, action: '惹かれた場面を具体的に伝え、期待だけを膨らませない' },
    'compat-caution': { focus: `親しさが増えたあとに、見落としやすい違い`, action: '分かっているはずをやめ、変わった条件を一つずつ言い直す' },
    'compat-friction': { focus: `二人の衝突が、気持ちより速度の違いから始まる場面`, action: '結論の前に、いま答えが要るのか時間が要るのかを確かめる' },
    'compat-repair': { focus: `拗れたあと、安心を取り戻すための順序`, action: '事実、受け取った気持ち、次に望む行動を分けて伝える' },
    'compat-growth': { focus: `違いを消さずに、関係の強さへ変える方法`, action: '同じでなくてよい項目と、揃えたい約束を分けて持つ' },
    'compat-marriage': { focus: `関係が暮らしになったあと、二人らしさを守る条件`, action: '時間、お金、家の役割を気持ちとは別に定期的に話す' },
  }
  const item = chapter[id]
  return [
    { role: 'opening', label: 'この関係の入口', text: `${relation}の二人には、${item.focus}という流れがあります。${context.shared}が、最初の安心になります。` },
    { role: 'core', label: '二人の核', text: `${item.focus}には、あなたの${context.selfStyle}と、あの人の${context.partnerStyle}が表れます。その違いが関係の輪郭を作ります。` },
    { role: 'scene', label: '日常に現れる場面', text: `${item.focus}は、予定を決める時や返事を待つ時に現れます。${context.difference}を拒絶と受け取らないことが大切です。` },
    { role: 'shadow', label: 'すれ違うとき', text: `${item.focus}を見失う時ほど、${frame}。言葉を省くと、互いに別の物語を想像しやすくなります。` },
    { role: 'exception', label: '意外な強さ', text: `${item.focus}では、${context.shared}が違う答えを持った時の二人を支えます。戻って話せることが、この相性の強さです。` },
    { role: 'question', label: '確かめたいこと', text: `二人にとって${item.focus}とは、どんな場面でしょう。最近の出来事を一つ選ぶと、関係の現在地が見えてきます。` },
    { role: 'action', label: '二人で試すこと', text: `${item.action}。${context.selfStyle}と${context.partnerStyle}の両方を約束に含めてください。` },
    { role: 'core', label: '長く続く条件', text: `${item.focus}を長く育てる鍵は、${frame}です。${relation}の親しさが増えても、確認することを手放さないでください。` },
    { role: 'scene', label: '次の節目', text: `${item.focus}の次の節目では、${context.shared}を思い出してください。${context.difference}を勝ち負けでなく調整として扱えます。` },
    { role: 'closing', label: 'この章の余韻', text: `${item.focus}。二人の関係は、同じになることではなく、違いを知ったあとも戻れる場所を作ることで育ちます。` },
  ]
}

const specs = [
  ['compat-overview', '二人の違いを知るほど、関係の輪郭がはっきりする'], ['compat-beginning', '答えを急がない時間が、二人の距離を近づける'],
  ['compat-attraction', '自分にない動きが、相手への魅力に変わる'], ['compat-caution', '親しさの中でも、確認をやめないことが信頼になる'],
  ['compat-friction', '衝突は気持ちより、進む速度の違いから始まる'], ['compat-repair', '事実と気持ちを分けると、二人は同じ場所へ戻れる'],
  ['compat-growth', '違いを残したまま約束を作ると、関係が強くなる'], ['compat-marriage', '暮らしの条件を話し続けるほど、二人らしい夫婦になる'],
] as const

export function buildDeterministicCompatibilityReport(self: unknown, partner: unknown, relationshipType: RelationshipType, relationshipLabel: string): StructuredReport {
  const context = pairContext(self, partner, relationshipType, relationshipLabel)
  const selected = relationshipType === 'romantic' ? specs : specs.filter(([id]) => id !== 'compat-marriage')
  const cards = selected.map(([id, title]) => withCardProvenance({ id, kind: 'essence', scope: 'couple', tab: 'essence', title,
    summary: `${relationshipLabel}の二人は、${context.shared}を足場にしながら、${context.difference}を扱う関係です。`, tags: ['相性', relationshipLabel], period: null,
    pages: pagesFor(id, context), evidence: context.evidence, metadataRefs: ['self.shichuDay', 'partner.shichuDay', 'self.lifePathNumber', 'partner.lifePathNumber'] }, 'deterministic'))
  return finalizeReportProvenance({ version: 2, cards, reportText: cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n') }, 'compat-deterministic-v1')
}
