import { Router } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { coupleSnapshot, snapshotTimeline, validateMeetingYear } from '../lib/report/coupleAllYears/snapshot.js'
import { profileMeetingKey } from './coupleTimeline.js'
import { loadTimelineContext } from '../lib/timelineContext.js'
import { readingSnapshot, saveReadingSnapshot } from '../lib/readingRevision.js'
import { createHash } from 'node:crypto'
import type { StructuredReport } from '../lib/reportCards.js'

export const webReadingsRouter = Router()
const uuid = /^[0-9a-f-]{36}$/i
function databaseFailureCode(error: { code?: string } | null) {
  switch (error?.code) {
    case '42501': return 'DB_PERMISSION_DENIED'
    case '42703': return 'DB_COLUMN_MISSING'
    case '42P01': return 'DB_RELATION_MISSING'
    case 'PGRST116': return 'DB_ROW_CARDINALITY'
    case 'PGRST200': case 'PGRST202': case 'PGRST204': return 'DB_SCHEMA_CACHE'
    default: return 'DB_READ_UNAVAILABLE'
  }
}
function timelineFailureCode(error: unknown) {
  if (error instanceof TypeError) return 'TYPE_ERROR'
  if (error instanceof RangeError) return 'RANGE_ERROR'
  if (error instanceof Error && ['BIRTH_UNAVAILABLE', 'INVALID_MEETING_YEAR'].includes(error.message)) return error.message
  return 'UNEXPECTED_FAILURE'
}
// Same snapshot/engine/settings as iOS, but no compatibility-operation points
// reservation. A selected year becomes a real owned source only on explicit POST.
export async function webCoupleTimeline(req: AuthRequest, res: import('express').Response, deps = { admin: getSupabaseAdmin, timeline: snapshotTimeline, save: saveReadingSnapshot, context: loadTimelineContext }) {
  res.setHeader('Cache-Control', 'private, no-store')
  // The router authenticates first; also fail closed when this handler is invoked directly.
  if (!req.userId || !req.accessToken) { res.status(401).json({ error: 'ログイン状態を確認してください。' }); return }
  if (!uuid.test(String(req.params.selfId)) || !uuid.test(String(req.params.partnerId))) {
    console.warn('WEB_COUPLE_TIMELINE_FAILED', { method: req.method === 'GET' ? 'GET' : 'POST', stage: 'request_validation', status: 400, code: 'INVALID_IDS' })
    res.status(400).json({ error: '本人の読みものと相手を選択してください。' }); return
  }
  let stage = 'source_lookup'
  let databaseCode: string | undefined
  try {
    // Partner table access is server-only. Never widen authenticated table grants:
    // both privileged source reads must include the verified owner AND selected id.
    const db = deps.admin()
    const [self, partner] = await Promise.all([
      db.from('reading_conversations').select('id,kind,birth_data,reading_revision_id').eq('id', req.params.selfId).eq('user_id', req.userId!).maybeSingle(),
      db.from('partner_profiles').select('id,display_name,birth_date,birth_time,birthplace,gender,relationship_label,relationship_type').eq('id', req.params.partnerId).eq('user_id', req.userId!).maybeSingle(),
    ])
    if (self.error || partner.error) {
      databaseCode = databaseFailureCode(self.error ?? partner.error)
      throw new Error('READ_UNAVAILABLE')
    }
    if (!self.data || !['self', 'personal'].includes(self.data.kind) || !partner.data) {
      console.warn('WEB_COUPLE_TIMELINE_FAILED', { method: req.method === 'GET' ? 'GET' : 'POST', stage, status: 404, code: 'SOURCE_NOT_FOUND' })
      res.status(404).json({ error: '本人の読みものまたは相手が見つかりません。' }); return
    }
    const birthData = { self: self.data.birth_data, partner: partner.data, relationshipLabel: partner.data.relationship_label, relationshipType: partner.data.relationship_type }
    stage = 'birth_snapshot'
    const snapshot = coupleSnapshot(birthData, partner.data.id)
    stage = 'meeting_settings'
    const settings = await deps.admin().from('couple_timeline_settings').select('meeting_year').eq('user_id', req.userId!).eq('relationship_key', profileMeetingKey(partner.data.id)).maybeSingle()
    if (settings.error) {
      databaseCode = databaseFailureCode(settings.error)
      throw new Error('READ_UNAVAILABLE')
    }
    stage = 'meeting_validation'
    const meetingYear = validateMeetingYear(settings.data?.meeting_year ?? null, snapshot.minMeetingYear)
    stage = 'timeline_context'
    const context = process.env.COUPLE_TIMELINE_ENGINE?.trim() === 'v3' ? await deps.context(req.accessToken!, req.userId!, snapshot.a) : { lifeEvents: [] }
    stage = 'timeline_build'
    const timeline = deps.timeline(snapshot, meetingYear, context.lifeEvents)
    if (req.method === 'GET') { res.json(timeline); return }
    stage = 'source_selection'
    const year = req.body?.year
    const selected = timeline.entries.find(e => e.year === year && e.contentStatus === 'ready' && e.card)
    if (!selected?.card) {
      console.warn('WEB_COUPLE_TIMELINE_FAILED', { method: req.method === 'GET' ? 'GET' : 'POST', stage, status: 422, code: 'YEAR_NOT_READY' })
      res.status(422).json({ error: '相談する年の読みものを確認できませんでした。' }); return
    }
    // Keep the selected year first and up to two adjacent real years as grounding.
    const cards = [selected, ...timeline.entries.filter(e => e !== selected && e.contentStatus === 'ready' && e.card).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))].slice(0, 3).map(e => e.card!)
    stage = 'source_payload'
    const report: StructuredReport = { version: 3, generator: 'deterministic', generatorVersion: `web-couple|${JSON.stringify(timeline.engineVersion)}`, cards, reportText: cards.flatMap(c => [c.title, c.summary, ...(c.sections?.map(s => s.body) ?? c.pages.map(p => p.text))]).join('\n\n') }
    const payload = readingSnapshot({ birthData, calculatedData: {}, structuredReport: report, reportText: report.reportText, sourceYear: year, sourceSection: 'ふたりの年表' }, 'compatibility', partner.data.id)
    const operation = 'web-couple:' + createHash('sha256').update(JSON.stringify({ owner: req.userId!, source: self.data.id, revision: self.data.reading_revision_id, payload })).digest('hex')
    stage = 'source_save'
    const saved = await deps.save(req.accessToken!, payload, `${partner.data.display_name}との${year}年`, operation)
    res.json({ sourceId: saved.id, sourceCardId: selected.card.id })
  } catch (error) {
    // Deliberately exclude raw errors, DB messages/details, IDs, tokens and birth/report data.
    console.warn('WEB_COUPLE_TIMELINE_FAILED', { method: req.method === 'GET' ? 'GET' : 'POST', stage, status: 503, code: databaseCode ?? timelineFailureCode(error) })
    res.status(503).json({ error: 'ふたりの年表を読み込めませんでした。再読み込みしてください。' })
  }
}
webReadingsRouter.route('/:selfId/partners/:partnerId/couple-timeline').get((req, res) => webCoupleTimeline(req, res)).post((req, res) => webCoupleTimeline(req, res))
