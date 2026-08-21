import type { ChartSection } from '../reportCards.js'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function text(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildChartSections(calculatedData: unknown): ChartSection[] {
  const data = record(calculatedData)
  const hasKnownValue = ['shichuYear', 'shichuMonth', 'shichuDay', 'lifePathNumber', 'honmeiName', 'nayin', 'sukuyo']
    .some(key => data[key] !== undefined && data[key] !== null)
  if (!hasKnownValue) return []

  const rawPillars = Array.isArray(data.fourPillars) ? data.fourPillars.map(record) : []
  const fallbackPillars = [
    { label: '年柱', kanshi: text(data.shichuYear) }, { label: '月柱', kanshi: text(data.shichuMonth) },
    { label: '日柱', kanshi: text(data.shichuDay) }, { label: '時柱', kanshi: text(data.shichuHour, '—（出生時刻が必要）') },
  ]
  const pillars = rawPillars.length ? rawPillars.map(item => ({
    label: text(item.label), kanshi: text(item.kanshi), stemTenGod: text(item.stemTenGod),
    hidden: Array.isArray(item.hiddenStems) ? item.hiddenStems.map(value => { const hidden = record(value); return `${text(hidden.stem)} ${text(hidden.tenGod)}` }).join('・') : '—',
  })) : fallbackPillars.map(item => ({ ...item, stemTenGod: '—', hidden: '—' }))

  const scores = record(record(data.elementBalance).scores)
  const elementBars = ['木', '火', '土', '金', '水'].map(label => {
    const value = number(scores[label]) ?? 0
    return { label, value, max: Math.max(1, ...['木', '火', '土', '金', '水'].map(name => number(scores[name]) ?? 0)), isZero: value === 0 }
  })

  const bodyChart = record(record(data.sanmeiChart).bodyChart)
  const bodyPositions: Array<[string, string]> = [['north', '北（頭）'], ['west', '西（右手）'], ['center', '中央（胸）'], ['east', '東（左手）'], ['south', '南（腹）']]
  const sanmeiGrid = bodyPositions.map(([key, fallback]) => {
    const item = record(bodyChart[key]); return { position: text(item.label, fallback), value: text(item.star, key === 'center' ? text(data.sanmeiStar) : '—') }
  })

  const kyusei = record(data.kyuseiProfile)
  const numerology = record(data.numerologyProfile)
  const ziwei = record(data.ziwei)
  const palaces = Array.isArray(ziwei.palaces) ? ziwei.palaces.map(record) : []
  const ziweiNames = ['命宮', '官禄宮', '財帛宮', '夫妻宮', '遷移宮', '福徳宮']
  const ziweiGrid = ziweiNames.map(name => {
    const palace = palaces.find(item => text(item.name) === name)
    if (!palace) return { position: name, value: '—（出生時刻が必要）' }
    const stars = Array.isArray(palace.majorStars) ? palace.majorStars.map(value => text(record(value).name)).filter(value => value !== '—') : []
    return { position: name, value: stars.join('・') || '主星なし' }
  })

  return [
    { id: 'chart-four-pillars', system: '四柱推命', title: '四柱推命', layout: 'table', table: { headers: ['柱', '干支', '通変星', '蔵干'], rows: pillars.map(item => [item.label, item.kanshi, item.stemTenGod, item.hidden]) } },
    { id: 'chart-elements', system: '五行', title: '五行バランス', layout: 'bars', bars: elementBars, note: text(record(data.elementBalance).method, '木・火・土・金・水の配分です。0は欠落ではなく、意識して補う要素として読みます。') },
    { id: 'chart-sanmei', system: '算命学', title: '人体星図', layout: 'grid', grid: sanmeiGrid, note: `天中殺 ${text(data.chusatsu)}` },
    { id: 'chart-kyusei', system: '九星気学', title: '九星気学', layout: 'table', table: { headers: ['盤', '星'], rows: [
      ['年', text(kyusei.yearStar, text(data.honmeiName))], ['月', text(kyusei.monthStar)], ['日', text(kyusei.dayStar)], ['時', text(kyusei.timeStar, '—（出生時刻が必要）')],
    ] } },
    { id: 'chart-numerology', system: '数秘術', title: '数秘術', layout: 'list', list: [
      { label: 'ライフパス', value: String(number(data.lifePathNumber) ?? '—'), note: '人生全体で繰り返すテーマ' },
      { label: '誕生数', value: String(number(numerology.birthDayNumber) ?? '—'), note: '生まれ持った得意分野' },
      { label: '態度数', value: String(number(numerology.attitudeNumber) ?? '—'), note: '第一印象と行動の入口' },
      { label: '個人年', value: String(number(numerology.personalYearNumber) ?? '—'), note: number(numerology.personalYear) ? `${numerology.personalYear}年のテーマ` : '今年のテーマ' },
    ] },
    { id: 'chart-ziwei', system: '紫微斗数', title: '紫微斗数', layout: 'grid', grid: ziweiGrid, note: ziwei.available === true ? `命宮 ${text(ziwei.earthlyBranchOfSoulPalace)}・身宮 ${text(ziwei.earthlyBranchOfBodyPalace)}` : text(ziwei.reason, '出生時刻が必要です。') },
    { id: 'chart-lunar', system: '宿曜・納音', title: '宿曜・納音', layout: 'list', list: [
      { label: '本命宿', value: `${text(data.sukuyo)}宿` }, { label: '納音', value: text(data.nayin) },
    ] },
  ]
}
