import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportCardPage, ReportPageRole, StructuredReport } from '../reportCards.js'
import { assignFindingsToChaptersV2, CHAPTER_CONTRACT, type ChapterId } from './chapterPlannerV2.js'
import { selectNarrativeBlock } from './blockSelectorV2.js'
import type { ReportFactV2 } from './factsV2.js'
import { buildFindingRelationsV2 } from './findingRelationsV2.js'
import type { ReportFindingV2 } from './findingsV2.js'
import type { ReportMetadata } from './metadata.js'
import { FINDING_PATTERNS_V2, languageForAxis, NARRATIVE_BLOCKS_V2 } from './narrativeAssetsV2.js'
import type { PageRole } from './narrativeV2.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'

const CHAPTER_META: Record<ChapterId, { label: string; tags: string[]; title: string }> = {
  'life-mission': { label: '人生の軸', tags: ['本質', '価値観'], title: '迷ったとき、最後に戻ってくる場所' },
  'core-mind-1': { label: '行動の仕方', tags: ['本質', '行動パターン'], title: '考えが行動へ変わるまでの順序' },
  'core-mind-2': { label: '人との距離', tags: ['本質', '人間関係'], title: '人と近づくときに確かめていること' },
  'core-mind-3': { label: '揺れやすい場面', tags: ['本質', '弱点・注意点'], title: '自分を見失いやすい瞬間と戻り方' },
  'love-beginning': { label: '恋愛の入口', tags: ['恋愛'], title: '心が動き始めるまでに必要な時間' },
  'love-pattern': { label: '関係の続き方', tags: ['恋愛', '結婚'], title: '関係が深まるほど大切になる約束' },
  'work-mode': { label: '仕事の進め方', tags: ['仕事'], title: '力が自然に立ち上がる任され方' },
  'work-fit': { label: '働く環境', tags: ['仕事', '環境'], title: '長く力を保てる場所の条件' },
}

const ROLES: PageRole[] = ['opening', 'core', 'cause', 'scene', 'inner', 'strength', 'shadow', 'relation', 'exception', 'change', 'question', 'action', 'closing']
const REPORT_ROLE: Record<PageRole, ReportPageRole> = {
  opening: 'opening', core: 'core', cause: 'core', scene: 'scene', inner: 'scene', strength: 'core', shadow: 'shadow', conflict: 'shadow', exception: 'exception', relation: 'scene', love: 'scene', work: 'scene', change: 'exception', question: 'question', action: 'action', closing: 'closing', supplement: 'exception',
}

function render(text: string, finding: ReportFindingV2): string {
  const language = languageForAxis(finding.axis)
  return text.replaceAll('{{trait}}', language.trait).replaceAll('{{assertion}}', language.assertion)
    .replaceAll('{{strength}}', language.strength).replaceAll('{{shadow}}', language.shadow)
}

function syntheticFinding(id: ChapterId): ReportFindingV2 {
  const axis = CHAPTER_CONTRACT[id].axes[0]
  return { id: `supplement:${id}`, key: `supplement:${id}`, kind: 'signature', axis, confidence: 0, lineages: [], systems: [], independence: 0, primaryFacts: [], supportingFacts: [] }
}

function labels(role: PageRole): string {
  return ({ opening: '扉', core: '変わらない核', cause: 'なぜそうなるのか', scene: '日常に現れる場面', inner: '胸の内側', strength: '力になるとき', shadow: '苦しくなるとき', conflict: '二つの気持ち', exception: '意外な一面', relation: '人との距離', love: '恋愛で現れる面', work: '仕事で現れる面', change: '以前との違い', question: 'いま立っている場所', action: 'これからの使い方', closing: '余韻', supplement: '読み方' } as Record<PageRole, string>)[role]
}

export function buildBlockStructuredReport(facts: ReportFactV2[], findings: ReportFindingV2[], input: ReportInput, metadata: ReportMetadata): StructuredReport {
  const factById = new Map(facts.map(fact => [fact.id, fact]))
  const relations = buildFindingRelationsV2(findings, FINDING_PATTERNS_V2)
  const plans = assignFindingsToChaptersV2(findings, relations)
  const seed = JSON.stringify([input.birthDate, input.birthTime ?? null, input.birthplace, input.gender])
  const usedBlockIds = new Set<string>()
  const cards: ReportCard[] = plans.map(plan => {
    const chapter = CHAPTER_META[plan.id]
    const finding = plan.primary ?? syntheticFinding(plan.id)
    const domain = CHAPTER_CONTRACT[plan.id].domain
    const requestedRoles = domain === 'love' ? [...ROLES.slice(0, 8), 'love' as const, ...ROLES.slice(8)]
      : domain === 'work' ? [...ROLES.slice(0, 8), 'work' as const, ...ROLES.slice(8)] : ROLES
    const pages: ReportCardPage[] = requestedRoles.map((role, index) => {
      const block = selectNarrativeBlock(NARRATIVE_BLOCKS_V2, { primary: finding, support: plan.support, role, domain, birthTimeAvailable: Boolean(input.birthTime), lifeStage: metadata.lifeStage, seed: `${seed}:${plan.id}:${index}`, usedBlockIds })
      const fallback = selectNarrativeBlock(NARRATIVE_BLOCKS_V2, { primary: finding, support: plan.support, role: 'supplement', domain, birthTimeAvailable: Boolean(input.birthTime), lifeStage: metadata.lifeStage, seed: `${seed}:${plan.id}:supplement:${index}`, usedBlockIds })
      if (block) usedBlockIds.add(block.id)
      else if (fallback) usedBlockIds.add(fallback.id)
      return { role: REPORT_ROLE[role], label: labels(role), text: render((block ?? fallback)?.text ?? 'この章では、今ある根拠から確かに読めることをたどります。', finding) }
    })
    const language = languageForAxis(finding.axis)
    const evidence = finding.primaryFacts.flatMap(id => { const fact = factById.get(id); return fact ? [{ family: fact.lineage, system: fact.system, detail: fact.factor }] : [] })
    const title = plan.primary ? `${language.trait}が、${chapter.label}を形づくる` : chapter.title
    return withCardProvenance({ id: plan.id, kind: 'essence', scope: 'self', tab: 'essence', title,
      summary: plan.primary ? language.assertion : `この章では、${chapter.label}について確かに読める範囲をたどります。`, tags: chapter.tags, period: null, pages, evidence,
      metadataRefs: plan.primary ? [`finding:${finding.id}`, ...finding.primaryFacts.map(id => `fact:${id}`)] : [`supplement:${plan.id}`] }, 'deterministic', plan.primary ? 'finding' : 'supplement', plan.primary ? 0 : pages.length)
  })
  return finalizeReportProvenance({ version: 3, cards, reportText: cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n') }, 'blocks-v2')
}
