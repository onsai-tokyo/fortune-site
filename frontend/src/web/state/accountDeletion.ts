export const ACCOUNT_DELETE_FAILED = '退会を完了できませんでした。削除結果を確認できないため、この画面に留まっています。通信状態を確認し、解決しない場合はお問い合わせください。'
export const ACCOUNT_DELETE_AUTH_REQUIRED = 'ログイン状態を確認できません。退会は実行していません。ログインし直してからお試しください。'
export const ACCOUNT_DELETE_OWNER_CHANGED = 'ログイン中のアカウントが変わったため、退会処理を停止しました。現在のアカウントを確認してください。'
export const ACCOUNT_DELETE_SIGNOUT_FAILED = 'アカウントの削除は完了しましたが、この端末のログアウトに失敗しました。もう一度押すとログアウトだけを再試行します。'

interface Dependencies {
  remote: boolean
  currentOwner: () => string | null
  session: () => Promise<{ owner: string; token: string } | null>
  remove: (token: string) => Promise<void>
  signOut: () => Promise<void>
  clearLocal: (owner?: string) => void
}

/** Never turn a missing session or uncertain DELETE into a successful exit. */
export function createAccountDeletion(deps: Dependencies) {
  let busy = false
  let confirmedOwner: string | null = null
  return async () => {
    if (busy) throw new Error('退会処理中です。完了までお待ちください。')
    busy = true
    try {
      if (!deps.remote) { deps.clearLocal(); return }
      const owner = deps.currentOwner()
      if (!owner) throw new Error(ACCOUNT_DELETE_AUTH_REQUIRED)
      const current = () => deps.currentOwner() === owner
      if (confirmedOwner !== owner) {
        const session = await deps.session()
        if (!current()) throw new Error(ACCOUNT_DELETE_OWNER_CHANGED)
        if (!session || session.owner !== owner || !session.token) throw new Error(ACCOUNT_DELETE_AUTH_REQUIRED)
        await deps.remove(session.token)
        confirmedOwner = owner
      }
      if (!current()) throw new Error(ACCOUNT_DELETE_OWNER_CHANGED)
      try { await deps.signOut() } catch { throw new Error(ACCOUNT_DELETE_SIGNOUT_FAILED) }
      // SIGNED_OUT may already have cleared the owner; never clear a new one.
      if (deps.currentOwner() !== null && !current()) throw new Error(ACCOUNT_DELETE_OWNER_CHANGED)
      deps.clearLocal(owner)
      confirmedOwner = null
    } finally { busy = false }
  }
}
