import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { applyJournalEvent } from '../lib/appleEventJournal.js'

// Internal operator CLI. Never scheduled or invoked by the public request path.
// No default write run: --apply must be explicitly supplied.
const apply = process.argv.includes('--apply')
const cursorIndex = process.argv.indexOf('--after')
const after = cursorIndex < 0 ? 0 : Number(process.argv[cursorIndex + 1])
if (!Number.isSafeInteger(after) || after < 0) throw new Error('Invalid sequence cursor')
const db = getSupabaseAdmin()
const { data, error } = await db.from('app_store_event_journal').select('environment,event_id,sequence_id,attempts,last_error')
  .in('state', ['received','failed']).gt('sequence_id', after).order('sequence_id', { ascending: true }).limit(100)
if (error) { console.error(JSON.stringify({ state: 'unavailable' })); process.exitCode = 1 }
else {
  let completed = 0, pending = 0
  for (const event of data ?? []) {
    if (!apply) { pending++; continue }
    if (event.environment !== 'Sandbox' && event.environment !== 'Production') { pending++; continue }
    try { await applyJournalEvent(event.environment, event.event_id, db); completed++ } catch { pending++ }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry_run', examined: data?.length ?? 0, completed, pending, nextSequence: data?.at(-1)?.sequence_id ?? after }))
}
