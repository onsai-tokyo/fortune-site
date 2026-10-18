import { ANNUAL3600_VERSION } from './annual3600/version.js'
import { annualText } from './annual3600/catalog.js'
import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportSection, StructuredReport } from '../reportCards.js'
import { containsJargon } from './jargon.js'
import { ANNUAL_SIGN_VERSION } from './annualSignAssets.js'
import { ANNUAL_HEADINGS, ANNUAL_LAYOUT_VERSION, componentBody } from './annualReadingLayout.js'
import { isPersonalityLayoutCard, personalityCardShapeIsValid, personalityJargonCheckText, PERSONALITY_CARD_IDS, type PersonalitySection } from './personalityReport.js'

export type ReportTab = 'essence' | 'timing' | 'chart'
export type ContractCard = ReportCard & { tab?: ReportTab }
export type ContractViolationCode =
  | 'JARGON_IN_BODY' | 'RAW_CALC_STRING' | 'YOU_SUBJECT_LIMIT' | 'EMPTY_EVIDENCE'
  | 'DOMAIN_LEAK' | 'SEMANTIC_DUPLICATE' | 'SECTION_LENGTH'
  | 'ORDINAL_WITHOUT_SECOND' | 'BIRTH_TIME_OVERREACH' | 'SCHEMA'

export interface ContractViolation { code: ContractViolationCode; path: string; message: string }
const WORK = /仕事|職場|上司|部下|同僚|転職|昇進|会社|業務|役職|勤務|案件|取引先/
const LOVE = /恋愛|恋人|交際|片思い|婚約|結婚|夫婦|好きな人|デート|復縁/
const normalized = (value: string) => value.normalize('NFKC').replace(/[\s、。！？「」『』]/g, '')

function rawCalculationStrings(input?: ReportInput) {
  if (!input) return []
  return unique((input.timing?.annual ?? []).flatMap(item => [item.kanshi, item.tenGod, ...item.themes, ...(item.relationshipSignals ?? []), ...(item.relationshipEvents ?? [])]))
    .filter(value => value.length >= 2)
}
function unique(values: string[]) { return [...new Set(values.filter(Boolean))] }

export function reportContractViolations(report: StructuredReport, input?: ReportInput): ContractViolation[] {
  const violations: ContractViolation[] = []
  const ids = new Set<string>()
  const raw = rawCalculationStrings(input)
  for (const card of report.cards) {
    if (!card.tab) violations.push({ code: 'SCHEMA', path: card.id, message: 'tab is missing' })
    if (card.tags.length === 0) violations.push({ code: 'SCHEMA', path: card.id, message: 'tags are empty' })
    if (ids.has(card.id)) violations.push({ code: 'SCHEMA', path: card.id, message: 'duplicate id' })
    ids.add(card.id)
    const validPendingPersonality = personalityCardShapeIsValid(card)
      && (card.sections?.[0] as PersonalitySection | undefined)?.personality.status === 'pending'
    if (card.kind === 'essence' && card.evidence.length === 0 && !validPendingPersonality) violations.push({ code: 'EMPTY_EVIDENCE', path: card.id, message: 'essence evidence is empty' })
    const sections: ReportSection[] = card.sections ?? card.pages.map(page => ({ heading: page.label, body: page.text, evidence: card.evidence, termGloss: [] }))
    const annualLayout = card.scope === 'self' && card.kind === 'timing' && /^turning-year-\d{4}$/.test(card.id) && card.metadataRefs?.includes(ANNUAL_LAYOUT_VERSION)
    const annual3600 = card.annualCalculation?.version === ANNUAL3600_VERSION
    if (annual3600) {
      const match = /^P(\d{2})-Y(\d{2})$/.exec(card.annualCalculation!.patternId)
      const source = match && Number(match[1]) >= 1 && Number(match[1]) <= 60 && Number(match[2]) >= 1 && Number(match[2]) <= 60 ? annualText(Number(match[1])-1,1983+Number(match[2])) : null
      if (!source || card.title !== source.title || card.summary !== source.description || sections.length !== 4 || sections.slice(0,3).some((s,i)=>s.body !== [source.relationship,source.career,source.life][i])) violations.push({code:'SCHEMA',path:card.id,message:'annual approved text mismatch'})
    }
    const personalityLayout = isPersonalityLayoutCard(card)
    if (personalityLayout && !personalityCardShapeIsValid(card)) {
      violations.push({ code: 'SCHEMA', path: card.id, message: 'invalid personality items, paragraph trace or page parity' })
    }
    if (annualLayout && (sections.length !== 3 || sections.some((s,i)=>s.heading!==ANNUAL_HEADINGS[i]))) {
      violations.push({code:'SCHEMA',path:card.id,message:'annual layout needs its three ordered headings'})
    }
    const bodies = [card.title, card.summary, ...sections.flatMap(section => [section.heading, section.body])]
    const body = bodies.join('\n')
    const jargonBody = personalityLayout
      ? [card.title, card.summary, ...sections.flatMap(section => [section.heading, personalityJargonCheckText(section)])].join('\n') : body
    if (containsJargon(jargonBody)) violations.push({ code: 'JARGON_IN_BODY', path: card.id, message: 'jargon appears in display text' })
    for (const value of raw) if (body.includes(value)) violations.push({ code: 'RAW_CALC_STRING', path: card.id, message: `raw calculation string: ${value}` })
    if (bodies.filter(value => /^あなたは/u.test(value.trim())).length > 1) violations.push({ code: 'YOU_SUBJECT_LIMIT', path: card.id, message: 'more than one section starts with あなたは' })
    if (card.id.startsWith('love-') && WORK.test(body)) violations.push({ code: 'DOMAIN_LEAK', path: card.id, message: 'work language in love chapter' })
    if (card.id.startsWith('work-') && LOVE.test(body)) violations.push({ code: 'DOMAIN_LEAK', path: card.id, message: 'love language in work chapter' })
    const seen = new Set<string>()
    for (const [index, section] of sections.entries()) {
      const headingLength = [...section.heading.trim()].length
      const bodyLength = [...section.body.trim()].length
      const components = section.components ?? []
      const grouped = annualLayout && index > 0 && components.length > 0
      // A composed section is bounded by its individually validated source readings;
      // this is a presentation length rule, not an astrology/scoring threshold.
      if (grouped && (components.length > (index===2?3:20) || section.body !== componentBody(components)
        || components.some(c=>!c.claimId || c.heading.length<1 || c.heading.length>70 || c.body.length<1 || c.body.length>220 || !c.evidence.length)
        || new Set(components.map(c=>c.claimId)).size!==components.length)) {
        violations.push({code:'SCHEMA',path:`${card.id}.sections[${index}]`,message:'invalid annual source components'})
      }
      const bodyLimit = personalityLayout ? 4000 : annual3600 && index === 3 ? 2000 : 220
      if (headingLength < 1 || headingLength > 70 || bodyLength < 1 || (!grouped && bodyLength > bodyLimit)) violations.push({ code: 'SECTION_LENGTH', path: `${card.id}.sections[${index}]`, message: `heading=${headingLength}, body=${bodyLength}` })
      const key = normalized(section.body)
      if (seen.has(key)) violations.push({ code: 'SEMANTIC_DUPLICATE', path: `${card.id}.sections[${index}]`, message: 'duplicate section body' })
      seen.add(key)
    }
    // 確定版資産は salience 0.70 未満で節数を水増ししない。MIN_SECTIONS を
    // 割った章も有効なので、表示契約は「1〜6節」を受け入れる。
    const signSections = (card.sections ?? []).filter(section => section.claimId?.startsWith(`${ANNUAL_SIGN_VERSION}:`))
    const signAllowance = signSections.length <= 3 && signSections.every(section =>
      card.metadataRefs?.includes(`${ANNUAL_SIGN_VERSION}:${section.claimId!.split(':').at(-1)}`)) ? signSections.length : 0
    const expected = annual3600 ? [4,4] : annualLayout ? [3,3] : card.kind === 'essence' ? [1, 6] : card.kind === 'timing' ? [1, 2 + signAllowance] : null
    if (expected && (sections.length < expected[0] || sections.length > expected[1])) violations.push({ code: 'SECTION_LENGTH', path: card.id, message: `section count ${sections.length}` })
    if (!input?.birthTime && /第.+回目/u.test(body)) violations.push({ code: 'BIRTH_TIME_OVERREACH', path: card.id, message: 'ordinal strong claim without birth time' })
  }
  const personalityCards = report.cards.filter(isPersonalityLayoutCard)
  if (personalityCards.length && personalityCards.map(card => card.id).join('|') !== PERSONALITY_CARD_IDS.join('|')) {
    violations.push({ code: 'SCHEMA', path: 'report', message: 'personality needs its fifteen ordered item cards' })
  }
  const allText = report.cards.flatMap(card => [card.title, ...card.tags]).join('\n')
  if (!input && /第一回目/u.test(allText) && !/第二回目/u.test(allText)) violations.push({ code: 'ORDINAL_WITHOUT_SECOND', path: 'report', message: 'first occurrence shown without a second cluster' })
  if (!report.cards.some(card => card.kind === 'timing')) violations.push({ code: 'SCHEMA', path: 'report', message: 'timing card is missing' })
  return violations
}

export function cardContractViolations(cards: ContractCard[]): string[] {
  return reportContractViolations({ version: 3, reportText: '', cards }).map(item => `${item.code}:${item.path}:${item.message}`)
}

export function assertCardContract(report: StructuredReport, input?: ReportInput): void {
  const violations = reportContractViolations(report, input)
  if ((report.chartSections?.length ?? 0) < 5) violations.push({ code: 'SCHEMA', path: 'chartSections', message: 'must contain at least 5 systems' })
  if (violations.length > 0) throw new Error(`Report card contract violated:\n${violations.map(item => `${item.code}:${item.path}:${item.message}`).join('\n')}`)
}

/** Production is fail-open: violations are observable, but never replace a valid report with HTTP 500. */
export function warnReportContract(report: StructuredReport, input: ReportInput, correlationId?: string) {
  const violations = reportContractViolations(report, input)
  if (violations.length > 0) console.warn('Report contract violations', { correlationId, count: violations.length, violations })
  return violations
}
