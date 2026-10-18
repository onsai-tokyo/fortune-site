import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const baseline = '79da2705966908e91bf49004fad89fbc9bca9837'
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' })
const protectedPaths = ['ios', 'backend/src/lib/report', 'backend/src/lib/reportCards.ts',
  'backend/src/lib/deterministicReport.ts', 'backend/src/lib/astrology.ts', 'backend/src/lib/divination',
  'backend/src/routes/aiBooks.ts', 'backend/src/lib/aiBooks.ts', 'backend/src/routes/apple.ts',
  'backend/src/routes/partners.ts', 'backend/src/routes/preview.ts', 'backend/src/routes/coupleTimeline.ts',
  'backend/src/routes/timeline.ts', 'backend/src/scripts/aiBookWorker.ts',
  'backend/supabase/ai_books_review_credits_20261007.sql', 'backend/supabase/ai_books_trial_20261008.sql',
  'backend/supabase/ai_books_device_trial_20261012.sql']
const changed = git(['diff', '--name-only', baseline, '--', ...protectedPaths]).trim()
if (changed) throw new Error(`Protected main paths changed:\n${changed}`)
function exact(path, transform) {
  const original = git(['show', `${baseline}:${path}`])
  if (transform(original) !== readFileSync(resolve(root, path), 'utf8')) throw new Error(`Unexpected shared API edit: ${path}`)
}
exact('backend/src/routes/reading.ts', s => s.replace('const questionLimiter = rateLimit({', 'export const questionLimiter = rateLimit({'))
exact('backend/src/index.ts', s => s
  .replace("import { aiBooksRouter } from './routes/aiBooks.js'", "import { aiBooksRouter } from './routes/aiBooks.js'\nimport { webRouter } from './routes/web.js'")
  .replace("app.use('/api/books', aiBooksRouter)", "app.use('/api/web', webRouter)\napp.use('/api/books', aiBooksRouter)"))
console.log('PASS main iOS / engines / Apple / books / existing APIs preserved; shared edits are additive mounts and limiter export only; architecture assertions updated separately')
