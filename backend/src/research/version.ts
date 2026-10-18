import { readFileSync } from 'node:fs'
import { digest } from './ledger.js'
export function researchSourceLockHash() {
  return digest(['ledger.ts', 'features.ts', 'evaluation.ts', 'solver.py', 'requirements.txt', 'artifact.ts', 'version.ts'].map(name =>
    readFileSync(new URL(name, import.meta.url), 'utf8')).concat([
      readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'),
      readFileSync(new URL('../lib/researchStagingModel.ts', import.meta.url), 'utf8'),
    ]))
}
