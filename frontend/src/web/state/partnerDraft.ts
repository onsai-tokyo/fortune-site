import type { Partner } from '../data/types'

export type PartnerDraft = Omit<Partner, 'id'>
export type PendingPartner = {
  version: 2; input: PartnerDraft; operationId: string; oldPartnerId: string | null;
  deleted: boolean; registeredId?: string
}
export const pendingPartnerKey = (owner: string) => `fatelab:web:pending-partner:${owner}:v1`
export function partnerDraftFromRaw(raw: string | null): PartnerDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const value = parsed.version === 2 ? parsed.input : parsed
    if (typeof value.name !== 'string' || typeof value.relation !== 'string' ||
      typeof value.birthDate !== 'string' || typeof value.birthPlace !== 'string' ||
      !['male', 'female'].includes(value.gender) ||
      !(value.birthTime === null || typeof value.birthTime === 'string') ||
      !(value.metYear === null || Number.isInteger(value.metYear))) return null
    return { name: value.name, relation: value.relation, birthDate: value.birthDate,
      birthTime: value.birthTime, birthPlace: value.birthPlace, gender: value.gender, metYear: value.metYear }
  } catch { return null }
}
export function pendingPartnerFromRaw(raw: string | null): PendingPartner | null {
  const input = partnerDraftFromRaw(raw)
  if (!raw || !input) return null
  const value = JSON.parse(raw)
  const uuid = (id: unknown) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  if (value.version !== 2 || !uuid(value.operationId) ||
    !(value.oldPartnerId === null || uuid(value.oldPartnerId)) || typeof value.deleted !== 'boolean' ||
    !(value.registeredId === undefined || uuid(value.registeredId))) return null
  return { version: 2, input, operationId: value.operationId, oldPartnerId: value.oldPartnerId,
    deleted: value.deleted, ...(value.registeredId === undefined ? {} : { registeredId: value.registeredId }) }
}
export function pendingPartnerNotice(raw: string | null): string | null {
  if (!partnerDraftFromRaw(raw)) return null
  const pending = pendingPartnerFromRaw(raw)
  if (pending?.registeredId) return '相手は登録済みです。入力を復元しました。もう一度押すと登録を重複させずに年の保存と読み込みを再確認します。'
  if (pending?.deleted) return '前の相手は削除済みです。未完了の登録入力を復元しました。同じ入力でもう一度登録してください。'
  return '未完了の登録入力を復元しました。同じ入力でもう一度押すと、登録状況を確認して再開します。'
}
