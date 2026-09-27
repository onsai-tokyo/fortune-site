import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { getSupabaseUser } from '../lib/supabaseUser.js'
import { partnerReadingFromBirthSnapshot } from '../lib/report/partnerReading.js'

export async function handlePartnerReading(req: AuthRequest, res: Response, db = getSupabaseUser) {
  const {data,error} = await db(req.accessToken!).from('reading_conversations')
    .select('birth_data,kind').eq('id',req.params.id).eq('user_id',req.userId!).maybeSingle()
  if(error) {res.status(503).json({error:'あの人の鑑定を取得できませんでした'});return}
  if(!data) {res.status(404).json({error:'鑑定履歴が見つかりません'});return}
  if(data.kind!=='compatibility') {res.status(422).json({error:'ふたりの鑑定から開いてください'});return}
  try {
    res.setHeader('Cache-Control','private, no-store')
    res.json(partnerReadingFromBirthSnapshot(data.birth_data))
  } catch {res.status(422).json({error:'相手の出生情報を確認できませんでした。相手のプロフィールをご確認ください'})}
}
