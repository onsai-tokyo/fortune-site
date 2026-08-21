import type { ReportCard, ReportCardPage, StructuredReport } from '../reportCards.js'
import type { FactAxis, ReportFact } from './facts.js'
import type { ReportFinding } from './findings.js'

interface ChapterSpec { id: string; theme: string; tags: string[]; axes: FactAxis[] }
const chapters: ChapterSpec[] = [
  { id: 'life-mission', theme: '何度でも戻ってくる人生の軸', tags: ['本質', '人生'], axes: ['drive'] },
  { id: 'core-mind-1', theme: '答えを選ぶときの心の順序', tags: ['本質', '判断'], axes: ['cognition', 'expression'] },
  { id: 'core-mind-2', theme: '人とのあいだに置く距離', tags: ['本質', '人間関係'], axes: ['relation'] },
  { id: 'core-mind-3', theme: '自分を見失いやすい瞬間', tags: ['本質', '注意点'], axes: ['shadow', 'deficit', 'tension'] },
  { id: 'love-beginning', theme: '心が動き始める入口', tags: ['恋愛'], axes: ['domain-love', 'relation'] },
  { id: 'love-pattern', theme: '関係が続くときと離れるとき', tags: ['恋愛', '結婚'], axes: ['domain-love', 'tension'] },
  { id: 'work-mode', theme: '仕事で自然に力が出る進め方', tags: ['仕事'], axes: ['domain-work', 'drive'] },
  { id: 'work-fit', theme: '長く働ける環境の条件', tags: ['仕事', '環境'], axes: ['domain-work', 'deficit'] },
]

const signalText: Record<string, string> = {
  independence: '自分で境界を決める力', competition: '相手と並んだときに強まる負けん気', expression: '内側にあるものを外へ形にする力',
  critique: '違和感を見過ごさない感覚', adaptability: '相手と場に合わせて動きを変える柔軟さ', practicality: '現実の条件を積み上げる力',
  initiative: '最初の一歩を引き受ける力', responsibility: '任された範囲を守り抜く力', insight: '表面の奥を読み取る視点',
  learning: '経験を知識へ変える力', harmony: '違う人同士の間を整える力', sensitivity: '小さな変化を先に感じ取る感受性',
  care: '相手が必要とするものを手渡す力', stability: '変化の中でも足場を保つ力', exploration: 'まだ知らないものへ向かう好奇心',
  communication: '考えを言葉にして共有する力', transformation: '古い形を終わらせて作り直す力', integration: '離れた要素を一つの見方へまとめる力',
}

function phrase(finding: ReportFinding): string {
  if (finding.key.startsWith('missing-')) return `${finding.key.slice('missing-'.length)}の要素を外の環境から補う必要`
  if (finding.key.startsWith('tension-')) return '二つの欲求が同時に強くなる葛藤'
  if (finding.key.startsWith('distortion-')) return '近い関係ほど反応が大きくなる場面'
  if (finding.key.startsWith('mutagen-')) return '特定の領域だけ強く動きやすい偏り'
  return signalText[finding.key] ?? finding.key.replaceAll('-', ' ')
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
  return result
}

function pagesFor(spec: ChapterSpec, finding: ReportFinding): ReportCardPage[] {
  const subject = phrase(finding)
  return [
    { role: 'opening', label: '扉', text: `${subject}。この章では、その力が日常のどこで目を覚ますのかを辿ります。` },
    { role: 'core', label: '変わらない核', text: `選択肢がいくつも並ぶとき、最後にあなたを動かすのは${subject}です。迷っているように見える時間にも、内側では譲れない順序が静かに決まっています。` },
    { role: 'scene', label: '人から見える顔', text: `初対面や役割を任された場では、状況を眺めてから必要な場所へ入ります。周囲には落ち着いて見えても、頭の中では誰が何を必要としているかを細かく読み分けています。` },
    { role: 'scene', label: '胸の内側', text: `誰にも言わずに抱えているのは、うまくできるかという不安より、自分の選択に納得できるかという問いです。形だけ整っても意味が伴わなければ、心は簡単には動きません。` },
    { role: 'core', label: '力になるとき', text: `${subject}は、答えのない状況でこそ強みになります。人が見落とした条件を拾い、散らばった情報を自分なりの筋道へ戻すことで、次の一歩を具体的にできます。` },
    { role: 'shadow', label: '苦しくなるとき', text: `反対に余白がなくなると、その力だけで早く決着をつけたくなります。まだ言葉になっていない相手の事情や、自分の疲れを後回しにすると、正しいはずの選択が重く残ります。` },
    { role: 'scene', label: '人との距離', text: `近づく前には相手をよく見ています。信頼できると分かれば深く関わりますが、境界を急に越えられると一歩引きます。その距離は冷たさではなく、関係を長く保つための確認です。` },
    { role: 'exception', label: '誤解されやすいところ', text: `黙って考える時間が長いほど、関心がないように受け取られることがあります。実際には逆で、大切なことほど雑に返したくないため、言葉を選び終えるまで表に出さないのです。` },
    { role: 'scene', label: '恋愛で現れる面', text: `恋愛では、強い言葉より日々の整合性を見ています。約束の扱い方や沈黙の居心地を重ね、安心できる相手だと分かったとき、普段は守っている柔らかな部分を見せ始めます。` },
    { role: 'scene', label: '仕事で現れる面', text: `仕事では、目的と裁量の範囲が見えるほど集中が深まります。ただ従うより、理由を理解して自分の手順に落とせる環境で力が続き、周囲が曖昧にした課題にも輪郭を与えます。` },
    { role: 'shadow', label: '同じ力の裏側', text: `${subject}は、守ろうとするほど頑固さにも変わります。譲れないものと、ただ慣れているだけのものを区別できない日は、変化そのものを危険だと感じやすくなります。` },
    { role: 'exception', label: '以前との違い', text: `以前は周囲に合わせたあとで違和感に気づくことが多かったはずです。経験を重ねたいまは、小さな引っかかりの段階で立ち止まり、自分の条件を確かめ直せるようになっています。` },
    { role: 'question', label: 'いま立っている場所', text: `最近、理由を説明できないまま気になっていることはありますか。そこには、${subject}が次に使われる場所が隠れています。答えより先に、何を守りたいのかを見てください。` },
    { role: 'action', label: 'これからの使い方', text: `次に迷ったら、守りたい条件、試してよい条件、手放せる条件を一つずつ書きます。全部を同時に満たそうとせず、${subject}を最も生かせる場面から選び直してください。` },
    { role: 'closing', label: '余韻', text: `変えるべきなのは、あなたの核ではありません。${subject}が孤立しないよう、別の感情や現実の条件と手を結ばせること。そのとき同じ性質が、これまでとは違う景色を開きます。` },
  ]
}

export function buildEditorialStructuredReport(facts: ReportFact[], findings: ReportFinding[]): StructuredReport {
  const factById = new Map(facts.map(fact => [fact.id, fact]))
  const cards = assignFindingsToChapters(findings).map(({ spec, finding }): ReportCard => {
    const pages = pagesFor(spec, finding)
    return { id: spec.id, kind: 'essence', tab: 'essence', title: spec.theme, summary: pages[0].text,
      tags: spec.tags, period: null, pages,
      evidence: finding.primaryFacts.flatMap(id => { const fact = factById.get(id); return fact ? [{ family: fact.lineage, system: fact.system, detail: fact.factor }] : [] }),
      metadataRefs: [`finding:${finding.id}`, ...finding.primaryFacts.map(id => `fact:${id}`)] }
  })
  return { version: 3, cards, reportText: cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n'), generator: 'deterministic' }
}
