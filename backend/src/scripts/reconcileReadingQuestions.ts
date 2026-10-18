import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { reconciliationOptions } from '../lib/compatibilityReconciliation.js'
import { reconcileQuestions } from '../lib/questionReconciliation.js'
// One operator batch only. Default preview; no public route, schedule or automatic retry.
try {
 const options=reconciliationOptions(process.argv.slice(2))
 const result=await reconcileQuestions(getSupabaseAdmin(),options)
 console.log(JSON.stringify(result))
 if(result.busy)process.exitCode=2
} catch {
 console.error(JSON.stringify({state:'unavailable_or_unacknowledged'}))
 process.exitCode=1
}
