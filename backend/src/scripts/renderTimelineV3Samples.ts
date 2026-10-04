import { writeFileSync } from 'node:fs'
import { timelineV3Cards } from '../lib/report/timelineV3/compose.js'
import { TIMELINE_V3_SAMPLES, SAMPLE_EVENTS, COUPLE_SAMPLES } from '../lib/report/timelineV3/samples.js'
import { buildCoupleTimelineV3 } from '../lib/report/timelineV3/couple.js'
import { readLifeEvents } from '../lib/report/timelineV3/events.js'
for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
  const cards = timelineV3Cards(input, 2012, 2036, 2026)
  const out = [`# ${name}`, `入力：${JSON.stringify(input)}`, '表示の基準年：2026', '']
  for (const c of cards) {
    out.push(`■ ${c.id.slice(-4)}年　${c.title}`, `タグ：${c.tags.filter(t => t !== '時期').join(' ') || 'なし'}`)
    for (const s of c.sections!) out.push(`〈${s.heading}〉`, s.body)
    out.push(`（技術的な根拠）${c.evidence.map(e => e.detail).join(' ／ ')}`, '')
  }
  out.push('', '==== 年表入力の読み解き（架空の出来事） ====', '')
  for (const r of readLifeEvents(input, SAMPLE_EVENTS[name] ?? [], 2026)) {
    out.push(`■ ${r.title}`)
    for (const s of r.sections) out.push(`〈${s.heading}〉`, s.body)
    out.push('')
  }
  writeFileSync(new URL(`../../../docs/timeline-v3/samples/${name}.txt`, import.meta.url), out.join('\n'))
}
for (const [name, c] of Object.entries(COUPLE_SAMPLES)) {
  const r = buildCoupleTimelineV3({ ...c, referenceYear: 2026, endYear: 2036, style: 'detailed' })
  const out = [`# ふたり：${name}（${c.relationshipLabel}、出会った年 ${c.meetingYear}）`, `あなた：${JSON.stringify(c.self)}`, `相手：${JSON.stringify(c.partner)}`, '']
  for (const e of r.entries) {
    const card = e.card!
    out.push(`■ ${e.year}年${e.label ? '（' + e.label + '）' : ''}　${card.title}`, `タグ：${card.tags.filter(t => t !== 'ふたりの時系列').join(' ') || 'なし'}`)
    for (const s of card.sections!) out.push(`〈${s.heading}〉`, s.body)
    out.push('')
  }
  writeFileSync(new URL(`../../../docs/timeline-v3/samples/couple_${name}.txt`, import.meta.url), out.join('\n'))
}
