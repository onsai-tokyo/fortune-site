import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { assessDeterministicCutoverReadiness } from '../lib/report/deterministicCutoverReadiness.js'
import { TRAIT_SCORE_RULES } from '../lib/report/traitScores.js'

const reportDir = resolve(dirname(fileURLToPath(import.meta.url)), '../lib/report')
const read = (name: string) => {
  const path = resolve(reportDir, 'rules', name)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}
const result = assessDeterministicCutoverReadiness(
  read('PERSONALITY_RULES.md'),
  read('EVENT_RULES.md'),
  TRAIT_SCORE_RULES,
)

console.log(JSON.stringify(result, null, 2))
if (!result.ready) process.exitCode = 1
