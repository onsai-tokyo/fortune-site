import { config } from 'dotenv'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { cleanupAnonymousUsers, cleanupOptions, type CleanupStore } from '../lib/anonymousCleanup.js'

const options = cleanupOptions(process.argv.slice(2))
config({ override: false })
const admin = getSupabaseAdmin()
const store: CleanupStore = {
  async listUsers(page) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users) throw new Error('ANONYMOUS_CLEANUP_LIST_FAILED')
    return data.users
  },
  async getUser(id) {
    const { data, error } = await admin.auth.admin.getUserById(id)
    if (error) throw new Error('ANONYMOUS_CLEANUP_USER_RECHECK_FAILED')
    return data.user
  },
  countBooks: async id => admin.from('ai_books').select('id', { count: 'exact', head: true }).eq('user_id', id),
  countGrants: async id => admin.from('ai_book_grants').select('id', { count: 'exact', head: true }).eq('user_id', id),
  async deleteUser(id) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw new Error('ANONYMOUS_CLEANUP_DELETE_FAILED')
  },
}
try { console.log(JSON.stringify(await cleanupAnonymousUsers(store, options))) }
catch { console.error('匿名アカウント清掃を中断しました。以降の削除は実行しません。'); process.exitCode = 1 }
