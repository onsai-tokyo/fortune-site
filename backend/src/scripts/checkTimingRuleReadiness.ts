import { measureTimingRuleCoverage } from '../lib/report/timingRuleReadiness.js'

const coverage = measureTimingRuleCoverage()
console.log(JSON.stringify(coverage, null, 2))
if (process.argv.includes('--strict') && !coverage.productionConnectionReady) process.exitCode = 2
