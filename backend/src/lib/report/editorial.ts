import type { ReportCard, ReportCardPage, StructuredReport } from '../reportCards.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'
import type { FactAxis, ReportFact } from './facts.js'
import type { ReportFinding } from './findings.js'
import { titlesAreSimilar } from './aiWriter.js'

interface ChapterSpec { id: string; internalLabel: string; tags: string[]; axes: FactAxis[] }
const chapters: ChapterSpec[] = [
  { id: 'life-mission', internalLabel: '価値観', tags: ['本質', '価値観'], axes: ['drive'] },
  { id: 'core-mind-1', internalLabel: '行動パターン', tags: ['本質', '行動パターン'], axes: ['cognition', 'expression'] },
  { id: 'core-mind-2', internalLabel: '人との距離', tags: ['本質', '人間関係'], axes: ['relation'] },
  { id: 'core-mind-3', internalLabel: '弱点・注意点', tags: ['本質', '弱点・注意点'], axes: ['shadow', 'deficit', 'tension'] },
  { id: 'love-beginning', internalLabel: '恋愛の入口', tags: ['恋愛'], axes: ['domain-love', 'relation'] },
  { id: 'love-pattern', internalLabel: '関係の続き方', tags: ['恋愛', '結婚'], axes: ['domain-love', 'tension'] },
  { id: 'work-mode', internalLabel: '仕事の進め方', tags: ['仕事'], axes: ['domain-work', 'drive'] },
  { id: 'work-fit', internalLabel: '働く環境', tags: ['仕事', '環境'], axes: ['domain-work', 'deficit'] },
]

interface FindingLanguage { trait: string; statement: string; title: string }

const signalLanguage: Record<string, FindingLanguage> = {
  independence: { trait: '自分の境界を自分で決める力', statement: '自分で選べる余白があるほど、迷いから早く抜けます', title: '境界線を引くことが、人生の大きな軸になる' },
  competition: { trait: '人と並んだときに目を覚ます負けん気', statement: '相手がいる場面ほど、眠っていた力が前へ出ます', title: '人と並ぶと、負けたくない力が目を覚ます' },
  expression: { trait: '内側の思いを外へ形にする力', statement: '考えを形にしたとき、周囲まで動かす人です', title: '内側の思いは、形にしたとき力になる' },
  critique: { trait: '小さな違和感を見過ごさない感覚', statement: '周囲が流した違和感を拾い、答えを磨き直します', title: '違和感を見逃さない目が、答えを磨く' },
  adaptability: { trait: '相手と場に合わせて動きを変える柔軟さ', statement: '相手を読みながら、自分の動き方を素早く変えます', title: '相手に合わせながら、場の流れを変える' },
  practicality: { trait: '現実の条件を一つずつ積み上げる力', statement: '条件が具体的になるほど、迷わず手を動かせます', title: '現実の条件を積み上げるほど、仕事が進む' },
  initiative: { trait: '最初の一歩を引き受ける力', statement: '誰も動かない場面で、最初の一歩を選べる人です', title: '最初の一歩を引き受けると、道が開く' },
  responsibility: { trait: '任された範囲を守り抜く力', statement: '役割が明確になるほど、最後まで力を保てます', title: '任された範囲を守るほど、信頼が育つ' },
  insight: { trait: '表面の奥にある理由を読み取る視点', statement: '目に見える答えだけで終わらず、その奥の理由を探します', title: '表面の奥を読むことで、本当の答えに届く' },
  learning: { trait: '経験を知識へ変えて残す力', statement: '一度の経験を、次の選択に使える知恵へ変えます', title: '経験を知識へ変えるほど、選択が強くなる' },
  harmony: { trait: '違う人同士のあいだを整える力', statement: '意見が違う人のあいだに、共通の足場を作ります', title: '違う人のあいだを整えることで、居場所を作る' },
  sensitivity: { trait: '小さな変化を言葉より先に感じる力', statement: 'まだ言葉にならない変化を、誰より先に受け取ります', title: '小さな変化を先に感じ、言葉になる前を読む' },
  care: { trait: '相手が必要とするものを手渡す力', statement: '相手に必要なものを見つけ、自然に差し出せる人です', title: '必要なものを手渡すことで、関係を育てる' },
  stability: { trait: '変化の中でも足場を保つ力', statement: '周囲が揺れるときほど、続けられる形を作ります', title: '変化の中に足場を作ると、本来の力が続く' },
  exploration: { trait: 'まだ知らないものへ向かう好奇心', statement: '知らない世界に触れるほど、自分の輪郭が明確になります', title: '知らないものへ向かうほど、自分の輪郭が見える' },
  communication: { trait: '考えを言葉にして人へ渡す力', statement: '離れた情報を言葉で結び、人へ渡せる形にします', title: '言葉にして渡すことで、人と情報をつなぐ' },
  transformation: { trait: '古い形を終わらせて作り直す力', statement: '役目を終えた形を手放すと、次の動きが始まります', title: '古い形を終わらせると、次の自分が動き出す' },
  integration: { trait: '離れた出来事を一つの意味へまとめる力', statement: 'ばらばらの出来事を結び、自分なりの意味を見つけます', title: '離れた出来事を結び、ひとつの意味に変える' },
}

const missingLanguage: Record<string, FindingLanguage> = {
  金: { trait: '決め切る力を外の基準から借りて育てる性質', statement: '締切や数字が見えると、迷っていた答えを決め切れます', title: '決め切る力は、外の基準を借りると育つ' },
  火: { trait: '思いを表に出す熱を、環境から受け取る性質', statement: '熱のある人や場所に触れると、思いを表へ出せます', title: '思いを表に出す力は、熱のある場で目を覚ます' },
  水: { trait: '立ち止まって考える余白を、意識して作る性質', statement: '静かな時間を先に確保すると、本当の答えへ戻れます', title: '考える余白を取り戻すと、本当の答えが見える' },
  木: { trait: '始めるきっかけを外に置いて、成長を動かす性質', statement: '約束や仲間がいると、最初の一歩を迷わず踏み出せます', title: '始めるきっかけを外に置くと、成長が動き出す' },
  土: { trait: '続けるための足場を、先に用意する性質', statement: '予定と居場所が整うと、持っている力を長く保てます', title: '続ける足場を先に作ると、力が安定する' },
}

function primaryFactor(finding: ReportFinding, factById: Map<string, ReportFact>): string {
  return finding.primaryFacts.map(id => factById.get(id)?.factor ?? '').find(Boolean) ?? ''
}

function specializedLanguage(finding: ReportFinding, factById: Map<string, ReportFact>): FindingLanguage {
  if (finding.key.startsWith('missing-')) return missingLanguage[finding.key.slice('missing-'.length)] ?? missingLanguage.土
  const factor = primaryFactor(finding, factById)
  if (finding.key.startsWith('mutagen-')) {
    const palace = factor.split(':')[2] ?? ''
    if (palace.includes('夫妻')) return { trait: '近い相手との関係だけ、判断の振れ幅が大きくなる性質', statement: '仕事では動じなくても、近い人の一言で予定を変えることがあります', title: '近い相手との関係だけ、判断の振れ幅が大きくなる' }
    if (palace.includes('官禄')) return { trait: '仕事の役割に応じて、力の出方が大きく変わる性質', statement: '任される役割が変わると、行動の速さまで一気に変わります', title: '仕事の役割が変わると、力の出方まで大きく変わる' }
    if (palace.includes('財帛')) return { trait: 'お金の動きに応じて、決断の速度が変わる性質', statement: '収入や支出の見通しが立つと、選択を一気に進められます', title: 'お金の流れが見えると、決断の速度が変わる' }
    return { trait: '特定の場面だけ、反応の振れ幅が大きくなる性質', statement: '普段は落ち着いていても、大切な領域では判断が大きく動きます', title: '大切な領域に入ると、反応の振れ幅が大きくなる' }
  }
  if (finding.key.startsWith('distortion-')) {
    const relation = finding.key.slice('distortion-'.length)
    if (relation.includes('冲')) return { trait: '近い関係ほど、今の形を変えたくなる性質', statement: '安心した関係ほど、同時に新しい風を入れたくなります', title: '近い関係ほど、今の形を変えたくなる' }
    if (relation.includes('刑')) return { trait: '近い関係ほど、自分にも相手にも厳しくなる性質', statement: '大切な相手には、できるはずという期待が強くなります', title: '大切な相手ほど、期待が厳しさに変わりやすい' }
    if (relation.includes('害')) return { trait: '言葉にしない違和感を、近い関係で溜めやすい性質', statement: '小さな引っかかりを飲み込み、後から距離を取りたくなります', title: '言葉にしない違和感が、近い関係で積もりやすい' }
    return { trait: '一度決めた関係の形を、途中で作り直したくなる性質', statement: '続けるために、約束や距離を何度でも調整します', title: '関係を続けるために、途中で形を作り直す' }
  }
  if (finding.key.startsWith('tension-')) {
    if (factor.includes('astrology')) return { trait: '考えと感情が別方向へ動くと、答えを急ぐ性質', statement: '迷いが長引くほど、白黒を早く決めたくなります', title: '考えと感情がずれると、答えを急ぎたくなる' }
    return { trait: '進みたい気持ちと慎重さが、同時に強くなる性質', statement: '大切な選択ほど、踏み出す力と止まる力が同時に働きます', title: '進みたい気持ちと慎重さが、同時に強くなる' }
  }
  return signalLanguage[finding.key] ?? { trait: '自分なりの順序で答えを選ぶ力', statement: '周囲の速さより、自分が納得できる順序を選びます', title: '自分なりの順序を守ると、答えが明確になる' }
}

export interface ChapterAssignment { spec: ChapterSpec; finding: ReportFinding }

export function assignFindingsToChapters(findings: ReportFinding[]): ChapterAssignment[] {
  const usedFindings = new Set<string>()
  const usedFacts = new Set<string>()
  const result: ChapterAssignment[] = []
  for (const spec of chapters) {
    const candidates = findings.filter(finding => spec.axes.includes(finding.axis) && !usedFindings.has(finding.id)
      && finding.primaryFacts.every(fact => !usedFacts.has(fact)))
      .sort((a, b) => Number(b.kind === 'consensus') - Number(a.kind === 'consensus') || b.confidence - a.confidence || a.id.localeCompare(b.id))
    const finding = candidates[0]
    if (!finding) continue
    result.push({ spec, finding }); usedFindings.add(finding.id); finding.primaryFacts.forEach(fact => usedFacts.add(fact))
  }
  console.info('Editorial chapter assignment metric', {
    totalChapters: chapters.length,
    assignedChapters: result.length,
    skippedChapters: chapters.length - result.length,
    findingsCount: findings.length,
  })
  return result
}

const sceneByAxis: Record<FactAxis, string> = {
  drive: '誰かに急かされた場面より、自分で順序を決めた場面で迷いが消えます。',
  cognition: '情報が多い日ほど、一度ひとりで整理すると判断が明確になります。',
  relation: '人と向き合う場面では、言葉より先に相手との距離を測ります。',
  expression: '考えるだけの日より、書く・話す・作る日に本来の力が表へ出ます。',
  shadow: '大切な相手ほど反応が強くなり、普段の落ち着きが揺れることがあります。',
  deficit: '足りないものを一人で埋めるより、環境を選ぶことで力を取り戻します。',
  tension: '答えを急ぐ日ほど、二つの気持ちを分けて扱うと判断が軽くなります。',
  'domain-work': '仕事では、任される範囲と目的が見えた瞬間に集中が深まります。',
  'domain-love': '恋愛では、相手の一言や沈黙が、ほかの場面より深く心を動かします。',
  timing: '節目では、同じ選択でも以前とは違う意味を持つようになります。',
}

function summaryFor(language: FindingLanguage, finding: ReportFinding): string {
  return `あなたは、${language.statement}。${sceneByAxis[finding.axis]}`
}

function pagesFor(finding: ReportFinding, language: FindingLanguage, spec: ChapterSpec): ReportCardPage[] {
  const subject = language.trait
  const basis = finding.kind === 'consensus' ? 'いくつもの見方が同じ方向を示すため' : 'ひときわ強く出ている特徴として'
  const pages: ReportCardPage[] = [
    { role: 'opening', label: '扉', text: `${language.title}。${sceneByAxis[finding.axis]}` },
    { role: 'core', label: '変わらない核', text: `選択肢がいくつも並ぶとき、最後にあなたを動かすのは${subject}です。迷っているように見える時間にも、内側では譲れない順序が静かに決まっています。` },
    { role: 'scene', label: '人から見える顔', text: `${subject}が表に出ると、周囲には落ち着いて見えます。けれど頭の中では、誰が何を必要としているかを細かく読み分けています。` },
    { role: 'scene', label: '胸の内側', text: `${subject}の奥にあるのは、うまくできるかより、自分の選択に納得できるかという問いです。形だけ整っても、意味がなければ心は動きません。` },
    { role: 'core', label: '力になるとき', text: `${subject}は、答えのない状況でこそ強みになります。人が見落とした条件を拾い、散らばった情報を自分なりの筋道へ戻すことで、次の一歩を具体的にできます。` },
    { role: 'shadow', label: '苦しくなるとき', text: `${subject}だけで早く決着をつけようとすると、まだ言葉にならない相手の事情や自分の疲れを後回しにします。正しいはずの選択が重く残る瞬間です。` },
    { role: 'scene', label: '人との距離', text: `${subject}を守るため、近づく前には相手をよく見ます。信頼できれば深く関わり、境界を急に越えられると一歩引きます。その距離は関係を保つ確認です。` },
    { role: 'exception', label: '誤解されやすいところ', text: `${subject}を使って考える時間が長いほど、関心がないように見えます。実際には、大切なことほど雑に返したくないため、言葉を選んでいるのです。` },
    { role: 'scene', label: '恋愛で現れる面', text: `恋愛では${subject}が約束や沈黙の扱いに現れます。安心できる相手だと分かったとき、普段は守っている柔らかな部分を少しずつ見せ始めます。` },
    { role: 'scene', label: '仕事で現れる面', text: `仕事では${subject}が、目的と裁量の範囲を確かめる動きになります。理由を理解して自分の手順へ落とせる環境ほど、集中が長く続きます。` },
    { role: 'shadow', label: '同じ力の裏側', text: `${subject}は、守ろうとするほど頑固さにも変わります。譲れないものと、ただ慣れているだけのものを区別できない日は、変化そのものを危険だと感じやすくなります。` },
    { role: 'exception', label: '以前との違い', text: `以前は${subject}を後回しにし、周囲に合わせたあとで違和感に気づきました。経験を重ねたいまは、小さな引っかかりの段階で自分の条件を確かめ直せます。` },
    { role: 'question', label: 'いま立っている場所', text: `最近、理由を説明できないまま気になっていることはありますか。そこには、${subject}が次に使われる場所が隠れています。答えより先に、何を守りたいのかを見てください。` },
    { role: 'action', label: 'これからの使い方', text: `次に迷ったら、守る条件、試す条件、手放す条件を一つずつ書きます。${basis}、${subject}を最も生かせる場面から選び直すと答えが軽くなります。` },
    { role: 'closing', label: '余韻', text: `変えるべきなのは、あなたの核ではありません。${subject}を別の感情や現実の条件と結び直すこと。そのとき同じ性質が、これまでとは違う景色を開きます。` },
  ]
  const isLove = spec.id.startsWith('love-')
  const isWork = spec.id.startsWith('work-')
  return pages.map(page => {
    if (isLove && page.label === '仕事で現れる面') return { ...page, label: '関係が日常になるとき', text: `関係が日常になると、${subject}は連絡や約束の小さな扱いに現れます。一緒にいる時間より、離れている時間にも安心できる形が続く条件になります。` }
    if (isWork && page.label === '恋愛で現れる面') return { ...page, label: '任され方との相性', text: `役割を任されると、${subject}は判断と段取りに現れます。目的と責任の境界が明確な仕事ほど、迷いを減らして長く集中できます。` }
    return page
  })
}

const collisionTitles: Record<string, string> = {
  'life-mission': '迷うたび、自分で選べる場所へ戻っていく', 'core-mind-1': '答えは、静かに考えたあとで明確になる',
  'core-mind-2': '近づく前に距離を測るから、関係が長く続く', 'core-mind-3': '大切なものほど、反応が強くなりやすい',
  'love-beginning': '安心を確かめたあとで、心が大きく動き出す', 'love-pattern': '関係を続けるために、約束を何度でも整える',
  'work-mode': '目的と裁量が見えると、仕事の力が立ち上がる', 'work-fit': '自分の手順を持てる環境で、力が長く続く',
}

export function buildEditorialStructuredReport(facts: ReportFact[], findings: ReportFinding[]): StructuredReport {
  const factById = new Map(facts.map(fact => [fact.id, fact]))
  const cards: ReportCard[] = []
  for (const { spec, finding } of assignFindingsToChapters(findings)) {
    const language = specializedLanguage(finding, factById)
    const title = cards.some(card => titlesAreSimilar(card.title, language.title)) ? collisionTitles[spec.id] : language.title
    const pages = pagesFor(finding, { ...language, title }, spec)
    cards.push(withCardProvenance({ id: spec.id, kind: 'essence', scope: 'self', tab: 'essence', title, summary: summaryFor(language, finding),
      tags: spec.tags, period: null, pages,
      evidence: finding.primaryFacts.flatMap(id => { const fact = factById.get(id); return fact ? [{ family: fact.lineage, system: fact.system, detail: fact.factor }] : [] }),
      metadataRefs: [`finding:${finding.id}`, ...finding.primaryFacts.map(id => `fact:${id}`)] }, 'deterministic'))
  }
  return finalizeReportProvenance({ version: 3, cards, reportText: cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n') }, 'editorial-v3')
}
