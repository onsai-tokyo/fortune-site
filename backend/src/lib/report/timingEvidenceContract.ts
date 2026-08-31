import type { CorrelationGroup, SourceFamily } from './timingScoreEngine.js'

export const SOURCE_FAMILY_CORRELATION_GROUP: Readonly<Record<SourceFamily, CorrelationGroup>> = {
  western: 'astronomical_ephemeris',
  vedic: 'astronomical_ephemeris',
  stem_branch: 'stem_branch_calendar',
  ziwei: 'ziwei_chart',
  auxiliary: 'independent_auxiliary',
}

export function isCanonicalFamilyGroup(family: SourceFamily, group: CorrelationGroup): boolean {
  return SOURCE_FAMILY_CORRELATION_GROUP[family] === group
}

export function assertCanonicalEvidenceIdentity(
  id: string,
  family: SourceFamily,
  group: CorrelationGroup,
  technique: string,
  lineage: string,
): void {
  if (!isCanonicalFamilyGroup(family, group)) {
    throw new TypeError(`${id}.correlationGroup ${group} is invalid for ${family}`)
  }
  const prefix = `${family}:${technique}`
  if (!technique.trim() || (lineage !== prefix && !lineage.startsWith(`${prefix}:`))) {
    throw new TypeError(`${id}.factLineageId must start with ${family}:${technique}:`)
  }
}
