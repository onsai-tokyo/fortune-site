/** Developer research only. No FB, identity, random seed or outcome enters selection. */
import { readFileSync } from 'node:fs'
import { calcShichu, calcExpandedDivination, calcSanmei, calcTenGod } from '../lib/divination/index.js'

export interface StructureRow {
  dayPillar: string; dayStem: string; dayBranch: string
  seatPrimaryStem: string; seatPrimaryTenGod: string; twelveStage: string
  centerStar: string; centerTenGod: string; centerStem: string
  relation: { elementRelation: string; polarity: string }
  monthBands: Array<{ monthBranch: string; band: string; from: number; to: number | null }>
  calendar: { first: string }
}
type Chapter = {
  id: string; label: string; scene: string; claim: string[]; negate: string[]; seat: string[]
  advice: Record<string, string>; sceneDetail: string[]; appearance: Record<string, string>
  titleNote: Record<string, string>; titleCore: string[]; titleLead: Record<string, string>
}
type Dictionary = {
  version: string; productionEnabled: false; interpretationStatus: string
  stars: string[]; tenGods: string[]; stems: string[]; keyword: string[]; sectionHeads: string[]
  dayStem: string[]; twelveStage: Record<string, string>; relationBody: Record<string, string>
  relationShape: Record<string, string>; relationAdvice: Record<string, string>
  mismatch: Record<string, string>; chapters: Chapter[]
}
const asset = (name: string) => readFileSync(new URL(`./assets/life-axis-v061/${name}`, import.meta.url), 'utf8')
const dictionary = JSON.parse(asset('copy_dictionary_600.json')) as Dictionary
export const LIFE_AXIS_ROWS = (JSON.parse(asset('structure600.json')) as { rows: StructureRow[] }).rows
export const LIFE_AXIS_VERSION = dictionary.version
const chapter = dictionary.chapters.find(c => c.id === 'life_axis')!
const rowMap = new Map(LIFE_AXIS_ROWS.map(r => [`${r.dayPillar}-${r.centerStar}`, r]))
if (dictionary.productionEnabled !== false || !chapter || rowMap.size !== 600) throw new Error('Invalid research asset')

/** Literal port of the reviewed Python renderer; interpretation has not been validated. */
export function renderLifeAxis(row: StructureRow) {
  const D = dictionary, ch = chapter
  const c = D.stars.indexOf(row.centerStar), s = D.tenGods.indexOf(row.seatPrimaryTenGod)
  const stem = D.stems.indexOf(row.dayStem)
  const rkey = `${row.relation.elementRelation}|${row.relation.polarity}`
  const shape = D.relationShape[rkey]
  if (c < 0 || s < 0 || stem < 0 || !shape || !D.twelveStage[row.twelveStage]) throw new Error('Unrecognized structure')
  const title = `${ch.titleCore[c]}｜${ch.titleLead[rkey]}`
  const bands = row.monthBands.map(b => `${b.monthBranch}月の${b.band}`).join('／')
  const parts = [
    `${ch.scene}\nこの人の場合、${ch.claim[c]}${ch.negate[c]}`,
    D.relationBody[rkey].replaceAll('{c}', D.keyword[c]).replaceAll('{s}', D.keyword[s]),
    ch.sceneDetail[c],
    D.dayStem[stem] + ch.seat[s],
    D.twelveStage[row.twelveStage],
    ch.appearance[shape],
    `この中心星になるのは、月支が${bands}に該当する場合です。同じ${row.dayPillar}でも、生まれた月と節入りからの日数が違えば別の中心星になり、読みも変わります。境界の日に生まれている場合は、出生時刻によって中心星が変わることがあります。なお本鑑定の入力は日柱と中心星の2つだけで、月支の違いは出力に反映されません。`,
  ]
  const body = ch.titleNote[shape] + parts.map((p, i) => `\n\n**${D.sectionHeads[i]}**\n${p}`).join('')
  const advice = ch.advice[shape] + D.relationAdvice[rkey] + D.mismatch[shape]
  return {
    chapterId: ch.id, chapterLabel: ch.label, title, body, advice,
    stableKey: `${row.dayPillar}-${row.centerStar}::${ch.id}`,
    ruleId: `RULE:${ch.id}:day=${row.dayPillar}:center=${row.centerStar}:seat=${row.seatPrimaryTenGod}:rel=${rkey}:stage=${row.twelveStage}`,
    dictVersion: D.version,
    conditions: {
      dayPillar: row.dayPillar, dayStem: row.dayStem, dayBranch: row.dayBranch,
      seatPrimaryStem: row.seatPrimaryStem, seatPrimaryTenGod: row.seatPrimaryTenGod,
      twelveStage: row.twelveStage, centerStar: row.centerStar, centerTenGod: row.centerTenGod,
      centerStem: row.centerStem, relation: row.relation.elementRelation, polarity: row.relation.polarity, shape, monthBands: bands,
    },
    charCount: [...body].length + [...title].length + [...advice].length,
  }
}

/** Only the selectors for each paragraph, never the entire chart as apparent support. */
export function explainLifeAxis(row: StructureRow) {
  const c = dictionary.stars.indexOf(row.centerStar), s = dictionary.tenGods.indexOf(row.seatPrimaryTenGod)
  const rkey = `${row.relation.elementRelation}|${row.relation.polarity}`
  const shape = dictionary.relationShape[rkey]
  return [
    { heading: dictionary.sectionHeads[0], selectors: [`中心星=${row.centerStar}`], dictionaryKeys: [`chapters.life_axis.claim[${c}]`, `chapters.life_axis.negate[${c}]`], note: '場面の導入は共通文です。主張と否定は中心星10種類から選びます。' },
    { heading: dictionary.sectionHeads[1], selectors: [`中心の採用蔵干=${row.centerStem}`, `日支の本気=${row.seatPrimaryStem}`, `五行の関係=${rkey}`], dictionaryKeys: [`relationBody.${rkey}`, `keyword[${c}]`, `keyword[${s}]`], note: '中心星と座下は共通の干支計算から派生します。独立した2占術の一致という数え方はしません。' },
    { heading: dictionary.sectionHeads[2], selectors: [`中心星=${row.centerStar}`], dictionaryKeys: [`chapters.life_axis.sceneDetail[${c}]`], note: '具体的な行動例は辞書の解釈仮説です。計算で行動の事実を確認したわけではありません。' },
    { heading: dictionary.sectionHeads[3], selectors: [`日干=${row.dayStem}`, `日支本気=${row.seatPrimaryStem}（${row.seatPrimaryTenGod}）`], dictionaryKeys: [`dayStem[${dictionary.stems.indexOf(row.dayStem)}]`, `chapters.life_axis.seat[${s}]`], note: '前半は日干、後半は四柱推命の固定蔵干の本気で選択。算命学の西の星とは別です。' },
    { heading: dictionary.sectionHeads[4], selectors: [`日柱=${row.dayPillar}`, `十二運=${row.twelveStage}`], dictionaryKeys: [`twelveStage.${row.twelveStage}`], note: '日干と日支で決まる十二運です。四柱全体の旺衰は使用していません。' },
    { heading: dictionary.sectionHeads[5], selectors: [`五行・陰陽の関係=${rkey}`, `文章の型=${shape}`], dictionaryKeys: [`chapters.life_axis.appearance.${shape}`], note: '3種類の共通文です。同じ型なら同じ文章になります。' },
    { heading: dictionary.sectionHeads[6], selectors: [`日柱=${row.dayPillar}`, `中心星=${row.centerStar}`], dictionaryKeys: ['structure600.rows.monthBands'], note: '該当可能な月支・日数帯の一覧です。本人の実際の月支と日数は上の計算表を参照してください。' },
  ]
}

export type LifeAxisBirth = { birthDate: string; birthTime?: string | null }
export interface LifeAxisEvidence {
  dayPillar: string; dayStem: string; dayBranch: string; monthBranch: string; jieDays: number
  centerStar: string; centerTenGod: string; centerStem: string
  seatPrimaryStem: string; seatPrimaryTenGod: string; twelveStage: string
  relation: string; polarity: string; sanmeiWestStar: string
}
export interface LifeAxisCalculation { row: StructureRow; evidence: LifeAxisEvidence }
function parseBirth(birth: LifeAxisBirth) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth.birthDate)) throw new Error('Invalid birth date')
  const [year, month, day] = birth.birthDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (year < 1900 || year > 2100 || date.toISOString().slice(0, 10) !== birth.birthDate) throw new Error('Invalid birth date')
  if (birth.birthTime == null || birth.birthTime === '') return { year, month, day, minute: null }
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(birth.birthTime)
  if (!match || +match[1] > 23 || +match[2] > 59) throw new Error('Invalid birth time')
  return { year, month, day, minute: +match[1] * 60 + +match[2] }
}
export function calculateLifeAxisMinute(birthDate: string, minute: number): LifeAxisCalculation {
  const { year, month, day } = parseBirth({ birthDate })
  if (!Number.isInteger(minute) || minute < 0 || minute >= 1440) throw new Error('Invalid minute')
  const shichu = calcShichu(year, month, day, Math.floor(minute / 60), minute % 60)
  const expanded = calcExpandedDivination(shichu)
  const pillar = expanded.fourPillars.find(p => p.key === 'day')!
  const centerStar = calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays).shukumeiStar
  const row = rowMap.get(`${pillar.kanshi}-${centerStar}`)
  if (!row || centerStar !== expanded.sanmeiChart.bodyChart.center.star) throw new Error('Center or structure mismatch')
  const centerTenGod = dictionary.tenGods[dictionary.stars.indexOf(centerStar)]
  const stems = dictionary.stems.filter((_, i) => calcTenGod(shichu.day.stemIdx, i) === centerTenGod)
  if (stems.length !== 1) throw new Error('Ambiguous center stem')
  const centerStem = stems[0], seat = pillar.hiddenStems[0]
  const ce = Math.floor(dictionary.stems.indexOf(centerStem) / 2), se = Math.floor(dictionary.stems.indexOf(seat.stem) / 2)
  const relation = ce === se ? '同五行' : (ce + 1) % 5 === se ? '中心→座下を生じる'
    : (se + 1) % 5 === ce ? '座下→中心を生じる' : (ce + 2) % 5 === se ? '中心→座下を剋す' : '座下→中心を剋す'
  const polarity = dictionary.stems.indexOf(centerStem) % 2 === dictionary.stems.indexOf(seat.stem) % 2 ? '同' : '異'
  const actual = { dayPillar: pillar.kanshi, dayStem: pillar.stem, dayBranch: pillar.branch, centerStar, centerTenGod, centerStem,
    seatPrimaryStem: seat.stem, seatPrimaryTenGod: seat.tenGod, twelveStage: pillar.twelveStage }
  for (const key of Object.keys(actual) as Array<keyof typeof actual>) if (row[key] !== actual[key]) throw new Error(`Structure mismatch: ${key}`)
  if (row.relation.elementRelation !== relation || row.relation.polarity !== polarity) throw new Error('Relation mismatch')
  if (!row.monthBands.some(b => b.monthBranch === shichu.month.branch && b.from <= shichu.jieDays && (b.to == null || shichu.jieDays <= b.to))) throw new Error('Month band mismatch')
  return { row, evidence: { ...actual, monthBranch: shichu.month.branch, jieDays: shichu.jieDays, relation, polarity,
    sanmeiWestStar: expanded.sanmeiChart.bodyChart.west.star } }
}

/** Scan every representable civil minute in JST. Counts are coverage, not birth probabilities. */
export function evaluateLifeAxis(birth: LifeAxisBirth, calculator = calculateLifeAxisMinute) {
  const parsed = parseBirth(birth)
  const minutes = parsed.minute === null ? Array.from({ length: 1440 }, (_, i) => i) : [parsed.minute]
  const samples: Array<{ minute: number; result: LifeAxisCalculation }> = []
  try {
    for (const minute of minutes) samples.push({ minute, result: calculator(birth.birthDate, minute) })
  } catch (error) {
    return { status: 'unavailable' as const, expectedMinutes: minutes.length, scannedMinutes: samples.length,
      reason: error instanceof Error ? error.message : 'Calculation failed', candidates: [], certainty: {} }
  }
  const groups = new Map<string, { row: StructureRow; samples: typeof samples }>()
  for (const sample of samples) {
    const key = `${sample.result.row.dayPillar}-${sample.result.row.centerStar}`
    const group = groups.get(key) ?? { row: sample.result.row, samples: [] }
    group.samples.push(sample); groups.set(key, group)
  }
  const candidates = [...groups.values()].map(group => {
    const intervals: Array<{ from: number; to: number }> = []
    for (const { minute } of group.samples) {
      const prev = intervals.at(-1)
      if (prev && prev.to + 1 === minute) prev.to = minute
      else intervals.push({ from: minute, to: minute })
    }
    return { reading: renderLifeAxis(group.row), selectors: explainLifeAxis(group.row), intervals,
      minuteCount: group.samples.length,
      evidenceVariants: [...new Map(group.samples.map(s => [JSON.stringify(s.result.evidence), s.result.evidence])).values()] }
  })
  const keys = Object.keys(samples[0].result.evidence) as Array<keyof LifeAxisEvidence>
  const certainty = Object.fromEntries(keys.map(key => {
    const values = [...new Set(samples.map(s => s.result.evidence[key]))]
    return [key, { status: values.length === 1 ? 'invariant' : 'variable', values }]
  }))
  return { status: candidates.length === 1 ? 'resolved' as const : 'multiple' as const,
    expectedMinutes: minutes.length, scannedMinutes: samples.length, candidates, certainty }
}
