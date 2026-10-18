/** Retrospective hypotheses. No event labels, identity lookup, scores or production admission. */
export const EVENT_PATTERN_POLICY = {
  version: 'event-pattern-study-v1', productionEligible: false, trainingEligible: false, qualityEligible: false,
  outcome: 'undetermined', temporalResolution: 'daily-noon-JST-samples',
  unsupportedAttributes: ['first_relationship', 'same_partner', 'breakup_count', 'legal_marriage', 'infidelity', 'pregnancy'],
} as const

export type EventTheme = 'relationship.contact' | 'relationship.review' | 'relationship.structure'
  | 'career.activity' | 'home.establish' | 'education.activity' | 'money.conditions' | 'identity.change' | 'pressure'
export interface EventFact {
  id: string
  system: '四柱推命・算命学' | '西洋占星術' | 'インド占星術' | '紫微斗数'
  group: 'stem_branch_calendar' | 'astronomical_ephemeris' | 'ziwei_chart'
  kind: 'calendar_relation' | 'western_transit' | 'vedic_period' | 'ziwei_palace' | 'ziwei_mutagen'
  lineage: string
  detail: string
  days: string[]
  themes: EventTheme[]
  transit?: string
  natal?: string
  aspect?: number
  minimumOrb?: number
  houses?: number[]
  period?: { start: string; end: string; major: string; minor: string }
  palace?: string
  mutagen?: string
}

const COPY: Record<EventTheme, { title: string; body: string }> = {
  'relationship.contact': { title: '人との接点や、惹かれ方が動く', body: '交流や人への関心が動く示唆があります。新しく知り合うこと、相手に惹かれること、交際が始まることはそれぞれ別の段階として読みます。' },
  'relationship.review': { title: '近い人との関係や、その条件を見直す', body: '距離や約束、互いの負担を確かめる示唆があります。続けるために形を変えることも、距離を置くことも含み、別れという結末には固定しません。' },
  'relationship.structure': { title: '関わり方を具体的に考える', body: '人との関係が生活の中でどのような位置を占めるかを考える示唆があります。役割や約束の調整を含み、交際成立や入籍を確定するものではありません。' },
  'career.activity': { title: '仕事や役割に動きが生まれる', body: '仕事への参加、担う範囲、活動する環境に関する示唆があります。転職・異動・昇進のどれになるかは、今回の根拠だけでは決まりません。' },
  'home.establish': { title: '家庭や、暮らしの基盤を整える', body: '住む場所、生活の分担、落ち着いて過ごせる環境を具体化する示唆があります。同居・引越し・家庭形成を含む領域ですが、入籍という出来事までは特定しません。' },
  'education.activity': { title: '学ぶことと、その進め方に目を向ける', body: '学び・準備・理解を深めることに関する示唆があります。試験の合否や進学の成立とは分けて、どのように学びへ取り組むかを読みます。' },
  'money.conditions': { title: '収入や、使える資源の条件を考える', body: '収入・待遇・活動を支える資源に関する示唆があります。収入が増えることや特定の金額を確約する読みではありません。' },
  'identity.change': { title: '自分の立ち位置や、活動する場を見直す', body: '周囲との関わり方や生活の前提が動く示唆があります。どの活動を続け、何を変えるかという領域の読みで、特定の出来事を断定しません。' },
  pressure: { title: '負担や制約と、取り組み方を確かめる', body: '気を張ることや、物事の進め方に制約を感じることに関する示唆があります。出来事の深刻さ、病気、不幸を判定するものではありません。' },
}

function overlapDays(facts: readonly EventFact[], predicate: (active: EventFact[]) => boolean) {
  const days = [...new Set(facts.flatMap(f => f.days))].sort()
  return days.filter(day => predicate(facts.filter(f => f.days.includes(day))))
}

export function composeEventPatterns(input: readonly EventFact[]) {
  const byID = new Map<string, EventFact>()
  for (const f of input) {
    if (!f.days.length) continue
    const old = byID.get(f.id)
    if (old && JSON.stringify(old) !== JSON.stringify(f)) throw new Error(`Conflicting event fact: ${f.id}`)
    byID.set(f.id, f)
  }
  const facts = [...byID.values()]
  const make = (id: string, title: string, body: string, evidence: EventFact[], rules: string[]) => ({
    id, title, body, rules, evidence,
    factCount: new Set(evidence.map(f => f.lineage)).size,
    systems: [...new Set(evidence.map(f => f.system))], groups: [...new Set(evidence.map(f => f.group))],
    days: [...new Set(evidence.flatMap(f => f.days))].sort(),
    multiSystemDays: overlapDays(evidence, active => new Set(active.map(f => f.system)).size >= 2),
    crossGroupDays: overlapDays(evidence, active => new Set(active.map(f => f.group)).size >= 2),
    ...EVENT_PATTERN_POLICY,
  })
  const readings = (Object.keys(COPY) as EventTheme[]).flatMap(theme => {
    const evidence = facts.filter(f => f.themes.includes(theme))
    if (!evidence.length) return []
    const rules = ['P06', 'P08'] // Actual period filtering; history attributes never inferred.
    if (evidence.some(f => f.kind === 'calendar_relation')) rules.push('P01')
    if (evidence.some(f => f.kind === 'vedic_period')) rules.push('P03')
    if (evidence.some(f => f.kind.startsWith('ziwei'))) rules.push('P05')
    if (theme === 'home.establish') rules.push('P04')
    if (theme === 'relationship.review' && evidence.some(f => f.transit === '土星' && f.natal === '金星' && [0, 90, 180].includes(f.aspect!))) rules.push('P02')
    return [make(theme, COPY[theme].title, COPY[theme].body, evidence, rules)]
  })
  const combined = (id: string, a: EventTheme, b: EventTheme, title: string, body: string, rule: string) => {
    const evidence = facts.filter(f => f.themes.includes(a) || f.themes.includes(b))
    const days = overlapDays(evidence, active => active.some(f => f.themes.includes(a)) && active.some(f => f.themes.includes(b)))
    if (!days.length) return []
    const combined = make(id, title, body, evidence, [rule, 'P06', 'P08'])
    return [{ ...combined, days, multiSystemDays: combined.multiSystemDays.filter(day => days.includes(day)),
      crossGroupDays: combined.crossGroupDays.filter(day => days.includes(day)) }]
  }
  const combinations = [
    ...combined('contact-and-review', 'relationship.contact', 'relationship.review', '人との接点と、関係の見直しが並ぶ',
      '接点が動く示唆と、関係の条件を見直す示唆が同じ日次サンプルにあります。新しい相手か同じ相手か、開始と終了の順序は未判定です。', 'P07'),
    ...combined('work-and-relationships', 'career.activity', 'relationship.structure', '仕事と対人関係の両方に目が向く',
      '仕事の役割と、人との関わりを具体化する示唆が同じ日次サンプルにあります。職場恋愛や特定の相手との出会いを確定するものではありません。', 'P03'),
  ]
  return { readings, combinations, facts, ...EVENT_PATTERN_POLICY }
}
