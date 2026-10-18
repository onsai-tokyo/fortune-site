import type { ReportInput } from '../deterministicReport.js'
import type { ReportCard, ReportCardEvidence, ReportSection, StructuredReport } from '../reportCards.js'
import { composePersonality, PERSONALITY_VERSION, PERSONALITY_CATALOG } from './personality/composer.js'
import { TERM_GLOSSARY } from './jargon.js'
import { calculateSpouse, SPOUSE_METHOD_VERSION, type SpousePendingReason } from './personality/spouseCalculation.js'
import { resolveSpouseTimeZone, SPOUSE_BIRTH_CONTEXT_VERSION } from './personality/birthContext.js'
import { finalizeReportProvenance, withCardProvenance } from './provenance.js'

export { PERSONALITY_VERSION }
export const PERSONALITY_LAYOUT_VERSION = 'personality-item-cards-v2'
export const PERSONALITY_SPOUSE_VERSION = `${SPOUSE_METHOD_VERSION}|${SPOUSE_BIRTH_CONTEXT_VERSION}`

// Five editorial groups stay internal; each item is one category + feature-title card.
export const PERSONALITY_CHAPTER_ITEMS = {
  self: ['01_人生の軸', '02_考え方のくせ', '03_学び方と深め方'],
  mind: ['04_感情の動きと伝え方', '05_消耗と回復'],
  others: ['06_外で見せる自分', '07_人との距離'],
  love: ['08_恋の始まり', '09_関係の築き方', '15_配偶者の人物像', '10_家庭での自分'],
  work: ['11_働き方', '12_チームでの役割', '13_合う環境', '14_お金との付き合い方'],
} as const
export const PERSONALITY_ITEM_IDS = Object.values(PERSONALITY_CHAPTER_ITEMS).flat()
export const PERSONALITY_CARD_IDS = PERSONALITY_ITEM_IDS.map(id => `personality-${id.split('_')[0]}`)

export interface PersonalitySection extends ReportSection {
  sourceClaimIds: string[]
  personality: {
    itemId: string
    version: string
    status: 'ready' | 'pending'
    reviewStatus: string
    headline: { paragraphId: string; refs: string[]; method: 'first-interpretation-sentence-v1' }
    paragraphs: Array<{
      id: string; refs: string[]; kind: string; reviewStatus: string
      reviewId?: string
      derivedFrom?: string[]; derivationNote?: string
    }>
  }
}

export interface PersonalityReport extends StructuredReport {
  personality: {
    version: string
    layoutVersion: string
    genderSupplement: null
    spouseCalculationConnected: true
    spouseCalculation: {
      status: 'ready' | 'pending'
      methodVersion: string
      reason?: SpousePendingReason
      star?: string
      branch?: string
    }
    audit: ReturnType<typeof composePersonality>['audit']
  }
}

/** Keep technical source IDs in trace; show people which chart element is read. */
function sourceEvidence(refs: readonly string[]): ReportCardEvidence[] {
  const evidence = new Map<string, ReportCardEvidence>()
  for (const ref of refs) {
    const source = PERSONALITY_CATALOG.sources[ref]
    if (!source) throw new Error('PERSONALITY_SOURCE_MISSING')
    const common = source.key === '（全体）'
    const detail = source.family === 'day_pillar' ? `生まれた日の干支：${source.key}`
      : source.family === 'shukuyo' ? `宿の分類：${source.key}`
      : common ? '配偶者像として読み取れる範囲'
      : source.family === 'spouse_star' ? `配偶者像の計算で得られた星：${source.key}`
      : `生まれた日の十二支：${source.key}`
    evidence.set(`${source.family}:${source.key}`, {
      family: source.family === 'shukuyo' ? '宿曜' : '干支',
      system: source.family === 'shukuyo' ? '宿曜' : source.family.startsWith('spouse_') ? '算命学' : '四柱推命',
      detail,
    })
  }
  return [...evidence.values()]
}

/** Extract a complete sentence; never invent a scene or drop its qualifying clause. */
export function personalityFeatureTitle(text: string): string {
  const opening: Record<string, string> = { '「': '」', '『': '』', '（': '）', '(': ')', '【': '】' }
  const stack: string[] = []
  let end = text.length
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (opening[char]) stack.push(opening[char])
    else if (stack.at(-1) === char) stack.pop()
    if (char === '。' && !stack.length) { end = index + 1; break }
  }
  return text.slice(0, end).trim().replace(/^あなたは[、,]?\s*/u, '').replace(/。$/u, '')
}

/** Approved source text is copied verbatim; this adapter performs no rewriting. */
export function buildPersonalityStructuredReport(input: ReportInput): PersonalityReport {
  const mansion = input.sukuyo.endsWith('宿') ? input.sukuyo : `${input.sukuyo}宿`
  const spouse = calculateSpouse({
    birthDate: input.birthDate, birthTime: input.birthTime,
    timeZone: resolveSpouseTimeZone(input), expectedDayPillar: input.shichuDay,
  })
  const composition = composePersonality({
    dayPillar: input.shichuDay,
    mansion,
    // The birth-chart gender convention is not a request for a prose supplement.
    genderSupplement: null,
    // Never substitute the app's center/west star, which uses a different convention.
    ...(spouse.status === 'ready'
      ? { spouse: { star: spouse.star, branch: spouse.branch } }
      : { pendingSpouseReason: spouse.reason }),
  })
  const expectedChapterIds = Object.keys(PERSONALITY_CHAPTER_ITEMS)
  if (composition.version !== PERSONALITY_VERSION
    || composition.chapters.map(chapter => chapter.id).join('|') !== expectedChapterIds.join('|')) {
    throw new Error('PERSONALITY_LAYOUT_MISMATCH')
  }
  const cards: ReportCard[] = composition.chapters.flatMap(chapter => {
    const expected = PERSONALITY_CHAPTER_ITEMS[chapter.id as keyof typeof PERSONALITY_CHAPTER_ITEMS]
    if (chapter.sections.map(section => section.id).join('|') !== expected.join('|')) throw new Error('PERSONALITY_ITEMS_MISMATCH')
    return chapter.sections.map(section => {
      const headlineParagraph = section.paragraphs.find(p => p.kind === 'astrological_interpretation') ?? section.paragraphs[0]
      const title = personalityFeatureTitle(headlineParagraph.text)
      const detail: PersonalitySection = {
        heading: section.title,
        body: section.paragraphs.map(paragraph => paragraph.text).join('\n\n'),
        evidence: sourceEvidence(section.paragraphs.flatMap(paragraph => paragraph.refs)),
        // The frozen approved spouse recipes use 日支. Keep their original prose
        // and expose its explanation; newly revised material uses plain language.
        termGloss: section.id === '15_配偶者の人物像' && section.reviewStatus === 'representative_reviewed'
          && section.paragraphs.some(p => p.text.includes('日支')) ? TERM_GLOSSARY.filter(t => t.term === '日支') : [],
        claimId: `personality:${PERSONALITY_VERSION}:${section.id}`,
        sourceClaimIds: [...new Set(section.paragraphs.flatMap(paragraph => paragraph.refs))],
        personality: {
          itemId: section.id,
          version: PERSONALITY_VERSION,
          status: section.status,
          reviewStatus: section.reviewStatus,
          headline: { paragraphId: headlineParagraph.id, refs: [...headlineParagraph.refs], method: 'first-interpretation-sentence-v1' },
          paragraphs: section.paragraphs.map(paragraph => ({
            id: paragraph.id, refs: [...paragraph.refs], kind: paragraph.kind, reviewStatus: paragraph.reviewStatus,
            ...(paragraph.reviewId ? { reviewId: paragraph.reviewId } : {}),
            ...(paragraph.derivedFrom ? { derivedFrom: [...paragraph.derivedFrom], derivationNote: paragraph.derivationNote } : {}),
          })),
        },
      }
      return withCardProvenance({
        id: `personality-${section.id.split('_')[0]}`, kind: 'essence', scope: 'self', tab: 'essence', title,
        summary: section.title, tags: [section.title], period: null, sections: [detail],
        pages: [{ role: 'core', label: detail.heading, text: detail.body }],
        evidence: detail.evidence,
        metadataRefs: [PERSONALITY_LAYOUT_VERSION, `personality-version:${PERSONALITY_VERSION}`,
          `personality-spouse-method:${PERSONALITY_SPOUSE_VERSION}`,
          `personality-chapter:${chapter.id}`,
          `personality-item:${section.id}`,
          `personality-review:${section.id}:${section.reviewStatus}`,
          ...detail.sourceClaimIds!.map(ref => `personality-source:${ref}`)],
      }, 'deterministic', 'finding', 0)
    })
  })
  const report: PersonalityReport = {
    version: 3, cards,
    reportText: cards.flatMap(card => [`【${card.title}】`, ...card.sections!.flatMap(section => [section.heading, section.body])]).join('\n\n'),
    personality: { version: PERSONALITY_VERSION, layoutVersion: PERSONALITY_LAYOUT_VERSION,
      genderSupplement: null, spouseCalculationConnected: true,
      // Persist calculation disposition without duplicating a person's birth timestamp.
      spouseCalculation: { status: spouse.status, methodVersion: PERSONALITY_SPOUSE_VERSION,
        ...(spouse.status === 'ready' ? { star: spouse.star, branch: spouse.branch } : { reason: spouse.reason }) },
      audit: composition.audit },
  }
  return { ...report, ...finalizeReportProvenance(report, `${PERSONALITY_VERSION}|${PERSONALITY_LAYOUT_VERSION}|${PERSONALITY_SPOUSE_VERSION}`) }
}

/** Opt-in long-form contract; legacy/claim/timing limits are unchanged. */
export function isPersonalityLayoutCard(card: ReportCard): boolean {
  return Boolean(PERSONALITY_CARD_IDS.includes(card.id) && card.kind === 'essence' && card.scope === 'self'
    && card.metadataRefs?.includes(PERSONALITY_LAYOUT_VERSION)
    && card.metadataRefs.includes(`personality-version:${PERSONALITY_VERSION}`))
}

/** Narrow compatibility for a term in the immutable, source-reviewed spouse recipes. */
export function personalityJargonCheckText(section: ReportSection): string {
  const trace = (section as PersonalitySection).personality
  if (trace?.itemId !== '15_配偶者の人物像' || trace.version !== PERSONALITY_VERSION
    || trace.status !== 'ready' || trace.reviewStatus !== 'representative_reviewed'
    || !section.termGloss?.some(t => t.term === '日支')) return section.body
  const texts = section.body.split('\n\n')
  if (texts.length !== trace.paragraphs.length) return section.body
  return texts.map((text, index) => {
    const paragraph = trace.paragraphs[index]
    const approved = PERSONALITY_CATALOG.paragraphs[paragraph.id]
    return approved?.reviewStatus === 'representative_reviewed' && approved.text === text
      && JSON.stringify(approved.refs) === JSON.stringify(paragraph.refs) && approved.refs.some(ref => ref.startsWith('SB'))
      ? text.replaceAll('日支', '生まれた日の十二支') : text
  }).join('\n\n')
}

export function personalityCardShapeIsValid(card: ReportCard): boolean {
  if (!isPersonalityLayoutCard(card)) return false
  const expected = [PERSONALITY_ITEM_IDS[PERSONALITY_CARD_IDS.indexOf(card.id)]]
  const sections = card.sections as PersonalitySection[] | undefined
  return Boolean(Array.isArray(sections) && sections.length === expected.length && Array.isArray(card.pages) && card.pages.length === sections.length
    && sections.every((section, index) => {
      const trace = section.personality
      const paragraphs = section.body.split('\n\n')
      const headlineIndex = Array.isArray(trace?.paragraphs) ? trace.paragraphs.findIndex(p => p.id === trace.headline?.paragraphId) : -1
      return trace?.itemId === expected[index]
        && card.tags[0] === section.heading && card.summary === section.heading
        && headlineIndex >= 0 && trace.headline?.method === 'first-interpretation-sentence-v1'
        && card.title === personalityFeatureTitle(paragraphs[headlineIndex] ?? '')
        && JSON.stringify(trace.headline.refs) === JSON.stringify(trace.paragraphs[headlineIndex].refs) && trace.version === PERSONALITY_VERSION
        && section.heading === expected[index].split('_').slice(1).join('_')
        && section.claimId === `personality:${PERSONALITY_VERSION}:${expected[index]}`
        && typeof trace.reviewStatus === 'string' && trace.reviewStatus.length > 0
        && ['ready', 'pending'].includes(trace.status)
        && Array.isArray(trace.paragraphs) && trace.paragraphs.length === paragraphs.length && paragraphs.every(text => text.length > 0)
        && trace.paragraphs.every(p => typeof p.id === 'string' && p.id.length > 0 && Array.isArray(p.refs)
          && p.refs.every(ref => typeof ref === 'string' && ref.length > 0) && typeof p.reviewStatus === 'string'
          && (trace.status === 'pending'
            ? trace.paragraphs.length === 1 && p.kind === 'pending_input' && p.refs.length === 0
            : p.refs.length > 0 && ['astrological_interpretation', 'editorial_advice', 'interpretation_limit'].includes(p.kind)))
        && card.pages[index].label === section.heading && card.pages[index].text === section.body
    }))
}
