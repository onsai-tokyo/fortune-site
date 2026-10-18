/** Local generation audit. No DB, network, history fitting, or snapshot writes. */
import { buildFixtureReportInput, type BirthFixture } from '../lib/report/fixtures.js'
import { buildSelfReport } from '../lib/report/buildSelfReport.js'
import { extractReportMetadata } from '../lib/report/metadata.js'
import { CLAIM_ASSETS } from '../lib/report/claimAssets.js'
import { TIMING_CLAIM_ASSETS } from '../lib/report/timingClaimAssets.js'
import { LIFE_EVENTS } from '../lib/report/lifeEventLabels.js'
import { buildAnnualHistoryCards } from '../lib/report/timingCards.js'
import { ANNUAL_PHRASE_COUNT, ANNUAL_COMBINATIONS } from '../lib/report/timingAnnualNarrative.js'

const fixtures: BirthFixture[] = [
  { id: 'A', birthDate: '1995-02-20', birthTime: '03:02', birthplace: '愛知県', gender: 'female', group: 'same-year' },
  { id: 'B', birthDate: '1995-06-30', birthTime: null, birthplace: '高知県', gender: 'female', group: 'same-year' },
]
const samples = fixtures.map(fixture => {
  const input = buildFixtureReportInput(fixture, new Date('2026-09-08T00:00:00Z'))
  const result = buildSelfReport(input, extractReportMetadata(input))
  return {
    fixture, dayPillar: input.shichuDay,
    facts: result.facts.map(f => ({ id: f.id, factor: f.factor, requiresBirthTime: f.requiresBirthTime })),
    essence: result.report.cards.filter(c => c.kind === 'essence').map(c => ({ id: c.id, title: c.title, claims: c.sections?.map(s => s.claimId) ?? [] })),
    annual: buildAnnualHistoryCards(input, 2026).map(c => ({ id: c.id, title: c.title, summary: c.summary, refs: c.metadataRefs })),
    calculatedYears: input.timing?.annual.filter(y => y.year <= 2026),
  }
})
const [a, b] = samples
const aClaims = new Set(a.essence.flatMap(c => c.claims))
const bClaims = new Set(b.essence.flatMap(c => c.claims))
const overlap = [...aClaims].filter(c => bClaims.has(c))
console.log(JSON.stringify({
  scope: 'current local default pipeline; not fetched stored/device reports',
  inventory: {
    annualPhrases: ANNUAL_PHRASE_COUNT,
    annualCombinationRules: ANNUAL_COMBINATIONS.map(c => ({ id: c.id, requires: c.requires })),
    personalityAssets: CLAIM_ASSETS.length,
    personalityTriggers: Object.fromEntries([...new Set(CLAIM_ASSETS.map(a => a.trigger.kind))].map(kind => [kind, CLAIM_ASSETS.filter(a => a.trigger.kind === kind).length])),
    eventCategories: LIFE_EVENTS.map(e => ({ key: e.key, label: e.label })),
    // Inventory only: enabled is an asset flag, not production approval.
    shadowTimingAssets: TIMING_CLAIM_ASSETS.length,
    shadowCompound: TIMING_CLAIM_ASSETS.filter(a => a.specificity === 'compound').length,
    shadowSingleByEvent: Object.fromEntries(LIFE_EVENTS.map(e => [e.key, TIMING_CLAIM_ASSETS.filter(a => a.events.length === 1 && a.events[0] === e.key).length])),
  },
  comparison: {
    essenceClaimCounts: [aClaims.size, bClaims.size], sharedClaimCount: overlap.length, sharedClaims: overlap,
    sameEssenceHeadings: a.essence.filter(c => b.essence.some(d => c.id === d.id && c.title === d.title)).map(c => c.id),
    sameAnnualHeadings: a.annual.filter(c => b.annual.some(d => c.id === d.id && c.title === d.title)).map(c => c.id),
    sameAnnualBodies: a.annual.filter(c => b.annual.some(d => c.id === d.id && c.summary === d.summary)).map(c => c.id),
  }, samples,
}, null, 2))
