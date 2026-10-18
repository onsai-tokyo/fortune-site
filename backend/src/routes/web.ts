import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseUser } from '../lib/supabaseUser.js'
import { readingRouter } from './reading.js'
import { coupleTimelineRouter } from './coupleTimeline.js'
import { partnersRouter } from './partners.js'
import { previewRouter } from './preview.js'
import { calcRouter } from './calc.js'
import { webBooksRouter } from './webBooks.js'

export const webRouter = Router()
webRouter.use(requireAuth)
webRouter.use('/books', webBooksRouter)
const savedKey = /^(?:you-[0-9]{4}|chapter-[A-Za-z0-9_-]{1,120}|couple-[0-9a-fA-F-]{36}-[0-9]{4})$/
webRouter.get('/reading/saves', async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseUser(req.accessToken!).from('reading_saves').select('save_key,created_at').eq('user_id', req.userId!).order('created_at')
  if (error) { res.status(503).json({ error: '保存した読みものを取得できませんでした' }); return }
  res.json({ saves: data ?? [] })
})
webRouter.put('/reading/saves/:saveKey', async (req: AuthRequest, res) => {
  const saveKey = req.params.saveKey
  if (!savedKey.test(saveKey) || typeof req.body?.isSaved !== 'boolean') { res.status(400).json({ error: '保存キーまたは保存状態が正しくありません' }); return }
  const db = getSupabaseUser(req.accessToken!)
  const { error } = req.body.isSaved
    ? await db.from('reading_saves').upsert({user_id:req.userId!,save_key:saveKey,updated_at:new Date().toISOString()}, {onConflict:'user_id,save_key'})
    : await db.from('reading_saves').delete().eq('user_id',req.userId!).eq('save_key',saveKey)
  if (error) { res.status(503).json({ error: '保存状態を更新できませんでした' }); return }
  res.json({saveKey,isSaved:req.body.isSaved})
})
// No global FREE_QUESTION_LIMIT mutation: the existing iOS routes keep their policy.
webRouter.post('/reading/conversations/:id/questions', (_req, res) => { res.status(403).json({code:'WEB_READING_QUESTIONS_DISABLED',error:'読みものへの無料質問はWeb版では提供していません。'}) })
webRouter.use('/reading', coupleTimelineRouter, readingRouter)
webRouter.use('/partners', partnersRouter)
webRouter.use('/preview', previewRouter)
webRouter.use('/calc', calcRouter)
