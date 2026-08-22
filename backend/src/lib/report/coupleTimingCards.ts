import type { ReportCard, StructuredReport } from '../reportCards.js'

export interface CoupleAnnualTiming {
  year: number
  score: number
  themes: string[]
}

export interface CoupleTurningPoint {
  year: number
  selfAge: number
  partnerAge: number
  kind: 'aligned' | 'divergent' | 'self-heavy' | 'partner-heavy'
  selfThemes: string[]
  partnerThemes: string[]
  score: number
}

const kindCopy = {
  aligned: {
    titles: ['同じ方向へ動くほど、二人の歩幅がそろう年', '重なる願いを、二人の選択へ変える年', '一緒に決めることが、次の景色を開く年'],
    summary: '二人の関心が重なりやすく、一緒に決めて進むことで関係が育つ節目です。',
  },
  divergent: {
    titles: ['違う方向を向くからこそ、約束を選び直す年', '別々の課題を、戻れる場所へつなぐ年', '歩幅の違いから、二人の距離を整え直す年'],
    summary: 'それぞれが別の課題へ向かいやすく、距離と役割を言葉にすることが必要な節目です。',
  },
  'self-heavy': {
    titles: ['あなたの変化を、二人の暮らしへなじませる年', 'あなたの決断を、二人の安心へつなぐ年', '先に進むあなたが、相手へ経過を渡す年'],
    summary: 'あなた側の動きが大きくなりやすく、相手に経過を伝えるほど安心が育つ節目です。',
  },
  'partner-heavy': {
    titles: ['相手の変化を、二人で受け止め直す年', '相手の転換を、二人の暮らしで支える年', '変わる相手と、無理のない約束を結ぶ年'],
    summary: '相手側の動きが大きくなりやすく、急がせず支え方を確かめることが鍵になる節目です。',
  },
} as const

function sharedThemes(selfThemes: string[], partnerThemes: string[]) {
  return selfThemes.filter(theme => partnerThemes.includes(theme))
}

function classify(self: CoupleAnnualTiming, partner: CoupleAnnualTiming): CoupleTurningPoint['kind'] {
  if (sharedThemes(self.themes, partner.themes).length > 0) return 'aligned'
  if (self.score >= partner.score + 2) return 'self-heavy'
  if (partner.score >= self.score + 2) return 'partner-heavy'
  return 'divergent'
}

function themeText(themes: string[]) {
  return themes.slice(0, 2).join('、') || '足元を整えること'
}

export function findCoupleTurningPoints(
  selfAnnual: CoupleAnnualTiming[],
  partnerAnnual: CoupleAnnualTiming[],
  selfBirthYear: number,
  partnerBirthYear: number,
  currentYear = new Date().getFullYear(),
): CoupleTurningPoint[] {
  const partnerByYear = new Map(partnerAnnual.map(item => [item.year, item]))
  const candidates = selfAnnual.flatMap(self => {
    const partner = partnerByYear.get(self.year)
    if (!partner || self.year < currentYear - 5 || self.year > currentYear + 10) return []
    const kind = classify(self, partner)
    const overlap = sharedThemes(self.themes, partner.themes).length
    return [{
      year: self.year,
      selfAge: self.year - selfBirthYear,
      partnerAge: self.year - partnerBirthYear,
      kind,
      selfThemes: self.themes,
      partnerThemes: partner.themes,
      score: self.score + partner.score + overlap * 2 + (kind === 'divergent' ? 1 : 0),
    }]
  })
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.year - b.year)
  const selected = ranked.slice(0, Math.min(10, ranked.length))
  const divergent = ranked.find(item => item.kind === 'divergent')
  if (divergent && !selected.some(item => item.kind === 'divergent') && selected.length > 0) selected[selected.length - 1] = divergent
  const pastDivergent = ranked.find(item => item.year < currentYear && item.kind === 'divergent')
  if (pastDivergent && !selected.some(item => item.year === pastDivergent.year) && selected.length > 0) selected[selected.length - 1] = pastDivergent
  return [...new Map(selected.map(item => [item.year, item])).values()].sort((a, b) => a.year - b.year)
}

export function buildCoupleTimingCards(points: CoupleTurningPoint[]): ReportCard[] {
  const occurrences = new Map<CoupleTurningPoint['kind'], number>()
  const usedTitles = new Set<string>()
  const firstFutureYear = points.find(point => point.year >= new Date().getFullYear())?.year
  return points.map(point => {
    const copy = kindCopy[point.kind]
    const occurrence = occurrences.get(point.kind) ?? 0
    occurrences.set(point.kind, occurrence + 1)
    let title: string = copy.titles[occurrence] ?? `${copy.titles[copy.titles.length - 1]}――${themeText(point.selfThemes)}`
    if (usedTitles.has(title)) title = `${copy.titles[copy.titles.length - 1]}――${point.year}年に選び直すこと`
    usedTitles.add(title)
    const selfTheme = themeText(point.selfThemes)
    const partnerTheme = themeText(point.partnerThemes)
    const pages: ReportCard['pages'] = [
      { role: 'opening', label: 'この年の二人', text: copy.summary },
      { role: 'core', label: 'あなたに起きること', text: `あなたは「${selfTheme}」へ意識が向きます。変えたいことを小さく共有すると、相手も置いていかれません。` },
      { role: 'core', label: '相手に起きること', text: `相手は「${partnerTheme}」を大切にします。結論を急がず、何を守りたいかを聞く時間が二人を整えます。` },
      { role: 'scene', label: '関係が動く場面', text: point.kind === 'aligned' ? '同じ話題に自然と目が向きます。暮らしや将来の選択を一緒に決めるほど、信頼が形になります。' : '予定や優先順位の違いが表に出ます。違いを拒絶と受け取らず、別々の時間も約束に含めてください。' },
      { role: 'shadow', label: 'すれ違いやすいとき', text: point.kind === 'self-heavy' ? 'あなたの決断が先に進み、説明が後になると相手は不安になります。途中の迷いも伝えることが必要です。' : point.kind === 'partner-heavy' ? '相手の変化を待つ間、あなたが我慢だけを重ねると距離が広がります。できることと難しいことを分けてください。' : '分かっているはずという期待が、短い返事や沈黙を誤解へ変えます。大切なことほど言葉を省かないでください。' },
      { role: 'exception', label: '見落としたくないこと', text: '同じ速さで進むことだけが親密さではありません。互いの変化を知り、戻れる場所を保つことも二人の強さです。' },
      { role: 'question', label: '二人で確かめること', text: `この年に守りたいものと、変えてもよいものを一つずつ話してください。答えの違いが、次の約束を具体的にします。` },
      { role: 'closing', label: 'この年の鍵', text: point.kind === 'aligned' ? '一緒に選ぶ回数を増やすこと。二人の意思が同じ場所に積み重なり、次の節目を支えます。' : '違いをなくすのではなく、扱い方を決めること。その約束が二人らしい距離をつくります。' },
    ]
    return {
      id: `couple-timing-${point.year}`,
      kind: 'timing',
      tab: 'timing',
      title,
      summary: copy.summary,
      tags: ['二人の節目', point.kind],
      period: { label: `${point.year === firstFutureYear ? 'これから　' : ''}${point.year}年（あなた${point.selfAge}歳・相手${point.partnerAge}歳）` },
      pages,
      evidence: [
        { family: '本人の年運', system: '年ごとの推移', detail: `${point.year}: score=${point.score}; themes=${point.selfThemes.join('/')}` },
        { family: '相手の年運', system: '年ごとの推移', detail: `${point.year}: themes=${point.partnerThemes.join('/')}; kind=${point.kind}` },
      ],
      metadataRefs: [`self.timing.annual.${point.year}`, `partner.timing.annual.${point.year}`],
    }
  })
}

export function appendCoupleTimingCards(report: StructuredReport, cards: ReportCard[]): StructuredReport {
  const combined = [...report.cards.filter(card => card.tab !== 'timing' && card.kind !== 'timing'), ...cards]
  return {
    ...report,
    cards: combined,
    reportText: combined.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n'),
  }
}
