import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { reconciliationOptions, reconcileCompatibility } from '../lib/compatibilityReconciliation.js'

// Internal, one bounded batch only. Default is read-only; no scheduling or retry loop.
try {
 const options=reconciliationOptions(process.argv.slice(2))
 const result=await reconcileCompatibility(getSupabaseAdmin(),options)
 console.log(JSON.stringify(result))
 if(result.busy)process.exitCode=2
} catch {
 // A failed response can mean an unknown commit. Re-run preview before a deliberate retry.
 console.error(JSON.stringify({state:'unavailable_or_unacknowledged'}))
 process.exitCode=1
}
