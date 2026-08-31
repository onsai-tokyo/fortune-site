import { createHash } from 'node:crypto'
import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportSection, StructuredReport } from '../reportCards.js'
import { CHAPTER_SCORES } from './chapterScore.js'
import type { Claim, ClaimAsset, ClaimConfidence, EvidenceRef } from './claim.js'
import { CLAIM_ASSETS } from './claimAssets.js'
import type { ChapterId } from './chapterPlannerV2.js'
import type { ReportFactV2 } from './factsV2.js'
import type { ReportFindingV2 } from './findingsV2.js'
import { glossesForEvidence } from './jargon.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'
import { realizeSummary, realizeTitle } from './sentenceForm.js'
import { bootstrapTraitScoreScale } from './traitScoreScale.js'
import { ALL_TRAIT_SCORE_KEYS, computeTraitScores, TRAIT_SCORE_RULES, type TraitScoreSet } from './traitScores.js'

const CHAPTER_ORDER = Object.keys(CHAPTER_SCORES) as ChapterId[]
const MIN_SECTIONS = 3
const MAX_SECTIONS = 6
const SALIENCE_FLOOR = 0.70

function seedInt(value: string): number {
  return createHash('sha256').update(value).digest().readUInt32BE(0)
}

export function claimTriggerMatchesFinding(asset: ClaimAsset, finding: ReportFindingV2): boolean {
  switch (asset.trigger.kind) {
    case 'signal': return finding.key === asset.trigger.signal
    case 'axis': return finding.axis === asset.trigger.axis
    case 'gap': return finding.key === asset.trigger.gapKey || finding.key === `${asset.trigger.gapKey}:aligned`
    case 'missing': return finding.key === `missing-${asset.trigger.element}`
    case 'mutagen': return finding.key.startsWith('mutagen-') && finding.key.split('-').includes(asset.trigger.star)
    case 'score': return finding.key === asset.trigger.scoreKey
  }
}

type ClaimSelectionTier = 'direct' | 'score' | 'axis'
type SelectableClaim = Claim & { selectionTier: ClaimSelectionTier }

function selectionTier(asset: ClaimAsset): ClaimSelectionTier {
  if (asset.trigger.kind === 'axis') return 'axis'
  if (asset.trigger.kind === 'score') return 'score'
  return 'direct'
}

function scoreFinding(asset: ClaimAsset, facts: ReportFactV2[], scores: TraitScoreSet): ReportFindingV2 | null {
  const scoreKey = asset.scoreKey === 'private_affection' ? 'domestic_affection' : asset.scoreKey
  const score = scores[scoreKey]
  if (!score || score.contributingFacts.length === 0) return null
  const factById = new Map(facts.map(fact => [fact.id, fact]))
  const contributingFacts = score.contributingFacts
    .map(id => factById.get(id))
    .filter((fact): fact is ReportFactV2 => Boolean(fact))
    .sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id))
  if (contributingFacts.length === 0) return null
  const lineages = [...new Set(contributingFacts.map(fact => fact.lineage))]
  const systems = [...new Set(contributingFacts.map(fact => fact.system))].sort()
  return {
    id: `score:${scoreKey}`,
    key: scoreKey,
    kind: lineages.length >= 2 ? 'consensus' : 'signature',
    axis: contributingFacts[0].axis,
    confidence: score.confidence,
    lineages,
    systems,
    independence: 1,
    primaryFacts: contributingFacts.map(fact => fact.id),
    supportingFacts: [],
  }
}

function evidenceFor(factIds: readonly string[], factById: Map<string, ReportFactV2>): EvidenceRef[] {
  const seen = new Set<string>()
  return factIds.flatMap(id => {
    const fact = factById.get(id)
    if (!fact) return []
    const key = `${fact.lineage}|${fact.system}|${fact.factor}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ family: fact.lineage, system: fact.system, detail: fact.factor, factIds: [fact.id] }]
  })
}

function confidenceFor(finding: ReportFindingV2, requiresBirthTime: boolean, birthTimeAvailable: boolean): ClaimConfidence {
  if (requiresBirthTime && !birthTimeAvailable) return 'conditional'
  if (finding.kind === 'consensus') return 'observed'
  return finding.confidence >= 0.65 ? 'likely' : 'conditional'
}

function buildClaim(asset: ClaimAsset, finding: ReportFindingV2, facts: ReportFactV2[], scores: TraitScoreSet, birthTimeAvailable: boolean): SelectableClaim | null {
  const factById = new Map(facts.map(fact => [fact.id, fact]))
  const scoreKey = asset.scoreKey === 'private_affection' ? 'domestic_affection' : asset.scoreKey
  const score = scores[scoreKey]
  const factIds = [...new Set([...finding.primaryFacts, ...finding.supportingFacts, ...score.contributingFacts])]
  const evidence = evidenceFor(factIds, factById)
  if (evidence.length === 0) return null
  const requiresBirthTime = factIds.some(id => factById.get(id)?.requiresBirthTime)
  // salienceBase は編集済み資産の品質判定そのもの。確信度は順位の微調整だけに使い、
  // ここで再び大幅に縮小して 0.70 floor 未満へ落とさない。
  const salience = Math.min(1, asset.salienceBase + finding.confidence * 0.04 + score.confidence * 0.03)
  return {
    id: asset.id, chapter: asset.chapter, shape: asset.shape,
    subject: asset.subject, proposition: asset.proposition, counterpart: asset.counterpart,
    condition: asset.condition, behavior: asset.behavior, cost: asset.cost, typeLabel: asset.typeLabel,
    evidence,
    termGloss: evidence.flatMap(item => glossesForEvidence(item.detail)),
    confidence: confidenceFor(finding, requiresBirthTime, birthTimeAvailable), requiresBirthTime, salience,
    selectionTier: selectionTier(asset),
  }
}

function paragraph(claim: Claim, index: number): string {
  const condForm = [
    `これが強く出るのは、${claim.condition}に限られます。`,
    `いつもそうなるわけではなく、${claim.condition}に、はっきり出ます。`,
    `当てはまるのは、${claim.condition}です。`,
    `そうなりやすいのは、${claim.condition}のほうです。`,
  ]
  const costForm = [
    `引き換えになっているのは、${claim.cost}です。`, `そのぶん、${claim.cost}を後回しにしています。`,
    `代わりに手放しているのは、${claim.cost}です。`, `ここで払っているのは、${claim.cost}です。`,
  ]
  const closeForm = [
    `${claim.behavior}と、扱いやすくなります。`, `${claim.behavior}ところから確かめられます。`,
    `まずは${claim.behavior}ことから試せます。`, `${claim.behavior}と、次から動きやすくなります。`,
  ]
  const parts = claim.counterpart
    ? [`${claim.subject}、${claim.counterpart}。`, claim.condition ? condForm[index % 4] : '']
    : [`${claim.subject}、${claim.proposition}。`, claim.condition ? condForm[index % 4] : '']
  if (claim.cost) parts.push(costForm[index % 4])
  parts.push(closeForm[index % 4])
  return parts.filter(Boolean).join('')
}

function rotateClaims(claims: SelectableClaim[], seed: string, tier: ClaimSelectionTier): SelectableClaim[] {
  if (claims.length === 0) return []
  const offset = seedInt(`${seed}|${tier}`) % claims.length
  return Array.from({ length: claims.length }, (_, index) => claims[(offset + index) % claims.length])
}

function pickClaims(chapter: ChapterId, claims: SelectableClaim[], seed: string): SelectableClaim[] {
  const forbidden = CHAPTER_SCORES[chapter].forbidden
  const pool = claims.filter(claim => claim.chapter === chapter && claim.salience >= SALIENCE_FLOOR)
    .filter(claim => !forbidden?.test([claim.typeLabel, claim.subject, claim.proposition, claim.counterpart, claim.condition, claim.behavior, claim.cost].filter(Boolean).join('')))
    .sort((left, right) => right.salience - left.salience || left.id.localeCompare(right.id))
  if (pool.length === 0) return []
  const desired = Math.min(MAX_SECTIONS, Math.max(MIN_SECTIONS, pool.length))
  // 具体的な trigger を最優先する。axis は ClaimTrigger の契約どおり、
  // 具体的な候補だけでは章の最低件数を満たせない場合に限るフォールバック。
  // score はスコア自体を根拠に執筆された資産なので、その次に採る。
  const ordered = (['direct', 'score', 'axis'] as const).flatMap(tier =>
    rotateClaims(pool.filter(claim => claim.selectionTier === tier), `${seed}|${chapter}`, tier))
  return ordered.slice(0, desired)
}

export function buildClaimStructuredReport(facts: ReportFactV2[], findings: ReportFindingV2[], input: ReportInput): StructuredReport {
  const scores = computeTraitScores(facts, TRAIT_SCORE_RULES, bootstrapTraitScoreScale(ALL_TRAIT_SCORE_KEYS))
  const seed = JSON.stringify([input.birthDate, input.birthTime ?? null, input.birthplace, input.gender])
  const claims = CLAIM_ASSETS.flatMap(asset => {
    const triggered = findings.filter(item => claimTriggerMatchesFinding(asset, item))
      .sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id))[0]
    // 非 score 資産は固有 trigger が成立したときだけ採用する。
    // 広い Trait Score だけで具体的な生活場面を補うと、根拠のない断定になる。
    const finding = triggered ?? (asset.trigger.kind === 'score' ? scoreFinding(asset, facts, scores) : null)
    if (!finding) return []
    const claim = buildClaim(asset, finding, facts, scores, Boolean(input.birthTime))
    return claim ? [claim] : []
  })
  const cards: ReportCard[] = CHAPTER_ORDER.flatMap(chapter => {
    const picked = pickClaims(chapter, claims, seed)
    if (picked.length === 0) return []
    const sections: ReportSection[] = picked.map((claim, index) => ({
      heading: claim.typeLabel,
      body: paragraph(claim, index),
      evidence: claim.evidence.map(item => ({ family: item.family, system: item.system, detail: item.detail })),
      termGloss: claim.termGloss,
      claimId: claim.id,
    }))
    const first = picked[0]
    const pages = sections.map((section, index) => ({
      role: index === 0 ? 'opening' as const : index === sections.length - 1 ? 'closing' as const : 'core' as const,
      label: section.heading,
      text: section.body,
    }))
    const evidence = sections.flatMap(section => section.evidence).filter((item, index, all) =>
      all.findIndex(value => value.family === item.family && value.system === item.system && value.detail === item.detail) === index)
    return [withCardProvenance({
      id: chapter, kind: 'essence', scope: 'self', tab: 'essence', title: realizeTitle(first),
      summary: realizeSummary(first, 'scene-first'), tags: [CHAPTER_SCORES[chapter].heading], period: null,
      pages, sections, evidence, metadataRefs: picked.flatMap(claim => [
        `claim:${claim.id}`,
        `claim-source:${claim.selectionTier}`,
        ...claim.evidence.flatMap(item => item.factIds.map(id => `fact:${id}`)),
      ]),
    }, 'deterministic', 'finding', 0)]
  })
  return finalizeReportProvenance({
    version: 3,
    cards,
    reportText: cards.flatMap(card => [`【${card.title}】`, ...(card.sections ?? []).flatMap(section => [section.heading, section.body])]).join('\n\n'),
  }, 'claims-scroll-v1')
}
