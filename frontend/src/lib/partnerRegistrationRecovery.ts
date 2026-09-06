import type { StorageLike } from './selfGenerationRecovery'
export type PartnerInput = { displayName: string; birthDate: string; birthTime: string; birthplace: string; gender: 'male' | 'female'; relationshipLabel: string }
export const partnerRelationshipLabels = ['片思い','お付き合い中','婚約中','夫婦','復縁希望','元恋人','友人','親友','会社の同僚','上司','部下','取引先','その他','親','子','兄弟姉妹','配偶者の家族']
export type RegisteredPartner = { id: string; display_name: string; relationship_label: string }
type Operation = { version: 1; id: string; payload: string }
export const registrationKey = (owner: string) => `fatelab:partner-registration:v1:${owner}`
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
function payload(input: PartnerInput) {
  const [y,m,d] = input.birthDate?.split('-').map(Number) ?? []
  const days = [31,y%4===0 && (y%100!==0 || y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31]
  if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 40 || typeof input.birthplace !== 'string' || !input.birthplace.trim() || input.birthplace.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || !(y>=1 && m>=1 && m<=12 && d>=1 && d<=days[m-1]) || typeof input.birthTime !== 'string' || (input.birthTime!=='' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.birthTime)) || !['male','female'].includes(input.gender) || typeof input.relationshipLabel !== 'string' || !partnerRelationshipLabels.includes(input.relationshipLabel)) throw new Error('相手の表示名・生年月日・出生地・性別・出生時刻を確認してください')
  return JSON.stringify({displayName:input.displayName.trim(),birthDate:input.birthDate,birthTime:input.birthTime,birthplace:input.birthplace.trim(),gender:input.gender,relationshipLabel:input.relationshipLabel})
}
export function loadPartnerRegistration(storage: StorageLike, owner: string): Operation | null {
  const raw = storage.getItem(registrationKey(owner))
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Operation
    if (value.version===1 && uuid(value.id) && typeof value.payload==='string' && payload(JSON.parse(value.payload))===value.payload) return value
  } catch { /* Do not discard an uncertain write. */ }
  throw new Error('前の登録情報を確認できません。保存情報を消さずに確認してください')
}
export async function recoverPartnerRegistration(options: {
  owner: string; input?: PartnerInput; release?: boolean; storage: StorageLike; check: () => void;
  authorize: (refresh: boolean) => Promise<string>; fetcher: typeof fetch; newID: () => string;
  lock: <T>(key: string, work: () => Promise<T>) => Promise<T>;
}): Promise<RegisteredPartner | null> {
  const {owner,storage,check} = options
  if (!owner) throw new Error('ログインしてください')
  return options.lock(registrationKey(owner), async () => {
    check()
    let entry = loadPartnerRegistration(storage,owner)
    const existed = !!entry
    if (!entry) {
      if(options.release) return null
      if(!options.input) throw new Error('相手の情報を入力してください')
      const body=payload(options.input),id=options.newID()
      if(!uuid(id)) throw new Error('操作IDを作成できませんでした')
      entry={version:1,id,payload:body}
      storage.setItem(registrationKey(owner),JSON.stringify(entry))
    } else if(options.input && payload(options.input)!==entry.payload) throw new Error('前の登録結果を先に確認してください')
    const operation=entry
    const current=()=>{
      check()
      if(JSON.stringify(loadPartnerRegistration(storage,owner))!==JSON.stringify(operation)) throw new Error('別の画面で登録操作が変更されました')
    }
    let refreshed=false
    async function request(path:string,body?:string) {
      for(;;){
        current();const token=await options.authorize(refreshed);current()
        const response=await options.fetcher(path,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':operation.id},body});current()
        if(response.status===401 && !refreshed){refreshed=true;continue}
        if(!response.ok) throw new Error(response.status===409?'登録上限または入力の競合を確認してください。前の登録情報は保持しています':`登録結果を確認できません（${response.status}）。前の登録を再確認してください`)
        const result=await response.json();current();return result
      }
    }
    let result
    if(existed){
      let state=await request(`/api/partners/registration/operations/${operation.id}`)
      if(state.state==='not_found' && options.release)state=await request(`/api/partners/registration/operations/${operation.id}/cancel`,'{}')
      if(state.state==='deleted' || state.state==='cancelled'){
        current();storage.removeItem(registrationKey(owner))
        if(options.release)return null
        throw new Error('前の登録操作は終了しています。新しい登録はもう一度操作してください')
      }
      if(state.state==='completed')result=state
      else if(state.state!=='not_found' || options.release)throw new Error('前の登録が未確定です。先に同じ登録を再開してください')
    }
    result ??= await request('/api/partners',operation.payload)
    const partner=result?.partner
    if(!uuid(partner?.id) || typeof partner?.display_name!=='string' || !partner.display_name.trim() || !partnerRelationshipLabels.includes(partner.relationship_label)) throw new Error('登録結果の形式を確認できませんでした')
    current()
    if(options.release)storage.removeItem(registrationKey(owner))
    return {id:partner.id,display_name:partner.display_name,relationship_label:partner.relationship_label}
  })
}
