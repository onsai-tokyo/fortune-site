/**
 * Timeline v3 — the person's own nature in each year (parts: data/personalParts.json, v2.11).
 *   stem:      day stem (10) × the year stem's ten-god group (5) × 3 variants — how the year meets the person's core nature
 *              (wording follows the day-stem profiles of the self report: DAY_STEM in deterministicReport.ts).
 *   structure: month-branch main stem's group (才能の土台, 5) × year group (5) × 2 variants. Needs a fixed month pillar.
 * Variants rotate by how many earlier adult years had the same year group, so the yin/yang pair inside a decade and the
 * same group ten years later read differently. Nothing here changes any judgement.
 */
import { readFileSync } from 'node:fs'
import type { ReportCardEvidence } from '../../reportCards.js'
import { tenGod, type TimelineContext } from './signals.js'
import { pillars } from '../annual3600/engine.js'
import { cycleIndex } from '../annual3600/catalog.js'

let PERSONAL: any
export function personalParts(): any {
  PERSONAL ??= JSON.parse(readFileSync(new URL('./data/personalParts.json', import.meta.url), 'utf8'))
  return PERSONAL
}

type Group = 'self' | 'expr' | 'wealth' | 'duty' | 'learn'
const GROUP: Record<string, Group> = { 比肩: 'self', 劫財: 'self', 食神: 'expr', 傷官: 'expr', 偏財: 'wealth', 正財: 'wealth', 偏官: 'duty', 正官: 'duty', 偏印: 'learn', 印綬: 'learn', 正印: 'learn' }
const MAIN: Record<string, string> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' }
const LABEL: Record<Group, string> = { self: '比劫', expr: '食傷', wealth: '財星', duty: '官星', learn: '印星' }

const yearGroup = (ctx: TimelineContext, year: number) => GROUP[tenGod(ctx.natal.natal.day![0], pillars[cycleIndex(year)][0])]

export interface PersonalLines { stem: string; structure: string | null; evidence: ReportCardEvidence[] }

export function personalLines(ctx: TimelineContext, year: number): PersonalLines | null {
  const P = personalParts()
  const ds = ctx.natal.natal.day![0]
  const yg = yearGroup(ctx, year)
  if (!yg || !P.stem[ds]?.[yg]) return null
  let seen = 0
  for (let y = ctx.birthYear + 18; y < year; y++) if (yearGroup(ctx, y) === yg) seen++
  const stemList: string[] = P.stem[ds][yg]
  const stem = stemList[seen % stemList.length]
  const month = ctx.natal.natal.month
  const mg = month ? GROUP[tenGod(ds, MAIN[month[1]])] : undefined
  const structList: string[] | undefined = mg ? P.structure[mg]?.[yg] : undefined
  // 0,1,1,0,0,1,… : the consecutive yin/yang pair differs, and the next decade starts from the other one
  const structure = structList ? structList[(seen + Math.floor(seen / 2)) % structList.length] : null
  const y = pillars[cycleIndex(year)]
  const evidence: ReportCardEvidence[] = [{ family: 'timeline-v3', system: '四柱推命', detail: `本人の性質：日干${ds}×年干${y[0]}（${LABEL[yg]}）${mg ? `、月令${MAIN[month![1]]}（${LABEL[mg]}）` : ''}` }]
  return { stem, structure, evidence }
}
