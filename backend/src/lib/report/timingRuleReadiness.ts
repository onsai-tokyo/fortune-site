import { TIMING_SCORE_KEYS, type TimingScoreKey } from './timingClaim.js'
import { auditCanonicalTimingManifest } from './timingExactManifest.js'
import { TIMING_LINEAGE_CONTRACT, type TimingLineageContractEntry } from './timingLineageContract.js'
import { TIMING_SCORE_DESIGN_CONTRACT } from './timingScoreDesignContract.js'
import { SOURCE_FAMILY_WEIGHTS, type SourceFamily } from './timingScoreEngine.js'

export interface TimingRuleCoverage {
  totalScoreCount: number
  cataloguedScoreCount: number
  connectedScoreCount: number
  cataloguedLineageCount: number
  connectedLineageCount: number
  missingScoreKeys: readonly TimingScoreKey[]
  incompleteScoreKeys: readonly TimingScoreKey[]
  contractMismatchScoreKeys: readonly TimingScoreKey[]
  contractIntegrityErrors: readonly string[]
  exactManifestComplete: boolean
  productionConnectionReady: boolean
}

function catalogueFullMax(entries: readonly TimingLineageContractEntry[]): number {
  const familyValue = (family: SourceFamily) => Math.min(
    SOURCE_FAMILY_WEIGHTS[family],
    entries.filter(item => item.sourceFamily === family && item.polarity > 0 && item.status !== 'mathematically_impossible')
      .reduce((sum, item) => sum + item.maximumContribution, 0),
  )
  const western = familyValue('western')
  const vedic = familyValue('vedic')
  return Number((Math.max(western, vedic) + .6 * Math.min(western, vedic)
    + familyValue('stem_branch') + familyValue('ziwei') + familyValue('auxiliary')).toFixed(3))
}

/**
 * 時期18スコアを文章選択へ接続してよいかを判定する安全ゲート。
 * 「スコアエンジンが18キーを返す」だけでは完成扱いにしない。
 * 正本カタログが存在し、かつ実装可能なlineageが接続済みであることを要求する。
 */
export function measureTimingRuleCoverage(
  contract: readonly TimingLineageContractEntry[] = TIMING_LINEAGE_CONTRACT,
): TimingRuleCoverage {
  const exactAudit = auditCanonicalTimingManifest()
  const entriesByScore = new Map<TimingScoreKey, TimingLineageContractEntry[]>()
  for (const key of TIMING_SCORE_KEYS) entriesByScore.set(key, [])
  for (const item of contract) entriesByScore.get(item.scoreKey)?.push(item)

  const contractIntegrityErrors: string[] = []
  const lineageKeys = new Set<string>()
  for (const item of contract) {
    const identity = `${item.scoreKey}\u0000${item.factLineageId}\u0000${item.polarity}`
    if (lineageKeys.has(identity)) contractIntegrityErrors.push(`duplicate:${item.scoreKey}:${item.factLineageId}:${item.polarity}`)
    lineageKeys.add(identity)
    if (!item.factLineageId.startsWith(`${item.sourceFamily}:`)) contractIntegrityErrors.push(`family-prefix:${item.factLineageId}`)
    if (!Number.isFinite(item.maximumContribution) || item.maximumContribution < 0 || item.maximumContribution > SOURCE_FAMILY_WEIGHTS[item.sourceFamily]) {
      contractIntegrityErrors.push(`maximumContribution:${item.factLineageId}:${String(item.maximumContribution)}`)
    }
  }

  const missingScoreKeys = TIMING_SCORE_KEYS.filter(key => (entriesByScore.get(key)?.length ?? 0) === 0)
  const incompleteScoreKeys = TIMING_SCORE_KEYS.filter(key => {
    const entries = entriesByScore.get(key) ?? []
    return entries.length > 0 && entries.some(item => item.status === 'upstream_missing')
  })
  const contractMismatchScoreKeys = TIMING_SCORE_KEYS.filter(key => {
    const entries = entriesByScore.get(key) ?? []
    if (entries.length === 0) return false
    const expected = TIMING_SCORE_DESIGN_CONTRACT[key]
    const actualFamilies = [...new Set(entries.map(item => item.sourceFamily))].sort()
    const expectedFamilies = [...expected.sourceFamilies].sort()
    return actualFamilies.join('\u0000') !== expectedFamilies.join('\u0000')
      || catalogueFullMax(entries) !== expected.fullMax
  })
  const connectedScoreCount = TIMING_SCORE_KEYS.filter(key => {
    const entries = entriesByScore.get(key) ?? []
    return entries.some(item => item.status === 'connected') && !entries.some(item => item.status === 'upstream_missing')
  }).length
  const connectedLineageCount = contract.filter(item => item.status === 'connected').length

  return {
    totalScoreCount: TIMING_SCORE_KEYS.length,
    cataloguedScoreCount: TIMING_SCORE_KEYS.length - missingScoreKeys.length,
    connectedScoreCount,
    cataloguedLineageCount: contract.length,
    connectedLineageCount,
    missingScoreKeys,
    incompleteScoreKeys,
    contractMismatchScoreKeys,
    contractIntegrityErrors,
    exactManifestComplete: exactAudit.ready,
    productionConnectionReady:
      exactAudit.ready
      && missingScoreKeys.length === 0
      && incompleteScoreKeys.length === 0
      && contractMismatchScoreKeys.length === 0
      && contractIntegrityErrors.length === 0
      && connectedScoreCount === TIMING_SCORE_KEYS.length,
  }
}

export function assertTimingRulesReadyForProduction(
  contract: readonly TimingLineageContractEntry[] = TIMING_LINEAGE_CONTRACT,
) {
  const coverage = measureTimingRuleCoverage(contract)
  if (!coverage.productionConnectionReady) {
    throw new Error(
      `Timing rules are not ready: ${coverage.cataloguedScoreCount}/${coverage.totalScoreCount} scores catalogued; `
      + `missing=${coverage.missingScoreKeys.join(',') || 'none'}; `
      + `incomplete=${coverage.incompleteScoreKeys.join(',') || 'none'}; `
      + `contractMismatch=${coverage.contractMismatchScoreKeys.join(',') || 'none'}; `
      + `integrity=${coverage.contractIntegrityErrors.join(',') || 'none'}`,
    )
  }
}
