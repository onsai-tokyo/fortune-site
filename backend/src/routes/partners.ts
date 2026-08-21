import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { assertPartnerCapacity, MAX_PARTNER_PROFILES, validatePartnerProfile } from '../lib/partnerProfiles.js'
import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { calcShichu, calcNayin, calcSanmei, getSukuyo, calcLifePathNumber } from './calc.js'
import type { ReportCard, StructuredReport } from '../lib/reportCards.js'
import { correlationId, sendApiError } from '../lib/apiError.js'

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

function parseCompatibility(raw: string): StructuredReport {
  const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { cards?: ReportCard[] }
  if (!Array.isArray(value.cards) || value.cards.length < 3) throw new Error('相性カードが不足しています')
  for (const card of value.cards) {
    if (!card.title || /^恋愛|友人|相性$/.test(card.title) || !Array.isArray(card.pages) || card.pages.length < 8 || card.pages.length > 12) throw new Error('相性カード形式が不正です')
    if (card.pages.some(page => !page.text || [...page.text].length > 120)) throw new Error('相性カード本文が不正です')
  }
  return { version: 2, cards: value.cards, reportText: value.cards.flatMap(card => [`【${card.title}】`, ...card.pages.map(page => page.text)]).join('\n\n') }
}

partnersRouter.post('/:id/compatibility', async (req: AuthRequest, res) => {
  try {
    const db = getSupabaseAdmin()
    const conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : ''
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversationId)) {
      sendApiError(res, 409, 'SELF_READING_REQUIRED', 'まず「あなたについて」の鑑定を作成してください。', false, correlationId(req)); return
    }
    const [{ data: partner }, { data: self }] = await Promise.all([
      db.from('partner_profiles').select('*').eq('id', req.params.id).eq('user_id', req.userId!).maybeSingle(),
      db.from('reading_conversations').select('id,birth_data,calculated_data').eq('id', conversationId).eq('user_id', req.userId!).maybeSingle(),
    ])
    if (!partner) { res.status(404).json({ error: '相手が見つかりません' }); return }
    if (!self?.birth_data || !self?.calculated_data) {
      sendApiError(res, 409, 'SELF_READING_REQUIRED', 'まず「あなたについて」の鑑定を作成してください。', false, correlationId(req)); return
    }
    const relationshipType = req.body?.relationshipType === 'friend' ? 'friend' : 'romantic'
    const [year, month, day] = String(partner.birth_date).split('-').map(Number)
    const [hour, minute] = partner.birth_time ? String(partner.birth_time).split(':').map(Number) : [undefined, 0]
    const shichu = calcShichu(year, month, day, hour, minute)
    const partnerFacts = {
      name: partner.display_name, birthDate: partner.birth_date, gender: partner.gender,
      day: shichu.day.kanshi, nayin: calcNayin(shichu.day.stemIdx, shichu.day.branchIdx),
      sanmei: calcSanmei(shichu.day.stemIdx, shichu.day.branchIdx, shichu.month.branchIdx, shichu.jieDays),
      sukuyo: getSukuyo(year, month, day), lifePathNumber: calcLifePathNumber(String(partner.birth_date)),
    }
    const selfHash = createHash('sha256').update(JSON.stringify(self.calculated_data)).digest('hex')
    const cacheKey = createHash('sha256').update(`compat-v2|${self.id}|${selfHash}|${partner.id}|${partner.updated_at ?? partner.created_at ?? ''}|${relationshipType}`).digest('hex')
    const { data: cached } = await db.from('ai_report_cache').select('payload').eq('cache_key', cacheKey).maybeSingle()
    if (cached?.payload) { res.json(cached.payload); return }
    const prompt = `本人と相手の命式事実を照合し、${relationshipType === 'friend' ? '友人' : '恋愛'}関係のカードをJSONだけで返してください。
本人: ${JSON.stringify({ birth: self.birth_data, calculated: self.calculated_data })}
相手: ${JSON.stringify(partnerFacts)}
形式: {"cards":[{"id":"compat-core","kind":"essence","title":"裸のカテゴリ名ではない断定文","summary":"120字以内","tags":["相性"],"period":null,"evidence":[{"family":"干支系","system":"四柱推命","detail":"二人の日柱"}],"metadataRefs":["self.day","partner.day"],"pages":[{"role":"opening","label":"二人の核","text":"120字以内"}]}]}
カードは「引き合う力」「衝突するとき」「関係を育てる方法」の最低3枚。各8〜12ページ。opening/core/scene/shadow/exception/question/action/closingを含める。一文60字以内。断定調。弱点も書く。`
    const message = await new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }).messages.create({ model: 'claude-sonnet-4-6', max_tokens: 7000, temperature: 0, messages: [{ role: 'user', content: prompt }] })
    const block = message.content.find(item => item.type === 'text')
    if (!block || block.type !== 'text') throw new Error('AI応答がありません')
    const report = parseCompatibility(block.text)
    const { error: cacheError } = await db.from('ai_report_cache').upsert({ cache_key: cacheKey, generator_version: 'compat-v2', payload: report })
    if (cacheError) throw cacheError
    res.json(report)
  } catch (error) {
    console.error('Partner compatibility failed', error)
    res.status(500).json({ error: '相性鑑定を作成できませんでした' })
  }
})
