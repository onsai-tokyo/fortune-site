import { Router } from 'express'
import type { AuthRequest } from '../middleware/auth.js'
import { getSupabaseUser } from '../lib/supabaseUser.js'
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js'
import { coupleSnapshot, snapshotTimeline, validateMeetingYear } from '../lib/report/coupleAllYears/snapshot.js'
import { profileMeetingKey } from './coupleTimeline.js'
import { loadTimelineContext } from '../lib/timelineContext.js'
import { readingSnapshot, saveReadingSnapshot } from '../lib/readingRevision.js'
import { createHash } from 'node:crypto'
import type { StructuredReport } from '../lib/reportCards.js'

export const webReadingsRouter = Router()
const uuid = /^[0-9a-f-]{36}$/i
// Same snapshot/engine/settings as iOS, but no compatibility-operation points
// reservation. A selected year becomes a real owned source only on explicit POST.
export async function webCoupleTimeline(req: AuthRequest, res: import('express').Response, deps = { user: getSupabaseUser, admin: getSupabaseAdmin, timeline: snapshotTimeline, save: saveReadingSnapshot, context: loadTimelineContext }) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (!uuid.test(String(req.params.selfId)) || !uuid.test(String(req.params.partnerId))) { res.status(400).json({ error: '本人の読みものと相手を選択してください。' }); return }
  try {
    const db = deps.user(req.accessToken!)
    const [self, partner] = await Promise.all([
      db.from('reading_conversations').select('id,kind,birth_data,reading_revision_id').eq('id', req.params.selfId).eq('user_id', req.userId!).maybeSingle(),
      db.from('partner_profiles').select('id,display_name,birth_date,birth_time,birthplace,gender,relationship_label,relationship_type').eq('id', req.params.partnerId).eq('user_id', req.userId!).maybeSingle(),
    ])
    if (self.error || partner.error) throw new Error('READ_UNAVAILABLE')
    if (!self.data || !['self', 'personal'].includes(self.data.kind) || !partner.data) { res.status(404).json({ error: '本人の読みものまたは相手が見つかりません。' }); return }
    const birthData = { self: self.data.birth_data, partner: partner.data, relationshipLabel: partner.data.relationship_label, relationshipType: partner.data.relationship_type }
    const snapshot = coupleSnapshot(birthData, partner.data.id)
    const settings = await deps.admin().from('couple_timeline_settings').select('meeting_year').eq('user_id', req.userId!).eq('relationship_key', profileMeetingKey(partner.data.id)).maybeSingle()
    if (settings.error) throw new Error('READ_UNAVAILABLE')
    const meetingYear = validateMeetingYear(settings.data?.meeting_year ?? null, snapshot.minMeetingYear)
    const context = process.env.COUPLE_TIMELINE_ENGINE?.trim() === 'v3' ? await deps.context(req.accessToken!, req.userId!, snapshot.a) : { lifeEvents: [] }
    const timeline = deps.timeline(snapshot, meetingYear, context.lifeEvents)
    if (req.method === 'GET') { res.json(timeline); return }
    const year = req.body?.year
    const selected = timeline.entries.find(e => e.year === year && e.contentStatus === 'ready' && e.card)
    if (!selected?.card) { res.status(422).json({ error: '相談する年の読みものを確認できませんでした。' }); return }
    // Keep the selected year first and up to two adjacent real years as grounding.
    const cards = [selected, ...timeline.entries.filter(e => e !== selected && e.contentStatus === 'ready' && e.card).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))].slice(0, 3).map(e => e.card!)
    const report: StructuredReport = { version: 3, generator: 'deterministic', generatorVersion: `web-couple|${JSON.stringify(timeline.engineVersion)}`, cards, reportText: cards.flatMap(c => [c.title, c.summary, ...(c.sections?.map(s => s.body) ?? c.pages.map(p => p.text))]).join('\n\n') }
    const payload = readingSnapshot({ birthData, calculatedData: {}, structuredReport: report, reportText: report.reportText, sourceYear: year, sourceSection: 'ふたりの年表' }, 'compatibility', partner.data.id)
    const operation = 'web-couple:' + createHash('sha256').update(JSON.stringify({ owner: req.userId!, source: self.data.id, revision: self.data.reading_revision_id, payload })).digest('hex')
    const saved = await deps.save(req.accessToken!, payload, `${partner.data.display_name}との${year}年`, operation)
    res.json({ sourceId: saved.id, sourceCardId: selected.card.id })
  } catch { res.status(503).json({ error: 'ふたりの年表を読み込めませんでした。再読み込みしてください。' }) }
}
webReadingsRouter.route('/:selfId/partners/:partnerId/couple-timeline').get((req, res) => webCoupleTimeline(req, res)).post((req, res) => webCoupleTimeline(req, res))
