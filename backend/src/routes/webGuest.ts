import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { generatePreview } from './preview.js'
import { coupleSnapshot, snapshotTimeline, validateMeetingYear } from '../lib/report/coupleAllYears/snapshot.js'
import { partnerReadingFromBirthSnapshot } from '../lib/report/partnerReading.js'

export const webGuestRouter = Router()
webGuestRouter.use(rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '短時間に鑑定が続いています。少し待ってからお試しください。' },
}))

function guestBirth(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const { birthDate, birthTime, birthplace, gender } = value as Record<string, unknown>
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const date = new Date(birthDate)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birthDate || birthDate < '1900-01-01' || date.getTime() > Date.now() + 9 * 3_600_000) return null
  if (birthTime != null && (typeof birthTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(birthTime))) return null
  if (typeof birthplace !== 'string' || birthplace.length > 30 || (gender !== 'female' && gender !== 'male')) return null
  return { birthDate, birthTime, birthplace, gender, birthTimeZone: 'Asia/Tokyo' }
}

webGuestRouter.post('/self', (req, res) => {
  const birth = guestBirth(req.body)
  if (!birth) { res.status(400).json({ error: '出生情報を確認してください。' }); return }
  req.body = birth
  return generatePreview(req, res, true)
})

webGuestRouter.post('/couple', (req, res) => {
  const self = guestBirth(req.body?.self)
  const partner = guestBirth(req.body?.partner)
  if (!self || !partner) { res.status(400).json({ error: 'ふたりの出生情報を確認してください。' }); return }
  const relationshipLabel = typeof req.body.relationshipLabel === 'string' ? req.body.relationshipLabel.slice(0, 30) : undefined
  const relationshipType = typeof req.body.relationshipType === 'string' ? req.body.relationshipType.slice(0, 30) : undefined
  res.setHeader('Cache-Control', 'private, no-store')
  try {
    const snapshot = coupleSnapshot({ self, partner, relationshipLabel, relationshipType }, null)
    const meetingYear = validateMeetingYear(req.body.meetingYear ?? null, snapshot.minMeetingYear)
    const timeline = snapshotTimeline(snapshot, meetingYear)
    const about = partnerReadingFromBirthSnapshot({ partner }).cards
    res.json({ timeline, cards: about.filter(card => !['timing', 'chart'].includes(card.kind) && card.tab !== 'timing' && card.tab !== 'chart' && (!card.scope || card.scope === 'self')) })
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_MEETING_YEAR') {
      res.status(400).json({ error: '出会った年を確認してください。' })
      return
    }
    res.status(503).json({ error: 'ふたりの年表を読み込めませんでした。もう一度お試しください。' })
  }
})
