export type CleanupUser = { id: string; is_anonymous?: boolean; created_at: string; last_sign_in_at?: string | null }
type CountResult = { count: number | null; error?: unknown }
export interface CleanupStore {
  listUsers(page: number): Promise<CleanupUser[]>
  getUser(id: string): Promise<CleanupUser | null>
  countBooks(id: string): Promise<CountResult>
  countGrants(id: string): Promise<CountResult>
  deleteUser(id: string): Promise<void>
}
export function cleanupOptions(args: string[]) {
  if (args.length > 1 || (args.length === 1 && !['--dry-run', '--apply'].includes(args[0]))) throw new Error('Usage: users:cleanup-anonymous [--dry-run | --apply] (default: dry-run)')
  return { apply: args[0] === '--apply' }
}
export async function cleanupAnonymousUsers(store: CleanupStore, options: { apply?: boolean; now?: number } = {}) {
  const cutoffMs = (options.now ?? Date.now()) - 30 * 24 * 60 * 60 * 1000
  const isOldAnonymous = (u: CleanupUser) => u.is_anonymous === true && Number.isFinite(Date.parse(u.last_sign_in_at ?? u.created_at)) && Date.parse(u.last_sign_in_at ?? u.created_at) < cutoffMs
  async function protectedUser(id: string) {
    const results = await Promise.all([store.countBooks(id), store.countGrants(id)])
    if (results.some(r => r.error || r.count === null || !Number.isSafeInteger(r.count) || r.count < 0)) throw new Error('ANONYMOUS_CLEANUP_PROTECTION_QUERY_FAILED')
    return results.some(r => r.count! > 0)
  }
  // Snapshot all candidates before deletion to avoid offset-pagination skips.
  const candidates = new Map<string, CleanupUser>()
  let scanned = 0
  for (let page = 1; ; page++) {
    const users = await store.listUsers(page)
    scanned += users.length
    for (const user of users) if (isOldAnonymous(user)) candidates.set(user.id, user)
    if (users.length < 1000) break
  }
  const eligible: string[] = []
  // Complete protection preflight before any write; dry-run never deletes.
  for (const user of candidates.values()) if (!await protectedUser(user.id)) eligible.push(user.id)
  let removed = 0
  let skippedOnRecheck = 0
  if (options.apply === true) {
    for (const id of eligible) {
      const current = await store.getUser(id)
      if (!current || !isOldAnonymous(current) || await protectedUser(id)) { skippedOnRecheck++; continue }
      await store.deleteUser(id)
      removed++
    }
  }
  return { mode: options.apply === true ? 'apply' : 'dry-run', cutoff: new Date(cutoffMs).toISOString(), scanned, candidates: eligible.length, removed, skippedOnRecheck }
}
