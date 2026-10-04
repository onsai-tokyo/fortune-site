/**
 * Timeline v3 — per-area paragraphs and 「この年が響く場所」 (parts: data/areaParts.json).
 *   areas:  恋愛・人との関わり / 仕事・活動 / 暮らし・自分の時間, written per ten-god (3 variants each), plus a closing
 *           sentence for the relationship paragraph chosen by the person's current status and whether the year moves.
 *   palace: how the year's branch meets the natal year / month / day / hour branches (family, work, close people, plans).
 * Past years keep only the first (descriptive) sentence of each ten-god entry and never get the forward-looking closing.
 */
import { readFileSync } from 'node:fs'
import type { ReportCardEvidence } from '../../reportCards.js'
import { branchRelations, decideYear, type BranchRelation, type TimelineContext, type YearDecision } from './signals.js'
import { pillars } from '../annual3600/engine.js'
import { cycleIndex } from '../annual3600/catalog.js'

let AREAS: any
export function areaParts(): any {
  AREAS ??= JSON.parse(readFileSync(new URL('./data/areaParts.json', import.meta.url), 'utf8'))
  return AREAS
}

/** Explicit, domain-local vocabulary map for people who are not employed/independent (same map as annual3600). */
export function neutralActivityText(text: string) {
  text = text.replaceAll('研修や資格学習に取り組む', '必要な知識を学ぶ').replaceAll('必要な資格・手続き・知識をそろえ', '必要な知識や手続きをそろえ').replaceAll('顧客や相手', '関わる相手')
  const words: [string, string][] = [['働き方', '取り組み方'], ['職責', '責任'], ['社内', '所属先での'], ['顧客', '交流相手'], ['収入', '得られる成果'], ['転職', '活動の場の変更'], ['昇進', '役割の広がり'], ['同業者', '同じ分野の人'], ['取引先', '協力相手'], ['職場', '活動の場'], ['仕事', '活動'], ['業務', '取り組み'], ['案件', '課題'], ['研修', '学び'], ['資格', '知識'], ['報酬', '成果'], ['給与', '活動条件'], ['上司', '相談相手'], ['部下', '協力する人'], ['同僚', '仲間'], ['勤務', '活動'], ['会社', '所属先']]
  return words.reduce((s, [from, to]) => s.replaceAll(from, to), text)
}

const first = (t: string) => t.split(/(?<=。)/)[0]
const pastize = (t: string) => t.split(/(?<=。)/).filter(Boolean).map(x => x.replace(/です。$/, 'でした。').replace(/ます。$/, 'ました。')).join('')

const pickRot = (list: string[], seen: number, ctx: TimelineContext) => list[(seen + ctx.natal.dayIndex) % list.length]

export interface AreaTexts { relationship: string; career: string; life: string }

export function areaTexts(ctx: TimelineContext, d: YearDecision, variant: number, past: boolean): AreaTexts {
  const A = areaParts()
  const god = d.signals.tenGod === '印綬' ? '正印' : d.signals.tenGod
  const w = ctx.input.workContext
  const working = w === 'employed' || w === 'independent'
  const work = (t: string) => working ? t : neutralActivityText(t)
  const lv = (variant + 1) % 3 // life is offset from relationship/work so the three paragraphs do not share one angle
  if (past) {
    // The person's status and work at that time are unknown: describe the year, then offer what it may have looked like.
    // The reflection comes from the next variant so that it adds a different angle instead of restating the first sentence.
    return {
      relationship: pastize(first(A.rel[god][variant])) + A.relPast[god][(variant + 1) % 3],
      career: work(pastize(first(A.work[god][variant])) + A.workPast[god][(variant + 1) % 3]),
      life: pastize(first(A.life[god][lv])) + A.lifePast[god][(lv + 1) % 3],
    }
  }
  const status = ctx.input.relationshipStatus ?? 'unknown'
  const moving = d.theme === 'relationship' || d.theme === 'trust'
  // closings rotate by how many earlier adult years had the same mode (range-independent), so neighbouring years never share one
  const mode = moving ? 'moving' : 'calm', workMode = d.career ? 'moving' : 'calm'
  let relSeen = 0, workSeen = 0
  for (let y = ctx.birthYear + 18; y < d.signals.year; y++) {
    const x = decideYear(ctx, y)
    if (((x.theme === 'relationship' || x.theme === 'trust') ? 'moving' : 'calm') === mode) relSeen++
    if ((x.career ? 'moving' : 'calm') === workMode) workSeen++
  }
  const wk = w === 'employed' || w === 'independent' || w === 'student' ? w : 'other'
  return {
    relationship: A.rel[god][variant] + pickRot(A.closing[status][mode], relSeen, ctx),
    career: work(A.work[god][variant]) + pickRot(A.workClosing[wk][workMode], workSeen, ctx),
    life: A.life[god][lv],
  }
}

type PalaceKind = 'clash' | 'friction' | 'bond' | 'team'
const KIND: Partial<Record<BranchRelation, PalaceKind>> = { 冲: 'clash', 刑: 'friction', 自刑: 'friction', 害: 'friction', 破: 'friction', 六合: 'bond', 三合: 'team' }
const PRIORITY: BranchRelation[] = ['冲', '刑', '自刑', '害', '破', '六合', '三合']
const COLUMNS = ['month', 'year', 'hour', 'day'] as const
const LABEL: Record<string, string> = { year: '年支', month: '月支', day: '日支', hour: '時支' }

function palaceHits(ctx: TimelineContext, year: number) {
  const branch = pillars[cycleIndex(year)][1]
  const out: Array<{ col: typeof COLUMNS[number]; kind: PalaceKind; rel: BranchRelation; natal: string; branch: string }> = []
  for (const col of COLUMNS) {
    const p = ctx.natal.natal[col]
    if (!p) continue
    const rels = branchRelations(p[1], branch)
    const rel = PRIORITY.find(r => rels.includes(r))
    if (!rel) continue
    const kind = KIND[rel]!
    out.push({ col, kind, rel, natal: p[1], branch })
  }
  return out
}

export function palaceParagraph(ctx: TimelineContext, year: number, past = false): { text: string; basis: string; evidence: ReportCardEvidence[]; terms: string[] } {
  const A = areaParts()
  const hits = palaceHits(ctx, year)
  // variant = how many times the same column/kind occurred since birth, so repeats are as far apart as possible
  const occurrences = (col: string, kind: string) => {
    let n = 0
    for (let y = Math.max(1952, ctx.birthYear); y < year; y++) {
      const hs = palaceHits(ctx, y)
      if (col === 'none' ? hs.length === 0 : hs.some(h => h.col === col && h.kind === kind)) n++
    }
    return n
  }
  const text = hits.length
    ? hits.map(h => { const list: string[] = A.palace[h.col][h.kind]; const t = list[occurrences(h.col, h.kind) % list.length]; return past ? first(t) : t }).join('')
    : A.palace.none[occurrences('none', 'none') % A.palace.none.length]
  return {
    text,
    basis: A.evidence.palace,
    evidence: hits.map(h => ({ family: 'timeline-v3', system: '四柱推命' as const, detail: `年支${h.branch}が${LABEL[h.col]}${h.natal}と${h.rel}` })),
    terms: hits.length ? ['年支', ...new Set(hits.map(h => LABEL[h.col]))] : [],
  }
}
