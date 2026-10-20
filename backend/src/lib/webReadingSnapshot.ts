import { createHash } from 'node:crypto'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function snapshotInput(raw: unknown) {
  const v = raw as Record<string, any> | null
  if (!v || !uuid.test(v.sourceId ?? '') || (v.partnerId != null && !uuid.test(v.partnerId))) throw new Error('INVALID_SNAPSHOT')
  const p = v.payload
  const text = (s: unknown, max: number) => typeof s === 'string' && !!s.trim() && s.length <= max
  if (!p || !['you','couple'].includes(p.kind) || !text(p.title, 500) || !text(p.label, 200)
    || !text(p.key, 200) || !Array.isArray(p.sections) || !p.sections.length || p.sections.length > 100
    || p.sections.some((s: any) => !s || typeof s.heading !== 'string' || s.heading.length > 500 || !text(s.body, 50000))
    || (p.kind === 'couple') !== !!v.partnerId) throw new Error('INVALID_SNAPSHOT')
  // Whitelist display data. Snapshots are user-saved display copies, never AI input,
  // entitlement evidence, executable HTML, or a replacement for the source report.
  const payload = { key: p.key as string, kind: p.kind as 'you'|'couple', title: p.title as string,
    label: p.label as string, sections: p.sections.map((s: any) => ({ heading: s.heading as string, body: s.body as string })) }
  if (Buffer.byteLength(JSON.stringify(payload)) > 100000) throw new Error('INVALID_SNAPSHOT')
  const sourceId = v.sourceId as string, partnerId = (v.partnerId ?? null) as string|null
  const hash = createHash('sha256').update(JSON.stringify({ sourceId, partnerId, payload })).digest('hex')
  return { sourceId, partnerId, payload, hash }
}
