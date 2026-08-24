import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { assessCompatibilityCutoverReadiness, assessDeterministicCutoverReadiness } from '../lib/report/deterministicCutoverReadiness.js'
import { TRAIT_SCORE_RULES } from '../lib/report/traitScores.js'
import { COMPATIBILITY_PROFILE_KEYS } from '../lib/report/synastryFacts.js'

const reportDir = resolve(dirname(fileURLToPath(import.meta.url)), '../lib/report')
const read = (name: string) => {
  const path = resolve(reportDir, 'rules', name)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}
const self = assessDeterministicCutoverReadiness(
  read('PERSONALITY_RULES.md'),
  read('EVENT_RULES.md'),
  TRAIT_SCORE_RULES,
)
const compatibility = assessCompatibilityCutoverReadiness(
  read('COMPATIBILITY_RULES.md'),
  COMPATIBILITY_PROFILE_KEYS,
)

console.log(JSON.stringify({ self, compatibility }, null, 2))
if (!self.ready) process.exitCode = 1
