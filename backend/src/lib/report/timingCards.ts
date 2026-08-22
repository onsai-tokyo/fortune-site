import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportCardPage, StructuredReport } from '../reportCards.js'
import { titlesAreSimilar } from './aiWriter.js'
import { japanDateParts } from '../japanDate.js'

type Annual = NonNullable<ReportInput['timing']>['annual'][number]
type Decade = NonNullable<ReportInput['timing']>['decades'][number]

function unique(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function eventFlags(values: string[]) {
  const joined = values.join('・')
  return {
    meeting: /出会|縁が始|交際開始|恋愛開始/.test(joined), marriage: /結婚|婚約|入籍|同居/.test(joined),
    separation: /別れ|離別|失恋|関係.*見直|距離/.test(joined), work: /仕事|転職|昇進|責任|役割|成果|独立|肩書/.test(joined),
    move: /引越|転居|移動|環境.*変|住む場所/.test(joined), study: /学|資格|探究|知識|訓練/.test(joined),
    money: /収入|財|お金|資産|現実/.test(joined), reset: /休|整理|内省|見直|手放|刷新/.test(joined),
  }
}

function stableIndex(values: string[], year: number, length: number) {
  const source = `${year}:${values.join('|')}`
  let hash = 0
  for (const character of source) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % length
}

function titleFor(values: string[], year: number) {
  const flags = eventFlags(values)
  if (flags.move && flags.work) return '住む場所と働き方を同時に変える年'
  if (flags.marriage) return flags.work ? '関係を形にし、仕事との配分を決める年' : '関係を形にし、暮らしの前提を決める年'
  if (flags.meeting && flags.separation) return '新しい縁が入り、続ける関係を選び直す年'
  if (flags.meeting) return flags.work ? '仕事の広がりから、新しい縁が入る年' : '出会いが増え、関係の前提を決める年'
  if (flags.separation) return '曖昧な関係に区切りをつけ、距離を選ぶ年'
  if (flags.work) return flags.money ? '任される範囲と収入の基準が変わる年' : '任される範囲が広がり、断る基準が要る年'
  if (flags.move) return '居場所を動かし、日常の優先順位を変える年'
  if (flags.study) return flags.reset ? '学び直しながら、古い前提を手放す年' : '学び直したことを次の役割へつなぐ年'
  if (flags.money) return '使うお金と残すお金の基準を決める年'
  if (flags.reset) return '続けないものを決め、生活の余白を戻す年'
  const alternatives = ['選ぶ順番を変え、動き方を組み直す年', '守る条件を定め、次の役割へ移る年', '慣れた方法を離れ、新しい基準を試す年']
  return alternatives[stableIndex(values, year, alternatives.length)]
}

function personalLens(day: string) {
  const stem: Record<string, string> = { 甲: '始める力', 乙: '育てる力', 丙: '広げる力', 丁: '磨く力', 戊: '支える力', 己: '整える力', 庚: '決める力', 辛: '選び抜く力', 壬: 'つなぐ力', 癸: '読み取る力' }
  const branch: Record<string, string> = { 子: '流れを変える感覚', 丑: '土台を固める感覚', 寅: '先に動く感覚', 卯: '関係を育てる感覚', 辰: '条件を組み替える感覚', 巳: '機会を見極める感覚', 午: '意思を表す感覚', 未: '周囲と整える感覚', 申: '方法を更新する感覚', 酉: '結果を選ぶ感覚', 戌: '責任を守る感覚', 亥: '可能性を探る感覚' }
  return `${stem[day[0]] ?? '自分で選ぶ力'}と${branch[day[1]] ?? '自分の基準'}`
}

function collisionTitle(item: Annual, values: string[]) {
  const flags = eventFlags(values)
  const branchAction: Record<string, string> = {
    子: '新しい流れを始める', 丑: '足元を固める', 寅: '先に動いて道を作る', 卯: '関係を育てる',
    辰: '条件を組み替える', 巳: '機会を見極める', 午: '意思をはっきり示す', 未: '周囲との形を整える',
    申: '方法を更新する', 酉: '残す結果を選ぶ', 戌: '引き受ける責任を定める', 亥: '次の可能性を探る',
  }
  const action = branchAction[item.kanshi[1]] ?? '選び方を変える'
  if (flags.marriage) return `${action}ことで、二人の暮らしを具体的にする年`
  if (flags.meeting) return `${action}ことで、これから続く縁を選ぶ年`
  if (flags.separation) return `${action}ことで、残す関係を見極める年`
  if (flags.work) return `${action}ことで、引き受ける役割を決める年`
  if (flags.move) return `${action}ことで、新しい日常の土台を作る年`
  if (flags.study) return `${action}ことで、学びを次の役割へ変える年`
  return `${action}ことで、これから守る基準を決める年`
}

function tagsFor(values: string[]) {
  const flags = eventFlags(values)
  return unique(['時期', flags.meeting ? '出会い' : '', flags.marriage ? '結婚' : '', flags.separation ? '関係の見直し' : '',
    flags.work ? '仕事' : '', flags.move ? '引越し・環境変化' : '', flags.study ? '学び' : '', flags.money ? 'お金' : '', flags.reset ? '整理' : '', ...values.slice(0, 2)])
}

function summaryFor(item: Annual) {
  const themes = unique(item.themes)
  const relationships = unique([...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])])
  const event = relationships[0] ?? themes[0] ?? '優先順位の切り替え'
  const second = relationships[1] ?? themes.find(theme => theme !== event) ?? '日常の選択'
  return `${event}と${second}が重なり、${item.kanshi}・${item.tenGod}の動きが具体的な選択として現れる年です。`
}

function pagesFor(input: ReportInput, item: Annual, decade?: Decade): ReportCardPage[] {
  const themes = unique(item.themes)
  const relationships = unique([...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])])
  const core = themes.join('・') || '優先順位の切り替え'
  const events = relationships.join('・') || `${item.tenGod}の働きが強まり、${core}に選択が生まれる`
  const longTerm = decade ? `${decade.startYear}〜${decade.endYear}年の${decade.themes.join('・') || '長期テーマ'}` : '前後の年から続く流れ'
  const flags = eventFlags([...themes, ...relationships])
  const scene = flags.work ? '依頼、担当範囲、働く場所を決める場面' : flags.meeting || flags.marriage ? '出会い方、約束、暮らし方を話す場面' : flags.move ? '住む場所や日々の時間配分を変える場面' : '今まで通り続けるか、方法を変えるか選ぶ場面'
  const caution = flags.marriage ? '気持ちだけで決めず、住居・お金・仕事の条件を分けて確認すること' : flags.work ? '期待に全部応えず、引き受ける範囲と期限を先に決めること' : flags.separation ? '一度の感情で結論を急がず、続ける条件と離れる条件を言葉にすること' : '変える項目を一度に増やさず、生活を守る条件から決めること'
  const action = flags.move ? '候補地、費用、移動時間を並べ、日常が続く案を一つ選ぶ' : flags.meeting || flags.marriage || flags.separation ? '相手に求める約束と、自分が守れる約束を三つずつ書く' : flags.work ? '引き受ける仕事、断る仕事、学ぶ仕事を一つずつ決める' : '続けること、やめること、試すことを一つずつ決める'
  const lens = personalLens(input.shichuDay)
  return [
    { role: 'opening', label: 'この年の焦点', text: summaryFor(item) },
    { role: 'core', label: '起こりやすいこと', text: `${events}という動きが日常の決断に表れ、${lens}が選び方の支えになります。` },
    { role: 'scene', label: '現れやすい場面', text: `${scene}で、何を優先するかがはっきりします。` },
    { role: 'scene', label: '長期の背景', text: `${longTerm}の中で、今年の${core}が具体的な出来事になります。` },
    { role: 'shadow', label: '急がないこと', text: caution },
    { role: 'exception', label: '命式の手がかり', text: `${item.kanshi}と${item.tenGod}が重なるため、同じ出来事でも引き受け方が結果を分けます。` },
    { role: 'action', label: 'この年に決めること', text: `${action}ことから始めてください。` },
    { role: 'closing', label: '次の年へ残すもの', text: `${core}で得た基準を一つ言葉にすると、翌年の判断がぶれにくくなります。` },
  ]
}

function card(input: ReportInput, item: Annual, decade?: Decade): ReportCard {
  const values = unique([...item.themes, ...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])])
  const pages = pagesFor(input, item, decade)
  const details = unique([item.kanshi, item.tenGod, ...values, ...(decade ? [`長期運 ${decade.kanshi}・${decade.tenGod}`] : [])])
  return {
    id: `turning-year-${item.year}`, kind: 'timing', scope: 'self', tab: 'timing', title: titleFor(values, item.year), summary: summaryFor(item),
    tags: tagsFor(values), period: { label: `${item.year}年（${item.ageRange}）` }, pages,
    evidence: [{ family: '干支系', system: '四柱推命', detail: details.join('・').slice(0, 120) }], metadataRefs: ['turningPoints'],
  }
}

function signature(item: Annual) {
  return unique([...item.themes, ...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])]).sort().join('|')
}

export function buildTurningPointCards(input: ReportInput, nowYear = japanDateParts().year): ReportCard[] {
  const start = nowYear - 15
  const end = nowYear + 20
  const allAnnual = [...(input.timing?.annual ?? [])].sort((a, b) => a.year - b.year)
  const inRange = allAnnual.filter(item => item.year >= start && item.year <= end)
  const turningPoints = inRange.filter(item => {
    const previous = allAnnual.find(value => value.year === item.year - 1)
    const relationshipEvent = (item.relationshipSignals?.length ?? 0) > 0 || (item.relationshipEvents?.length ?? 0) > 0
    const changedTheme = previous ? signature(previous) !== signature(item) : false
    return relationshipEvent || item.score >= 8 || (changedTheme && item.score >= 6)
  })
  const selected = turningPoints.length ? turningPoints : [...inRange].sort((a, b) => b.score - a.score || a.year - b.year).slice(0, 3).sort((a, b) => a.year - b.year)
  const results: ReportCard[] = []
  for (const item of selected) {
    const values = unique([...item.themes, ...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])])
    const result = card(input, item, input.timing?.decades.find(period => item.year >= period.startYear && item.year <= period.endYear))
    const previous = results.at(-1)
    const title = previous && titlesAreSimilar(previous.title, result.title) ? collisionTitle(item, values) : result.title
    results.push({ ...result, title })
  }
  return results
}

export function replaceTimingCards(report: StructuredReport, input: ReportInput): StructuredReport {
  const timing = buildTurningPointCards(input)
  if (timing.length === 0) return report
  const cards = [...report.cards.filter(item => item.kind !== 'timing'), ...timing]
  const reportText = cards.flatMap(item => [`【${item.title}】`, ...item.pages.map(page => page.text)]).join('\n\n')
  return { ...report, reportText, cards }
}
