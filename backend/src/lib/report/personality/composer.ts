import { PERSONALITY_CATALOG } from './catalogData.js'
import type {
  PersonalityCatalog, PersonalityInput, PersonalityParagraph, PersonalitySource,
  PersonalityAuditEntry, PersonalityOutputParagraph, PersonalitySection, PersonalityReading,
} from './types.js'

export { PERSONALITY_CATALOG } from './catalogData.js'
export const PERSONALITY_VERSION = `${PERSONALITY_CATALOG.version}|composer:4`
const SPOUSE_SECTION = '15_配偶者の人物像'
const SPOUSE_STARS = new Set(['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '印綬'])
const BRANCHES = new Set([...'子丑寅卯辰巳午未申酉戌亥'])
const GENERAL = '（全体）'

function pendingSpouseText(reason: PersonalityInput['pendingSpouseReason']): string {
  switch (reason) {
    case 'calculation_not_connected': return '配偶者の人物像は、採用する計算方式での算出がまだ接続されていないため、ここでは保留です。'
    case 'missing_time_zone': return '出生地の標準時を確認できないため、配偶者の人物像は保留です。'
    case 'unsupported_time_zone': return 'この出生地の標準時にはまだ対応していないため、配偶者の人物像は保留です。'
    case 'unsupported_birth_date': return 'この生年月日は配偶者像の計算で確認済みの年代に含まれないため、ここでは保留です。'
    case 'invalid_birth_date': case 'invalid_birth_time': return '生年月日または出生時刻の形式を確認できないため、配偶者の人物像は保留です。'
    case 'invalid_day_pillar': case 'day_pillar_mismatch': return '命式と出生情報の一致を確認できないため、配偶者の人物像は保留です。'
    case 'boundary_uncertain': return '出生時刻が配偶者像の判定が切り替わる境界に近いため、ここでは一つに決めず保留にしています。'
    case 'unresolved_table_convention': return 'この条件に使う計算方式の根拠を確認中のため、配偶者の人物像は保留です。'
    case 'calendar_unavailable': return '出生情報から必要な暦の条件を確認できないため、配偶者の人物像は保留です。'
    default: return '出生情報が未指定のため、配偶者の人物像は保留です。'
  }
}

function sourceMatches(source: PersonalitySource, input: PersonalityInput, sectionId: string): boolean {
  switch (source.family) {
    case 'day_pillar': return sectionId !== SPOUSE_SECTION && source.key === input.dayPillar
    case 'shukuyo': return sectionId !== SPOUSE_SECTION && source.key === input.mansion
    case 'spouse_star': return sectionId === SPOUSE_SECTION && !!input.spouse && (source.key === input.spouse.star || source.key === GENERAL)
    case 'spouse_branch': return sectionId === SPOUSE_SECTION && !!input.spouse && (source.key === input.spouse.branch || source.key === GENERAL)
    default: return false
  }
}

/** All evidence must be eligible; dropping an inconvenient reference is not a repair. */
export function paragraphRejectionReasons(
  p: PersonalityParagraph, input: PersonalityInput, sectionId: string, catalog: PersonalityCatalog,
): string[] {
  const reasons = [...(p.withheldReasons ?? [])]
  if (!p.text.trim()) reasons.push('empty_text')
  if (!p.refs.length) reasons.push('missing_references')
  if (p.scope !== 'common' && p.scope !== input.genderSupplement) reasons.push('gender_supplement_not_selected')
  if (!['common', 'female', 'male'].includes(p.scope)) reasons.push('unknown_paragraph_scope')
  if (p.owner && !sourceMatches({ ...p.owner } as PersonalitySource, input, sectionId)) reasons.push('owner_condition_mismatch')
  for (const id of p.refs) {
    const source = catalog.sources[id]
    if (!source) { reasons.push(`missing_source:${id}`); continue }
    if (source.id !== id) reasons.push(`source_identity_mismatch:${id}`)
    if (source.exclusionReasons.length) reasons.push(`excluded_source:${id}`)
    // Common prose must not inherit a gendered source, even if a gender supplement was selected.
    if (source.scope !== 'common' && !(p.scope !== 'common' && source.scope === p.scope && p.scope === input.genderSupplement)) reasons.push(`source_scope_mismatch:${id}`)
    if (!sourceMatches(source, input, sectionId)) reasons.push(`source_condition_mismatch:${id}`)
  }
  if (p.kind === 'editorial_advice') {
    if (p.reviewStatus === 'legacy_unreviewed') reasons.push('legacy_advice_requires_semantic_review')
    if (!p.derivedFrom?.length || !p.derivationNote?.trim()) reasons.push('missing_advice_derivation')
  }
  return [...new Set(reasons)]
}

function recipeMatches(c: PersonalityCatalog['recipes'][number]['conditions'], input: PersonalityInput, catalog: PersonalityCatalog) {
  // An empty recipe would match everybody. It must never become a silent default.
  if (!Object.keys(c).length) return false
  for (const [key, value] of Object.entries(c)) {
    if (typeof value !== 'string' || !value.trim()) return false
    if (key === 'dayPillar' && catalog.dayPillars.includes(value)) continue
    if (key === 'mansion' && catalog.mansions.includes(value)) continue
    if (key === 'spouseStar' && SPOUSE_STARS.has(value)) continue
    if (key === 'spouseBranch' && BRANCHES.has(value)) continue
    return false
  }
  return (!c.dayPillar || c.dayPillar === input.dayPillar) && (!c.mansion || c.mansion === input.mansion)
    && (!c.spouseStar || c.spouseStar === input.spouse?.star) && (!c.spouseBranch || c.spouseBranch === input.spouse?.branch)
}

function pending(sectionId: string, text: string): PersonalitySection {
  return {
    id: sectionId, title: sectionId.slice(3), status: 'pending', reviewStatus: 'pending',
    paragraphs: [{ id: `pending:${sectionId}`, text, refs: [], kind: 'pending_input', reviewStatus: 'pending' }],
  }
}

/**
 * Deliberately conservative: exact paragraph text AND exact evidence within an item.
 * No fuzzy sentence matching, polarity/subject rewriting, inferred bridges or agreement boost.
 */
export function composePersonality(
  raw: PersonalityInput, catalog: PersonalityCatalog = PERSONALITY_CATALOG,
): PersonalityReading {
  const input: PersonalityInput = { ...raw, mansion: raw.mansion.trim().replace(/宿$/, '') + '宿' }
  if (!catalog.dayPillars.includes(input.dayPillar)) throw new Error('Unknown personality day pillar')
  if (!catalog.mansions.includes(input.mansion)) throw new Error('Unknown personality mansion')
  if (input.genderSupplement != null && input.genderSupplement !== 'female' && input.genderSupplement !== 'male') throw new Error('Unknown gender supplement')
  const audit: PersonalityAuditEntry[] = []
  const spouseValid = !input.spouse || (SPOUSE_STARS.has(input.spouse.star) && BRANCHES.has(input.spouse.branch) && input.spouse.branch === input.dayPillar.slice(1))
  if (!spouseValid) {
    audit.push({ sectionId: SPOUSE_SECTION, paragraphId: 'spouse:input', disposition: 'withheld', reasons: ['spouse_condition_mismatch'] })
    input.spouse = undefined
  }
  const chapters = catalog.chapters.map(chapter => ({
    id: chapter.id, title: chapter.title,
    sections: chapter.items.map((sectionId): PersonalitySection => {
      if (sectionId === SPOUSE_SECTION && !input.spouse) {
        return pending(sectionId, !spouseValid
          ? '配偶者像の計算条件を確認できないため、配偶者の人物像は保留です。'
          : pendingSpouseText(input.pendingSpouseReason))
      }
      const recipes = catalog.recipes.filter(r => r.sectionId === sectionId && recipeMatches(r.conditions, input, catalog))
      if (recipes.length > 1) throw new Error(`Ambiguous personality recipe: ${sectionId}`)
      const cells = catalog.cells.filter(cell => cell.sectionId === sectionId &&
        sourceMatches({ family: cell.family, key: cell.key } as PersonalitySource, input, sectionId))
      const baseIds = recipes[0]?.paragraphIds ?? cells.flatMap(c => c.paragraphIds).filter(id => catalog.paragraphs[id]?.scope === 'common')
      const supplementIds = input.genderSupplement
        ? cells.flatMap(c => c.paragraphIds).filter(id => catalog.paragraphs[id]?.scope === input.genderSupplement) : []
      const selected = [...new Set([...baseIds, ...supplementIds])]
      const paragraphs: PersonalityOutputParagraph[] = []
      const seen = new Set<string>()
      const retained = new Set<string>()
      // Advice is evaluated only after its selected, retained descriptive dependencies.
      const ordered = [...selected.filter(id => catalog.paragraphs[id]?.kind !== 'editorial_advice'),
        ...selected.filter(id => catalog.paragraphs[id]?.kind === 'editorial_advice')]
      for (const id of ordered) {
        const p = catalog.paragraphs[id]
        const reasons = p ? paragraphRejectionReasons(p, input, sectionId, catalog) : ['missing_paragraph']
        if (p && p.id !== id) reasons.push('paragraph_identity_mismatch')
        if (p?.kind === 'editorial_advice' && p.derivedFrom?.some(dep => dep.startsWith('source:')
          ? p.reviewStatus !== 'representative_reviewed' || !p.refs.includes(dep.slice(7))
          : !retained.has(dep) || !['astrological_interpretation', 'interpretation_limit'].includes(catalog.paragraphs[dep]?.kind))) reasons.push('advice_dependency_not_retained')
        if (reasons.length) {
          audit.push({ sectionId, paragraphId: id, disposition: 'withheld', reasons: [...new Set(reasons)] })
          continue
        }
        const key = JSON.stringify([p.text, [...new Set(p.refs)].sort(), p.kind, p.scope])
        if (seen.has(key)) {
          audit.push({ sectionId, paragraphId: id, disposition: 'duplicate', reasons: ['exact_text_and_evidence_in_same_item'] })
          continue
        }
        seen.add(key); retained.add(id)
        paragraphs.push({ id, text: p.text, refs: [...p.refs], kind: p.kind, reviewStatus: p.reviewStatus,
          ...(p.reviewId ? { reviewId: p.reviewId } : {}),
          ...(p.derivedFrom ? { derivedFrom: [...p.derivedFrom], derivationNote: p.derivationNote } : {}) })
      }
      // Keep the reviewed narrative order after dependency checking; don't move its advice to the end.
      paragraphs.sort((a, b) => selected.indexOf(a.id) - selected.indexOf(b.id))
      if (!paragraphs.some(p => p.kind === 'astrological_interpretation' || (sectionId !== SPOUSE_SECTION && p.kind === 'interpretation_limit'))) {
        return pending(sectionId, sectionId === SPOUSE_SECTION
          ? 'この条件に対応する配偶者像の文章を確認中のため、ここでは保留です。'
          : 'この項目の文章は、根拠と適用範囲を確認中です。')
      }
      const changed = audit.some(a => a.sectionId === sectionId)
      const reviewStatus = recipes.length && !changed && !supplementIds.length && paragraphs.every(p => p.reviewStatus === 'representative_reviewed') ? 'representative_reviewed'
        : recipes.length && !changed && !supplementIds.length && paragraphs.every(p => p.reviewStatus === 'composition_revised') ? 'composition_revised'
        : paragraphs.every(p => p.reviewStatus === 'material_reviewed') ? 'material_reviewed'
        : paragraphs.every(p => p.reviewStatus === 'material_revised') ? 'material_revised' : 'legacy_unreviewed'
      return { id: sectionId, title: sectionId.slice(3), paragraphs, status: 'ready', reviewStatus }
    }),
  }))
  return { version: `${catalog.version}|composer:4`, chapters, audit }
}
