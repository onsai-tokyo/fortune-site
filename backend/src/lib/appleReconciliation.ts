import { getSupabaseAdmin } from './supabaseAdmin.js'
import { applyJournalEvent } from './appleEventJournal.js'

// Bounded batches with a cursor prevent one failed receipt from blocking later receipts.
export async function reconcileAppleBatch(after = 0) {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('app_store_event_journal')
    .select('environment,event_id,sequence_id').in('state', ['received', 'failed'])
    .gt('sequence_id', after).order('sequence_id', { ascending: true }).limit(100)
  if (error) throw new Error('APPLE_RECONCILIATION_UNAVAILABLE')
  for (const event of data ?? []) {
    if (event.environment !== 'Sandbox' && event.environment !== 'Production') continue
    try { await applyJournalEvent(event.environment, event.event_id, db) }
    catch { /* The journal retains the failure for the next pass. */ }
  }
  return data?.length === 100 ? Number(data.at(-1)!.sequence_id) : 0
}
