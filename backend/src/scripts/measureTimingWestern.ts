import { calcAstrology, calcTimeIndependentWesternAnnualAspects } from '../lib/astrology.js'
import { computeTimingScore, type TimingEvidenceDefinition } from '../lib/report/timingScoreEngine.js'
import { buildWesternTimingEvidence } from '../lib/report/timingWesternEvidence.js'

const requested = Number(process.argv[2] ?? 100)
const keys = ['relationship_disruption', 'relationship_idealization', 'career_activation'] as const
const percentile = (values: number[], ratio: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const position = (sorted.length - 1) * ratio
  const lower = Math.floor(position); const fraction = position - lower
  return sorted[lower]! + ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!) * fraction
}
const describe = (values: number[]) => ({
  p10: percentile(values, 0.1), median: percentile(values, 0.5), p90: percentile(values, 0.9), max: Math.max(...values),
  nonZeroRatio: values.filter(value => value > 0).length / values.length,
})

const scoreValues = (definitions: readonly TimingEvidenceDefinition[]) =>
  Object.fromEntries(keys.map(key => [key, computeTimingScore(key, definitions).rawSupport])) as Record<(typeof keys)[number], number>

const timedValues = Object.fromEntries(keys.map(key => [key, [] as number[]])) as Record<(typeof keys)[number], number[]>
const untimedValues = Object.fromEntries(keys.map(key => [key, [] as number[]])) as Record<(typeof keys)[number], number[]>
const hitCounts = { timed: new Map<string, number>(), untimed: new Map<string, number>() }
let personYears = 0; let timedCapHits = 0; let untimedCapHits = 0; let untimedStrongerCount = 0

for (let index = 0; index < requested; index += 1) {
  const year = 1965 + (index * 17) % 42
  const month = 1 + (index * 7) % 12
  const day = 1 + (index * 11) % 28
  const hour = (index * 5) % 24
  const minute = (index * 13) % 60
  const birthplace = index % 3 === 0 ? '東京都' : index % 3 === 1 ? '愛知県' : '沖縄県'
  const untimed = buildWesternTimingEvidence(calcTimeIndependentWesternAnnualAspects(year, month, day))
  const profile = calcAstrology(year, month, day, hour, minute, birthplace)
  if (!profile.annual) throw new Error('時刻あり西洋年運が生成されません')
  const timed = buildWesternTimingEvidence(profile.annual.map(item => ({
    year: item.year,
    aspects: item.westernAspects.filter(aspect => !['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)),
    angleAspects: item.westernAspects.filter(aspect => ['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)),
  })), { hasBirthTime: true })
  for (const [targetYear, timedDefinitions] of timed) {
    personYears += 1
    const untimedDefinitions = untimed.get(targetYear)!
    for (const [mode, definitions] of [['timed', timedDefinitions], ['untimed', untimedDefinitions]] as const) {
      const seen = new Set<string>()
      for (const item of definitions) if (item.available && item.matched && !seen.has(`${item.scoreKey}:${item.factLineageId}`)) {
        seen.add(`${item.scoreKey}:${item.factLineageId}`)
        const key = `${item.scoreKey}:${item.factLineageId}`
        hitCounts[mode].set(key, (hitCounts[mode].get(key) ?? 0) + 1)
      }
    }
    const timedScores = scoreValues(timedDefinitions)
    const untimedScores = scoreValues(untimedDefinitions)
    for (const key of keys) {
      timedValues[key].push(timedScores[key]); untimedValues[key].push(untimedScores[key])
      if (untimedScores[key] > timedScores[key] + 1e-9) untimedStrongerCount += 1
    }
    if (Object.values(timedScores).some(value => value >= 0.24)) timedCapHits += 1
    if (Object.values(untimedScores).some(value => value >= 0.24)) untimedCapHits += 1
  }
}

const rates = (map: Map<string, number>) => Object.fromEntries([...map].sort().map(([key, value]) => [key, Number((value / personYears).toFixed(6))]))
process.stdout.write(`${JSON.stringify({
  sampleCount: requested, personYears,
  timed: { lineageHitRates: rates(hitCounts.timed), scores: Object.fromEntries(keys.map(key => [key, describe(timedValues[key])])), familyCapHitRatio: timedCapHits / personYears },
  untimed: { lineageHitRates: rates(hitCounts.untimed), scores: Object.fromEntries(keys.map(key => [key, describe(untimedValues[key])])), familyCapHitRatio: untimedCapHits / personYears },
  untimedStrongerComparisons: untimedStrongerCount,
}, null, 2)}\n`)
