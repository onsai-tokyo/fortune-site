import type { StorageLike } from './selfGenerationRecovery'

export type CompatibilityInput = { partnerId: string; conversationId: string; relationshipType: string; relationshipLabel: string }
export type CompatibilityOperation = { version: 1; id: string; input: CompatibilityInput }
export const compatibilityKey = (owner: string) => `fatelab:compatibility:v1:${owner}`
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const validInput = (input: CompatibilityInput) => input && uuid(input.partnerId) && uuid(input.conversationId) && typeof input.relationshipType === 'string' && typeof input.relationshipLabel === 'string'
export function loadCompatibilityOperation(storage: StorageLike, owner: string): CompatibilityOperation | null {
  const raw = storage.getItem(compatibilityKey(owner))
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as CompatibilityOperation
    if (value.version === 1 && uuid(value.id) && validInput(value.input)) return value
  } catch { /* Keep unreadable pending data: overwriting it could charge twice. */ }
  throw new Error('前の相性鑑定の操作情報を確認できません。履歴を確認してください')
}

/** Caller supplies an exclusive owner lock (Web Locks in the browser), held through recovery. */
export async function recoverCompatibility(options: {
  owner: string; input: CompatibilityInput; releaseCheckedOperation?: boolean; storage: StorageLike; check: () => void;
  authorize: (refresh: boolean) => Promise<string>; fetcher: typeof fetch; newID: () => string;
  lock: <T>(name: string, work: () => Promise<T>) => Promise<T>;
}): Promise<string> {
  const { owner, input, storage, check } = options
  if (!owner || !validInput(input)) throw new Error('保存済みの本人鑑定と相手を選択してください')
  return options.lock(compatibilityKey(owner), async () => {
    check()
    let operation = loadCompatibilityOperation(storage, owner)
    const existed = !!operation
    if (!existed && options.releaseCheckedOperation) return ''
    if (operation && JSON.stringify([operation.input.partnerId, operation.input.conversationId, operation.input.relationshipType, operation.input.relationshipLabel]) !== JSON.stringify([input.partnerId, input.conversationId, input.relationshipType, input.relationshipLabel])) throw new Error('前の相性鑑定を同じ入力で確認してください')
    if (!operation) {
      const id = options.newID()
      if (!uuid(id)) throw new Error('操作IDを作成できませんでした')
      operation = { version: 1, id, input: { partnerId: input.partnerId, conversationId: input.conversationId, relationshipType: input.relationshipType, relationshipLabel: input.relationshipLabel } }
      storage.setItem(compatibilityKey(owner), JSON.stringify(operation))
    }
    const entry = operation
    const current = () => {
      check()
      if (JSON.stringify(loadCompatibilityOperation(storage, owner)) !== JSON.stringify(entry)) throw new Error('別の画面で相性鑑定の操作が変更されました')
    }
    let refreshed = false
    const request = async (path: string, body?: string) => {
      for (;;) {
        current()
        const token = await options.authorize(refreshed)
        current()
        const response = await options.fetcher(path, {
          method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': entry.id }, body,
        })
        current()
        if (response.status === 401 && !refreshed) { refreshed = true; continue }
        if (!response.ok) throw new Error(`相性鑑定の状態を確認できません（${response.status}）。同じ入力で再確認してください`)
        const value = await response.json() as Record<string, unknown>
        current()
        return value
      }
    }
    const finish = (value: Record<string, unknown>, report: unknown) => {
      const result = report as Record<string, unknown> | null
      if (!uuid(value.conversationId) || !result || ![2, 3].includes(Number(result.version)) || typeof result.reportText !== 'string' || !result.reportText.trim() || !Array.isArray(result.cards) || !result.cards.length) throw new Error('保存済みの相性鑑定を確認できませんでした')
      // Retain the operation until the caller explicitly moves on; a reload must GET, never generate again.
      return value.conversationId
    }
    if (existed) {
      let status = await request(`/api/partners/compatibility/operations/${entry.id}`)
      if (status.state === 'not_found' && options.releaseCheckedOperation) {
        status = await request(`/api/partners/compatibility/operations/${entry.id}/cancel`, '{}')
      }
      if (status.state === 'completed') {
        const conversationId = finish(status, status.result)
        if (options.releaseCheckedOperation) { current(); storage.removeItem(compatibilityKey(owner)) }
        return conversationId
      }
      if (status.state === 'failed' || status.state === 'deleted') {
        current(); storage.removeItem(compatibilityKey(owner))
        if (options.releaseCheckedOperation) return ''
        throw new Error('前の相性鑑定は終了しています。新しく作成する場合はもう一度操作してください')
      }
      if (status.state === 'not_found' && options.releaseCheckedOperation) throw new Error('前の操作が未登録です。同じ入力で確認・再開してください')
      if (status.state !== 'not_found') throw new Error('前の相性鑑定を確認中です。時間をおいて同じ入力で再確認してください')
    }
    const { partnerId, ...body } = entry.input
    const result = await request(`/api/partners/${partnerId}/compatibility`, JSON.stringify(body))
    return finish(result, result)
  })
}
