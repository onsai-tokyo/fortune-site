import { Router, type Response } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { getSupabaseUser } from '../lib/supabaseUser.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { snapshotInput } from '../lib/webReadingSnapshot.js'

export const webReadingSnapshotsRouter = Router()
webReadingSnapshotsRouter.get('/', async (req: AuthRequest, res) => {
  const {data,error} = await getSupabaseUser(req.accessToken!).from('web_reading_snapshots')
    .select('id,source_id,partner_id,payload,created_at').eq('user_id',req.userId!).order('created_at',{ascending:false})
  if (error) return void res.status(503).json({error:'保存した鑑定を取得できませんでした'})
  res.json({snapshots:data ?? []})
})
export async function saveWebSnapshot(req: AuthRequest, res: Response, client = getSupabaseUser, admin = getSupabaseAdmin) {
  if (!req.userId || !req.accessToken) return void res.status(401).json({error:'ログインしてください'})
  let input: ReturnType<typeof snapshotInput>
  try { input=snapshotInput(req.body) } catch { return void res.status(400).json({error:'保存内容が正しくありません'}) }
  const db=client(req.accessToken!)
  // RLS additionally enforces a non-anonymous JWT and ownership at insert time.
  const source=await admin().from('reading_conversations').select('id').eq('id',input.sourceId).eq('user_id',req.userId!).maybeSingle()
  if(source.error) return void res.status(503).json({error:'元の鑑定を確認できませんでした'})
  if(!source.data) return void res.status(404).json({error:'元の鑑定が見つかりません'})
  const {error}=await db.from('web_reading_snapshots').upsert({
    user_id:req.userId!,source_id:input.sourceId,partner_id:input.partnerId,content_hash:input.hash,payload:input.payload,
  },{onConflict:'user_id,content_hash',ignoreDuplicates:true})
  if(error) return void res.status(503).json({error:'鑑定を保存できませんでした'})
  const row=await db.from('web_reading_snapshots').select('id,source_id,partner_id,payload,created_at').eq('user_id',req.userId!).eq('content_hash',input.hash).single()
  if(row.error) return void res.status(503).json({error:'保存結果を確認できませんでした'})
  res.json({snapshot:row.data})
}
webReadingSnapshotsRouter.post('/', (req: AuthRequest,res)=>saveWebSnapshot(req,res))
webReadingSnapshotsRouter.delete('/:id', async (req: AuthRequest,res) => {
  if(!/^[a-f0-9-]{36}$/i.test(req.params.id)) return void res.status(400).json({error:'保存IDが正しくありません'})
  const {error}=await getSupabaseUser(req.accessToken!).from('web_reading_snapshots').delete().eq('id',req.params.id).eq('user_id',req.userId!)
  if(error)return void res.status(503).json({error:'保存を取り消せませんでした'})
  res.status(204).end()
})
