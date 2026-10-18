/** Research-only disposition layer. Retains the submitted dictionary; approves no new interpretation. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { LIFE_AXIS_ROWS, type StructureRow } from './lifeAxis.js'

type Chapter = {
  id: string; label: string; scene: string; claim: string[]; negate: string[]; seat: string[]
  advice: Record<string, string>; sceneDetail: string[]; appearance: Record<string, string>
  titleNote: Record<string, string>; titleCore: string[]; titleLead: Record<string, string>
}
type Dictionary = {
  version: string; stars: string[]; tenGods: string[]; stems: string[]; sectionHeads: string[]
  keyword: string[]; dayStem: string[]; twelveStage: Record<string, string>; relationBody: Record<string, string>
  relationShape: Record<string, string>; relationAdvice: Record<string, string>; mismatch: Record<string, string>; chapters: Chapter[]
}
const raw = readFileSync(new URL('./assets/life-axis-v061/copy_dictionary_600.json', import.meta.url))
const D = JSON.parse(raw.toString()) as Dictionary
export const PERSONALITY_REVIEW_VERSION = 'v061-p0-quarantine-v1'
export const ORIGINAL_DICTIONARY_SHA256 = createHash('sha256').update(raw).digest('hex')
export const REVIEW_CHAPTERS = D.chapters.map(c => ({ id: c.id, label: c.label }))
export const REVIEW_ROWS = LIFE_AXIS_ROWS

// A rule blocks interpretation text, not the underlying calculated relation or hidden stems.
const RULES: Array<{ pattern: RegExp; issues: string[]; reason: string }> = [
  { pattern: /^relationBody\./, issues: ['I001', 'I012'], reason: '生剋・陰陽から心理・時間・成果へ進む具体的な典拠を確認できていない。' },
  { pattern: /^relationAdvice\./, issues: ['I001'], reason: '未確認の心理・成果を前提とする行動の助言。' },
  { pattern: /^relation(Body|Advice)\.中心→座下を生じる\|異$/, issues: ['I002'], reason: '相生と陰陽の異から、成果の遅延・期限の延長へ進む根拠がない。' },
  { pattern: /^relationBody\.座下→中心を剋す\|同$/, issues: ['I003'], reason: '出生条件から酒席での行動と抑圧の解除を決めている。' },
  { pattern: /^relation(Body|Advice)\.同五行\|同$/, issues: ['I005'], reason: '計算上の同一性から極端さや他者評価を決めている。' },
  { pattern: /^chapters\.[^.]+\.titleLead\./, issues: ['I027'], reason: '関係コードだけで成果・遅延・自壊をタイトルへ付加している。' },
  { pattern: /^chapters\.[^.]+\.(titleNote|appearance|advice)\./, issues: ['I006'], reason: '3種類の型だけで内面・他者評価・行動助言を決めている。' },
  { pattern: /^chapters\.[^.]+\.negate\[/, issues: ['I007'], reason: '中心星だけで他の行動を排除する否定文を自動付加している。' },
  { pattern: /^chapters\.interpersonal_distance\.negate\[4\]$/, issues: ['I022'], reason: '他者への関心から、見返りを求めない動機を固定している。' },
  { pattern: /^dayStem\[/, issues: ['I008'], reason: '日干の比喩と能力・消耗の断定が同じ文言部品に含まれるため、部品全体を一旦保留。' },
  { pattern: /^twelveStage\./, issues: ['I009'], reason: '十二運の算出値と能力・回復・評価の仮説を分離する必要がある。' },
  { pattern: /^chapters\.life_axis\.(titleCore|claim|sceneDetail)\[2\]$/, issues: ['I016'], reason: '鳳閣星から我慢・努力・継続・撤退を一律に決める解釈を再確認する。見出しも同時に保留。' },
  { pattern: /^chapters\.depletion_recovery\.(titleCore|claim|sceneDetail|seat)\[/, issues: ['I017'], reason: '休息の好みと実際の回復効果を区別できていないため、回復の文章を保留。' },
  { pattern: /^chapters\.work_style\.sceneDetail\[7\]$/, issues: ['I018'], reason: '役割の曖昧さから実力が半分以下とする根拠がない。' },
  { pattern: /^chapters\.work_style\.sceneDetail\[5\]$/, issues: ['I019'], reason: '短期案件で手を抜くという行動の断定は蓄積の好みから導けない。' },
  { pattern: /^chapters\.[^.]+\.(titleCore|claim|sceneDetail)\[8\]$/, issues: ['I020'], reason: '探索・変化と継続できない性質を分離するまで、関連する中心星の文と見出しを保留。' },
  { pattern: /^chapters\.[^.]+\.(titleCore|claim|sceneDetail)\[7\]$/, issues: ['I021'], reason: '規範・責任・評価への関心と、一律の道徳性・能力を分離するまで保留。' },
  { pattern: /^chapters\.[^.]+\.(titleCore|claim|sceneDetail)\[9\]$/, issues: ['I023'], reason: '学習・理解を言語と論理だけへ縮め、全生活領域へ転用する読みを再確認する。' },
  { pattern: /^chapters\.life_axis\.sceneDetail\[0\]$/, issues: ['I025'], reason: '相談の主語だけでなく、必ず調べ直す・他人の方法を踏襲できないという主張自体も未確認。' },
  { pattern: /^chapters\.suitable_environment\.(claim|sceneDetail)\[6\]$/, issues: ['I026'], reason: '環境で腐る・能力が低下するという主張を、別の比喩に置き換えず保留。' },
]

const textParts = new Map<string, string>()
function flatten(key: string, value: unknown): void {
  if (Array.isArray(value)) value.forEach((v, i) => flatten(`${key}[${i}]`, v))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => flatten(`${key}.${k}`, v))
  else if (typeof value === 'string') textParts.set(key, value)
  else throw new Error(`Not a text part: ${key}`)
}
for (const key of ['keyword', 'sectionHeads', 'dayStem', 'twelveStage', 'relationBody', 'relationAdvice', 'mismatch'] as const) flatten(key, D[key])
for (const ch of D.chapters) for (const key of ['scene', 'claim', 'negate', 'seat', 'advice', 'sceneDetail', 'appearance', 'titleNote', 'titleCore', 'titleLead'] as const) flatten(`chapters.${ch.id}.${key}`, ch[key])
if (textParts.size !== 622) throw new Error('Unexpected dictionary version; review policy must be revisited')

export function reviewTextPart(key: string) {
  const originalText = textParts.get(key)
  if (originalText === undefined) throw new Error(`Unmapped dictionary part: ${key}`)
  const matched = RULES.filter(r => r.pattern.test(key))
  return {
    claimID: `${D.version}::${key}`, dictionaryKey: key, originalText,
    dispositionVersion: PERSONALITY_REVIEW_VERSION,
    status: matched.length ? 'withheld' as const : 'unreviewed' as const,
    relatedIssueIds: [...new Set(matched.flatMap(r => r.issues))],
    reason: matched.map(r => r.reason),
    domain: key.startsWith('chapters.') ? key.split('.')[1] : 'cross_chapter',
    school: null, verifiedSources: [], allowedMeaning: null,
    interpretationStatus: 'unvalidated_new_hypothesis' as const,
    // Inspection text is not an approved reading and must not be consumed by production.
    inspectionText: matched.length ? null : originalText,
    publishableText: null, productionEligible: false as const,
  }
}
export const allReviewedParts = () => [...textParts.keys()].map(reviewTextPart)

export function describeMonthBands(row: StructureRow) {
  return row.monthBands.map(b => `月支が${b.monthBranch}で、節入りからの経過日数が${b.to === null ? `${b.from}以上` : `${b.from}〜${b.to}`}`).join('／')
    + '。経過日数は当月の日付ではありません。計算規約は変更していません。'
}

export function buildReviewedCandidate(row: StructureRow, chapterId: string) {
  const ch = D.chapters.find(c => c.id === chapterId)
  const stored = REVIEW_ROWS.find(r => r.dayPillar === row.dayPillar && r.centerStar === row.centerStar)
  if (!ch || !stored || JSON.stringify(row) !== JSON.stringify(stored)) throw new Error('Unrecognized reviewed structure or chapter')
  const c = D.stars.indexOf(row.centerStar), s = D.tenGods.indexOf(row.seatPrimaryTenGod), stem = D.stems.indexOf(row.dayStem)
  const rel = `${row.relation.elementRelation}|${row.relation.polarity}`, shape = D.relationShape[rel], p = `chapters.${ch.id}`
  const refs: Record<string, string[]> = {
    title: [`${p}.titleCore[${c}]`, `${p}.titleLead.${rel}`], opening: [`${p}.titleNote.${shape}`],
    section1: [`${p}.scene`, `${p}.claim[${c}]`, `${p}.negate[${c}]`],
    section2: [`relationBody.${rel}`, `keyword[${c}]`, `keyword[${s}]`],
    section3: [`${p}.sceneDetail[${c}]`], section4: [`dayStem[${stem}]`, `${p}.seat[${s}]`],
    section5: [`twelveStage.${row.twelveStage}`], section6: [`${p}.appearance.${shape}`],
    advice: [`${p}.advice.${shape}`, `relationAdvice.${rel}`, `mismatch.${shape}`],
  }
  const selectors: Record<string, Record<string, string>> = {
    title: { centerStar: row.centerStar, relationCode: rel }, opening: { relationCode: rel, shape },
    section1: { centerStar: row.centerStar }, section2: { centerStem: row.centerStem, centerStar: row.centerStar, seatPrimaryStem: row.seatPrimaryStem, seatPrimaryTenGod: row.seatPrimaryTenGod, relationCode: rel },
    section3: { centerStar: row.centerStar }, section4: { dayStem: row.dayStem, seatPrimaryStem: row.seatPrimaryStem, seatPrimaryTenGod: row.seatPrimaryTenGod },
    section5: { dayPillar: row.dayPillar, twelveStage: row.twelveStage }, section6: { relationCode: rel, shape }, advice: { relationCode: rel, shape },
  }
  return {
    stableKey: `${row.dayPillar}-${row.centerStar}::${ch.id}`, originalDictionaryVersion: D.version,
    dispositionVersion: PERSONALITY_REVIEW_VERSION, productionEligible: false,
    interpretationTitle: null, displayLabel: `${ch.label}：${row.dayPillar} × ${row.centerStar}`,
    conditions: { ...row }, conditionDescription: describeMonthBands(row),
    sections: Object.entries(refs).map(([field, keys]) => {
      const parts = keys.map(reviewTextPart)
      // A fragment of a blocked title/sentence is not promoted to a replacement claim.
      return { field, status: parts.some(p => p.status === 'withheld') ? 'withheld' as const : 'unreviewed' as const,
        calculationSelectors: selectors[field],
        dictionaryRefs: keys, parts, publishableText: null }
    }),
  }
}
