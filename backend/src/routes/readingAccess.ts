import {Router,type Response} from 'express'
import {requireAuth,type AuthRequest} from '../middleware/auth.js'
import {getSupabaseAdmin} from '../lib/supabaseAdmin.js'
import {hasPremiumAccess} from '../lib/premium.js'
import {resolveBookFocus} from '../lib/aiBookFocus.js'
import {BookError,uuidPattern} from '../lib/aiBooks.js'
import {CARD_PRODUCT,CardPurchaseError,cardPurchasesEnabled,readingCardBalance,readingTargetKey,readingPurchaseIdentity,unlockReadingCard} from '../lib/readingCardPurchases.js'
import {canReadOffer,projectReadingCard,readingOffer} from '../lib/readingAccessPolicy.js'

export const readingAccessRouter=Router()
async function handle(req:AuthRequest,res:Response,unlock:boolean) {
 res.setHeader('Cache-Control','private, no-store')
 if(!cardPurchasesEnabled()){res.json({enabled:false});return}
 const {conversationId,cardId}=req.body??{}
 if(typeof conversationId!=='string' || !uuidPattern.test(conversationId) || typeof cardId!=='string' || !cardId.length || cardId.length>200){res.status(422).json({error:'鑑定を開き直してください。'});return}
 try {
  const {data:row,error}=await getSupabaseAdmin().from('reading_conversations')
   .select('kind,birth_data,partner_profile_id,calculated_data,reading_revision_id').eq('user_id',req.userId!).eq('id',conversationId).maybeSingle()
  if(error)throw error
  if(!row){res.status(404).json({error:'鑑定が見つかりません。'});return}
  const identity=await readingPurchaseIdentity(req.userId!,row)
  const resolved=await resolveBookFocus(identity,cardId,req.accessToken!,req.userId!)
  if(!resolved)throw new CardPurchaseError('READING_CARD_NOT_FOUND',404,'鑑定を確認できませんでした。')
  const card={...resolved,scope:resolved.scope??(row.kind==='compatibility'?'couple':'self') as 'self'|'couple'}
  const premium=await hasPremiumAccess(req.userId!)
  if(unlock && !premium && readingOffer(card))await unlockReadingCard(req.userId!,identity,card)
  const balance=await readingCardBalance(req.userId!,readingTargetKey(identity))
  res.json({enabled:true,productId:CARD_PRODUCT,premium,credits:balance.credits,
    unlocked:canReadOffer(readingOffer(card),premium,balance.owned),card:projectReadingCard(card,premium,balance.owned)})
 }catch(error){
  if(error instanceof CardPurchaseError || error instanceof BookError){res.status(error.status).json({code:error.code,error:error.message});return}
  res.status(503).json({error:'購入状況を確認できませんでした。再購入せず、もう一度お試しください。'})
 }
}
readingAccessRouter.post('/status',requireAuth,(req,res)=>handle(req,res,false))
readingAccessRouter.post('/unlock',requireAuth,(req,res)=>handle(req,res,true))
