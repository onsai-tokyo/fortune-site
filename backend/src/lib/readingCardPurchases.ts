import {createHash} from 'node:crypto'
import type {JWSTransactionDecodedPayload} from '@apple/app-store-server-library'
import {getSupabaseAdmin} from './supabaseAdmin.js'
import {birthInput} from './timelineContext.js'
import {uuidPattern} from './aiBooks.js'
import {offerKey,readingOffer} from './readingAccessPolicy.js'

export const CARD_PRODUCT = 'com.onsai.fatelab.reading.single'
// Deliberately default off. Enable only after the full disclosure cutover is validated.
export const cardPurchasesEnabled = () => process.env.READING_CARD_PURCHASES === 'enabled'
export function cardEnvironment(): 'Sandbox'|'Production' {
 const value=process.env.READING_CARD_ENVIRONMENT
 if(value!=='Sandbox' && value!=='Production')throw new CardPurchaseError('READING_CARD_CONFIGURATION',503,'購入情報を確認できませんでした。')
 return value
}
export class CardPurchaseError extends Error {
 constructor(public code:string,public status:number,message:string){super(message)}
}
function normalizedBirth(raw:unknown) {
 const b=birthInput(raw)
 if(!b.birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate))throw new CardPurchaseError('READING_CARD_BIRTH',422,'出生情報を確認できませんでした。')
 const original=(raw??{}) as Record<string,unknown>
 return [b.birthDate,b.birthTime||'',b.gender||'',(b.birthplace||'').normalize('NFKC').trim(),b.birthTimeZone||'Asia/Tokyo',original.spouseConvention??'',original.annualYunConvention??'']
}
export function readingTargetKey(row:{kind?:string;birth_data?:unknown;partner_profile_id?:string|null;reading_revision_id?:string|null}) {
 const raw=(row.birth_data??{}) as Record<string,unknown>
 const couple=row.kind==='compatibility' || raw._sourceKind==='compatibility'
 return createHash('sha256').update(JSON.stringify(couple
   ? ['reading-target-v1','couple',row.partner_profile_id?.toLowerCase()??null,normalizedBirth(raw.self),normalizedBirth(raw.partner)]
   : ['reading-target-v1','self',normalizedBirth(raw)])).digest('hex')
}
/** Deleting a profile clears its FK, but an immutable revision retains its ID. */
export async function readingPurchaseIdentity<T extends Parameters<typeof readingTargetKey>[0]>(user:string,row:T):Promise<T> {
 const birth=row.birth_data as {_sourceKind?:string}|undefined
 if((row.kind!=='compatibility' && birth?._sourceKind!=='compatibility') || row.partner_profile_id)return row
 if(!row.reading_revision_id)throw new CardPurchaseError('READING_CARD_SOURCE',503,'購入対象を確認できませんでした。')
 const {data,error}=await getSupabaseAdmin().from('reading_revisions').select('payload').eq('user_id',user).eq('id',row.reading_revision_id).maybeSingle()
 if(error||!data)throw new CardPurchaseError('READING_CARD_SOURCE',503,'購入対象を確認できませんでした。')
 const original=data.payload?.partnerProfileId
 if(original!=null && (typeof original!=='string'||!uuidPattern.test(original)))throw new CardPurchaseError('READING_CARD_SOURCE',503,'購入対象を確認できませんでした。')
 return {...row,partner_profile_id:original??null}
}
export function normalizeCardPurchase(tx:JWSTransactionDecodedPayload,requestUser?:string) {
 const valid=(n:unknown):n is number=>typeof n==='number' && Number.isSafeInteger(n) && n>0 && n<253402300799999
 if(tx.productId!==CARD_PRODUCT || tx.type!=='Consumable' || !tx.appAccountToken || !uuidPattern.test(tx.appAccountToken) ||
    !tx.transactionId || !/^[0-9]{1,64}$/.test(tx.transactionId) || !['Sandbox','Production'].includes(tx.environment??'') ||
    !valid(tx.purchaseDate) || !valid(tx.signedDate) || (tx.revocationDate!==undefined && !valid(tx.revocationDate)) ||
    (requestUser && requestUser.toLowerCase()!==tx.appAccountToken.toLowerCase()))
   throw new CardPurchaseError('READING_CARD_PURCHASE_INVALID',400,'購入したアカウントまたは商品を確認できませんでした。')
 return {user:tx.appAccountToken.toLowerCase(),environment:tx.environment!,transaction:tx.transactionId,
   purchased:new Date(tx.purchaseDate).toISOString(),signed:tx.signedDate,revoked:tx.revocationDate!==undefined}
}
async function rpc(name:string,args:Record<string,unknown>) {
 const {error}=await getSupabaseAdmin().rpc(name,args)
 if(error){
  if(error.message?.includes('READING_CARD_NO_CREDIT'))throw new CardPurchaseError('READING_CARD_NO_CREDIT',409,'購入済みの利用枠がありません。')
  throw new CardPurchaseError('READING_CARD_UNAVAILABLE',503,'購入の反映を確認できませんでした。再購入せず、もう一度お試しください。')
 }
}
/** Always accept verified deliveries/refunds, including when new sales are paused. */
export async function grantVerifiedCardPurchase(tx:JWSTransactionDecodedPayload,requestUser?:string) {
 const v=normalizeCardPurchase(tx,requestUser)
 await rpc('reading_card_grant',{p_user:v.user,p_environment:v.environment,p_transaction:v.transaction,p_purchased:v.purchased,p_signed:v.signed,p_revoked:v.revoked})
 return {verified:true,delivery:'mirrored',transactionId:v.transaction,ownerId:v.user}
}
export async function readingCardBalance(user:string,targetKey:string,environment=cardEnvironment()) {
 const {data,error}=await getSupabaseAdmin().from('reading_card_purchases').select('target_key,offer_key').eq('user_id',user).eq('environment',environment).eq('revoked',false)
 if(error)throw new CardPurchaseError('READING_CARD_UNAVAILABLE',503,'購入済みの鑑定を確認できませんでした。')
 return {credits:(data??[]).filter(x=>x.target_key===null).length,owned:new Set<string>((data??[]).filter(x=>x.target_key===targetKey).map(x=>x.offer_key))}
}
export async function unlockReadingCard(user:string,row:Parameters<typeof readingTargetKey>[0],card:Parameters<typeof readingOffer>[0]) {
 const offer=readingOffer(card)
 if(!offer)throw new CardPurchaseError('READING_CARD_FREE',422,'この鑑定は単品購入の対象ではありません。')
 await rpc('reading_card_unlock',{p_user:user,p_environment:cardEnvironment(),p_target:readingTargetKey(row),p_offer:offerKey(offer)})
}
