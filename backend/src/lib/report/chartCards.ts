import type { ReportCard } from '../reportCards.js'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function page(label: string, value: string) {
  return { role: 'core' as const, label, text: value.slice(0, 120) }
}

export function buildChartCards(calculatedData: unknown): ReportCard[] {
  const data = record(calculatedData)
  const pillars = [
    ['年柱', text(data.shichuYear) ?? '算出なし'],
    ['月柱', text(data.shichuMonth) ?? '算出なし'],
    ['日柱', text(data.shichuDay) ?? '算出なし'],
    ['時柱', text(data.shichuHour) ?? '出生時刻未入力のため算出なし'],
  ] as const
  const hasPillars = pillars.some(([, value]) => value && !value.includes('算出なし'))

  const elementBalance = record(data.elementBalance)
  const scores = record(elementBalance.scores)
  const elements = ['木', '火', '土', '金', '水'].map(name => [name, typeof scores[name] === 'number' ? scores[name] as number : null] as const)
  const hasElements = elements.some(([, score]) => score !== null)
  const missing = elements.filter(([, score]) => score === 0).map(([name]) => name)

  const sanmei = record(data.sanmei)
  const easternValues = [
    ['納音', text(data.nayin)],
    ['宿命星', text(data.sanmeiStar) ?? text(sanmei.shukumeiStar)],
    ['天中殺', text(data.chusatsu) ?? text(sanmei.chusatsu)],
    ['宿曜', text(data.sukuyo) ? `${text(data.sukuyo)}宿` : null],
    ['九星気学', text(data.honmeiName)],
    ['数秘術', typeof data.lifePathNumber === 'number' ? `運命数 ${data.lifePathNumber}` : null],
  ] as const
  const easternPages = easternValues.flatMap(([label, value]) => value ? [page(label, value)] : [])

  const cards: ReportCard[] = []
  if (hasPillars) cards.push({
    id: 'chart-four-pillars', kind: 'chart', tab: 'chart', title: '四つの柱が示す生まれ持った配置',
    summary: pillars.map(([label, value]) => `${label} ${value}`).join('・'), tags: ['四柱推命', '命式'], period: null,
    pages: pillars.map(([label, value]) => page(label, value)),
    evidence: [{ family: '干支系', system: '四柱推命', detail: '出生年月日と出生時刻から算出した四柱' }],
  })
  if (hasElements) cards.push({
    id: 'chart-elements', kind: 'chart', tab: 'chart', title: '五行の強弱を数字で確かめる',
    summary: missing.length ? `${missing.join('・')}が0です。欠落ではなく、意識して補う要素として読みます。` : '木・火・土・金・水の配分を表示します。',
    tags: ['五行', ...(missing.length ? ['0の要素'] : [])], period: null,
    pages: elements.filter((entry): entry is readonly [string, number] => entry[1] !== null).map(([label, value]) => page(label, `${value}${value === 0 ? '（0の要素）' : ''}`)),
    evidence: [{ family: '干支系', system: '五行バランス', detail: text(elementBalance.method) ?? '天干と蔵干から算出' }],
  })
  if (easternPages.length) cards.push({
    id: 'chart-cross-systems', kind: 'chart', tab: 'chart', title: '複数の占術で命式を照らし合わせる',
    summary: easternPages.map(item => `${item.label} ${item.text}`).join('・').slice(0, 120), tags: ['算命学', '宿曜', '九星気学'], period: null,
    pages: easternPages, evidence: [{ family: '統合系', system: '複数占術', detail: '同じ出生条件から個別に算出' }],
  })
  return cards
}
