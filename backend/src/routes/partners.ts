import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { assertPartnerCapacity, MAX_PARTNER_PROFILES, validatePartnerProfile } from '../lib/partnerProfiles.js'

export const partnersRouter = Router()
partnersRouter.use(requireAuth)

partnersRouter.get('/', async (req: AuthRequest, res) => {
  const { data, error } = await getSupabaseAdmin().from('partner_profiles').select('*').eq('user_id', req.userId!).order('created_at')
  if (error) { res.status(500).json({ error: '相手一覧を取得できませんでした' }); return }
  res.json({ partners: data ?? [], limit: MAX_PARTNER_PROFILES, remaining: Math.max(0, MAX_PARTNER_PROFILES - (data?.length ?? 0)) })
})

partnersRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const db = getSupabaseAdmin()
    const { count, error: countError } = await db.from('partner_profiles').select('id', { count: 'exact', head: true }).eq('user_id', req.userId!)
    if (countError) throw countError
    assertPartnerCapacity(count ?? 0)
    const profile = validatePartnerProfile(req.body as Record<string, unknown>)
    const { data, error } = await db.from('partner_profiles').insert({ user_id: req.userId, ...profile }).select('*').single()
    if (error) {
      if (error.message.includes('partner_profile_limit')) { res.status(409).json({ error: `登録できる相手は${MAX_PARTNER_PROFILES}人までです` }); return }
      throw error
    }
    res.status(201).json({ partner: data, remaining: Math.max(0, MAX_PARTNER_PROFILES - (count ?? 0) - 1) })
  } catch (error) {
    const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500
    res.status(status).json({ error: error instanceof Error ? error.message : '相手を登録できませんでした' })
  }
})

partnersRouter.delete('/:id', async (req: AuthRequest, res) => {
  const { error } = await getSupabaseAdmin().from('partner_profiles').delete().eq('id', req.params.id).eq('user_id', req.userId!)
  if (error) { res.status(500).json({ error: '相手を削除できませんでした' }); return }
  res.status(204).end()
})
