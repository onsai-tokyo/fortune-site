import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { containsJargon, findJargon } from '../jargon.js'
import { personalParts } from './personal.js'
import { composeYear, parts, timelineV3Cards, selfVoice, pastizeAll } from './compose.js'
import { timelineContext, yearSignals, decideYear } from './signals.js'
import { TIMELINE_V3_SAMPLES, SAMPLE_RANGE } from './samples.js'
import { depthParts } from './depth.js'
import { areaParts, neutralActivityText } from './areas.js'

const strings = (x: unknown): string[] => typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === 'object' ? Object.values(x).flatMap(strings) : []
const summarize = (c: any) => ({ id: c.id, title: c.title, tags: c.tags, sections: c.sections.map((s: any) => ({ heading: s.heading, body: s.body })), evidence: c.evidence.map((e: any) => e.detail), decision: c.timelineV3Calculation.decision })

test('manuscript parts contain no jargon (body-safe vocabulary only)', () => {
  const bad = [...strings(parts()), ...strings({ ...depthParts(), evidence: {}, pair: { ...depthParts().pair, evidence: '' } }), ...strings({ ...areaParts(), evidence: {} }), ...strings({ ...personalParts(), evidence: '' })].filter(containsJargon)
  assert.deepEqual(bad.map(s => `${findJargon(s).join(',')}: ${s}`), [])
})

test('personal parts: every day stem × year group has 3 distinct lines, every structure × year group 2; all end in です/ます', () => {
  const P = personalParts()
  const G = ['self', 'expr', 'wealth', 'duty', 'learn']
  for (const st of '甲乙丙丁戊己庚辛壬癸') for (const g of G) { assert.equal(new Set(P.stem[st][g]).size, 3, `${st}.${g}`) }
  for (const m of G) for (const g of G) assert.equal(new Set(P.structure[m][g]).size, 2, `${m}.${g}`)
  for (const x of strings({ stem: P.stem, structure: P.structure })) assert.ok(/(です|ます)。$/.test(x), x)
  // the couple view turns 「あなた」 into 「相手」 for the partner: exactly one 「あなた」 per line, and no other 「相手」
  for (const x of strings(P.stem)) { assert.equal(x.split('あなた').length - 1, 1, x); assert.ok(!x.includes('相手'), x) }
  for (const x of strings(P.structure)) assert.ok(!x.includes('相手'), x)
})

test('parts are complete: 3 variants per ten-god sentence, 6 possibilities per situation, 3 per milestone', () => {
  const P = parts()
  for (const [god, g] of Object.entries<any>(P.tenGods)) {
    for (const k of ['light', 'shadow', 'undertone', 'advice', 'reflection', 'leads', 'quietHeadlines']) {
      assert.equal(g[k].length, 3, `${god}.${k}`)
      assert.equal(new Set(g[k]).size, 3, `${god}.${k} duplicates`)
    }
    for (const k of ['light', 'shadow', 'undertone', 'advice']) for (const x of g[k]) assert.ok(x.endsWith('。'), `${god}.${k}: ${x}`)
    for (const x of g.light) assert.ok(x.endsWith('年です。'), `${god}.light must end with 年です。 (past-tense rule): ${x}`)
  }
  for (const list of [P.tails.relationship.active, P.tails.relationship.major, P.tails.trust.major, P.tails.youth.active, P.tails.youth.major, P.tails.career.work, P.tails.career.study, P.tails.career.other, P.tails.move, P.tails.hint]) assert.equal(list.length, 3)
  for (const theme of ['relationship', 'trust']) for (const st of ['partnered', 'single', 'married', 'unknown']) {
    assert.equal(P.manifestations[theme][st].length, 6, `${theme}.${st}`)
    assert.equal(new Set(P.manifestations[theme][st]).size, 6, `${theme}.${st} duplicates`)
  }
  for (const band of ['teen', 'child']) assert.equal(P.manifestations.youth[band].length, 6)
  for (const x of [P.leads.relationship.active, P.leads.relationship.major, P.leads.trust.major, P.leads.youth.active, P.leads.youth.major, P.leads.career.work, P.leads.career.study, P.leads.career.other, P.leads.move, P.leads.hint]) { assert.equal(x.length, 3); for (const y of x) assert.ok(y.endsWith('時期です。'), y) }
  assert.equal(P.trustAdvice.length, 3); assert.equal(P.milestones.marriage.length, 3); assert.equal(P.milestones.move.length, 3)
  for (const k of ['employed', 'independent', 'student', 'other']) assert.equal(P.milestones.career[k].length, 3)
})

test('no repeated body text for the same ten-god within 30 years; adjacent relationship years differ', () => {
  const TEN_GOD_SENTENCES = new Set<string>(Object.values<any>(parts().tenGods).flatMap(g => [...g.light, ...g.shadow, ...g.undertone, ...g.advice, ...g.reflection]))
  for (const input of Object.values(TIMELINE_V3_SAMPLES)) {
    const cards = timelineV3Cards(input, 2010, 2045, 2026)
    const seen = new Map<string, number>()
    let prevManifest = ''
    for (const c of cards) {
      const y = Number(c.id.slice(-4))
      for (const s of c.sections!.slice(0, 3)) {
        for (const sentence of s.body.split(/(?<=。)/).map(x => x.replace(/^一方で、/, '')).filter(x => TEN_GOD_SENTENCES.has(x.replace(/でした。$/, 'です。').replace(/ました。$/, 'ます。')))) {
          const prev = seen.get(sentence)
          if (prev !== undefined) assert.ok(y - prev >= 30, `${c.id}: "${sentence}" repeats ${prev}`)
          seen.set(sentence, y)
        }
      }
      const manifest = c.sections![1].body
      const rel = c.tags.some(t => t === '#関係が動く時期' || t === '#信頼を見直す時期')
      if (rel) { assert.notEqual(manifest, prevManifest, `${c.id} repeats previous relationship-year text`); prevManifest = manifest }
      const lead = c.sections![0].body.split(/(?<=。)/)[0]
      if (lead.startsWith('この年は、')) { assert.notEqual(lead, (globalThis as any).__prevLead, `${c.id} repeats previous year's lead`) }
      ;(globalThis as any).__prevLead = lead
    }
  }
})

const display0 = (c: any) => c.sections.map((s: any) => s.body).join('')
for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
  test(`${name}: card shape, lengths, jargon, determinism, golden fixture`, () => {
    const cards = timelineV3Cards(input, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear)
    assert.ok(cards.length > 0)
    const titles = new Map<string, number>()
    for (const c of cards) {
      const sections = c.sections!
      assert.ok(sections.length >= 4 && sections.length <= 14, `${c.id} sections`)
      // depth paragraphs: adults always get the months-inside-the-year and continuity sections
      const heads = sections.map(s => s.heading)
      const adultY = Number(c.id.slice(-4)) - Number(input.birthDate!.slice(0, 4)) >= 18
      for (const h of ['この年の時期', 'この年が響く場所', '前後の年とのつながり']) assert.equal(heads.includes(h), adultY, `${c.id} ${h}`)
      const timing = sections.find(s => s.heading === 'この年の時期')?.body ?? ''
      for (const m of timing.matchAll(/(\d+)月/g)) assert.ok(Number(m[1]) >= 1 && Number(m[1]) <= 12, `${c.id} month ${m[0]}`)
      if (!input.birthTime) assert.ok(!adultY || /出生時刻を登録すると/.test(timing), `${c.id} no-time note`)
      else assert.ok(!/出生時刻を登録すると/.test(timing), `${c.id} note shown with a birth time`)
      assert.ok(!/できました。/.test(timing), `${c.id} note pastized`)
      // adults get the three area paragraphs, always in this order, never empty; minors never do
      const areaHeads = sections.map(s => s.heading).filter(h => ['恋愛・人との関わり', '仕事・活動', '暮らし・自分の時間'].includes(h))
      const adult = Number(c.id.slice(-4)) - Number(input.birthDate!.slice(0, 4)) >= 18
      if (!adult) assert.equal(areaHeads.length, 0, `${c.id} minor has area paragraphs`)
      else assert.deepEqual(areaHeads.filter(h => h !== '恋愛・人との関わり'), ['仕事・活動', '暮らし・自分の時間'], `${c.id} areas`)
      // past years never keep advice wording; no card says 「今年」 for another year
      const past = Number(c.id.slice(-4)) < SAMPLE_RANGE.nowYear
      for (const s of sections.filter(s => areaHeads.includes(s.heading))) {
        assert.ok(!/今年/.test(s.body), `${c.id} ${s.heading}: 今年`)
        if (past) assert.ok(!/(てください|大切に。|方向になります)/.test(s.body), `${c.id} ${s.heading}: advice in a past year: ${s.body}`)
      }
      if (input.relationshipStatus === 'single') assert.ok(!/相手がいる場合/.test(display0(c)), `${c.id} single wording`)
      if (!['partnered', 'married'].includes(input.relationshipStatus ?? '')) assert.ok(!/二人と周囲/.test(display0(c)), `${c.id} 二人 without a partner`)
      assert.ok(!/(大きな変化として表れる可能性があります|今の(職場|活動の場)で担当や条件を見直す形で取り組む)/.test(display0(c)), `${c.id} old boilerplate`)
      assert.ok([...c.title].length <= 40, `${c.id} title length ${c.title}`)
      for (const s of sections) assert.ok([...s.body].length <= 600, `${c.id} ${s.heading} length ${[...s.body].length}`)
      const display = [c.title, c.summary, ...sections.flatMap(s => [s.heading, s.body])].join('\n')
      assert.equal(containsJargon(display), false, `${c.id}: ${findJargon(display)}`)
      assert.ok(!/^あなたは/.test(sections[0].body))
      const prev = titles.get(c.title)
      if (prev !== undefined) assert.ok(c.id.slice(-4) as unknown as number - prev >= 30, `${c.id} duplicates title of ${prev}`)
      titles.set(c.title, Number(c.id.slice(-4)))
      // range independence (contract parity): single-year composition equals in-range composition
      const alone = timelineV3Cards(input, Number(c.id.slice(-4)), Number(c.id.slice(-4)), SAMPLE_RANGE.nowYear)[0]
      assert.deepEqual(alone, c)
    }
    // depth and area paragraphs never repeat a sentence within 10 years (factual pointers excluded)
    const seen = new Map<string, number>()
    // (area closings by status / work context rotate through 6 lines and are allowed to come back sooner)
    const closings = new Set(strings([areaParts().closing, areaParts().workClosing]).flatMap(t => [t, neutralActivityText(t), selfVoice(t), selfVoice(neutralActivityText(t))]))
    for (const c of cards) for (const sct of c.sections!.filter(x => ['10年の流れの中で', '前後の年とのつながり', '恋愛・人との関わり', '仕事・活動', '暮らし・自分の時間'].includes(x.heading))) {
      for (const x of sct.body.split(/(?<=。)/).filter(x => x && !/動きやすいのは|動きやすくなったのは/.test(x) && !closings.has(x))) {
        const y = Number(c.id.slice(-4)), p = seen.get(x)
        assert.ok(p === undefined || y - p >= 10, `${name}: "${x}" in ${p} and ${y}`)
        seen.set(x, y)
      }
    }
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(cards.map(summarize), golden.cards)
  })
}

test('birth time unknown: no Vedic signals, no chapters, no dasha periods', () => {
  const ctx = timelineContext(TIMELINE_V3_SAMPLES.nagoya_1995_female_no_time)!
  assert.equal(ctx.vedic, null)
  for (let y = 2010; y <= 2045; y++) {
    const s = yearSignals(ctx, y)
    assert.ok(!s.relationship.hits.some(h => h.id === 'TL3-R1'))
    assert.ok(!s.career.hits.some(h => h.id === 'TL3-C3'))
    assert.ok(!s.move.hits.some(h => h.id === 'TL3-M3'))
    assert.equal(s.chapterStarts.length, 0)
  }
})

test('validated reference points (fixed judgements for the first three samples) are reproduced', () => {
  const p1 = timelineContext(TIMELINE_V3_SAMPLES.nagoya_1995_female)!
  const r1 = (ctx: any, y: number) => yearSignals(ctx, y).relationship.hits.some(h => h.id === 'TL3-R1')
  assert.deepEqual([2015, 2016, 2017, 2018, 2019].map(y => r1(p1, y)), [false, true, true, true, false])
  assert.equal(decideYear(p1, 2023).theme, 'trust')
  const p2 = timelineContext(TIMELINE_V3_SAMPLES.aichi_1995_female_married)!
  assert.deepEqual([2017, 2018, 2019, 2023, 2024, 2025].map(y => r1(p2, y)), [true, true, false, false, true, true])
  const p3 = timelineContext(TIMELINE_V3_SAMPLES.saga_1997_female_partnered)!
  assert.deepEqual([2019, 2020, 2021, 2022].map(y => r1(p3, y)), [false, true, true, false])
})

test('caps: at most 3 career and 2 move candidates per window', () => {
  for (const input of Object.values(TIMELINE_V3_SAMPLES)) {
    const ctx = timelineContext(input)!
    const byWin = new Map<string, { career: number; move: number }>()
    for (let y = 2010; y <= 2045; y++) {
      const d = decideYear(ctx, y)
      const key = `${Math.floor((y - ctx.birthYear) / 10)}|${ctx.natal.decades.find(x => x.start <= Date.UTC(y, 6, 1, -9) && Date.UTC(y, 6, 1, -9) < x.end)?.pillar ?? ''}`
      const v = byWin.get(key) ?? { career: 0, move: 0 }
      v.career += d.career ? 1 : 0; v.move += d.move ? 1 : 0; byWin.set(key, v)
    }
    for (const v of byWin.values()) { assert.ok(v.career <= 3); assert.ok(v.move <= 2) }
  }
})

test('minors never get marriage or romance-worded tags', () => {
  const ctx = timelineContext(TIMELINE_V3_SAMPLES.osaka_2005_female_student)!
  for (let y = 2010; y <= 2022; y++) {
    const { card, decision } = composeYear(ctx, y, 2026)
    if (decision.ageBand === 'adult') continue
    assert.equal(decision.marriage, false)
    assert.ok(!card.tags.includes('#結びつきの時期') && !card.tags.includes('#関係が動く時期') && !card.tags.includes('#信頼を見直す時期'))
  }
})

test('integration helpers: replace, refresh, contract parity', async () => {
  const { replaceTimelineV3, refreshSavedTimelineV3Cards, timelineV3CardIsValid, timelineV3Range } = await import('./index.js')
  const input = TIMELINE_V3_SAMPLES.nagoya_1995_female
  const report = replaceTimelineV3({ version: 3, reportText: '', cards: [] } as any, input, 2026)
  const r = timelineV3Range(input, 2026)
  assert.equal(report.cards.length, r.to - r.from + 1)
  assert.ok(report.cards.every(timelineV3CardIsValid))
  const refreshed = refreshSavedTimelineV3Cards(report.cards, input as any, 2026)
  assert.deepEqual(refreshed, report.cards)
  const tampered = { ...report.cards[0], title: 'x' }
  assert.equal(timelineV3CardIsValid(tampered as any), false)
})

test('life events: every ten-god has a reading for every direction; texts are jargon-free', async () => {
  const { eventParts } = await import('./events.js')
  const E = eventParts()
  for (const [god, r] of Object.entries<any>(E.readings)) for (const dir of ['begin', 'close', 'marriage', 'career', 'move']) assert.ok(typeof r[dir] === 'string' && r[dir].endsWith('。'), `${god}.${dir}`)
  const bad = strings(E).filter(containsJargon)
  assert.deepEqual(bad, [])
})

test('life events: readings match fixtures, shapes and wording rules', async () => {
  const { readLifeEvents } = await import('./events.js')
  const { SAMPLE_EVENTS } = await import('./samples.js')
  for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
    const readings = readLifeEvents(input, SAMPLE_EVENTS[name] ?? [], SAMPLE_RANGE.nowYear)
    for (const r of readings) {
      assert.ok(r.sections.length === 3 || r.sections.length === 4)
      const display = [r.title, ...r.sections.flatMap(s => [s.heading, s.body])].join('\n')
      assert.equal(containsJargon(display), false, `${name} ${r.id}: ${findJargon(display)}`)
      for (const s of r.sections) assert.ok([...s.body].length <= 600)
      assert.ok(!/当たりました|的中|当たっています/.test(display), `${r.id} claims a hit`)
      if (r.month === 1) assert.equal(r.meta.baziYear, r.year - 1)
    }
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/events_${name}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(JSON.parse(JSON.stringify(readings)), golden.readings)
  }
})

test('life events: input validation and anonymised validation record', async () => {
  const { parseLifeEvent, toValidationRecord } = await import('./events.js')
  assert.equal(parseLifeEvent({ year: 1990, kind: 'start' }, 1995, 2026), null)
  assert.equal(parseLifeEvent({ year: 2027, kind: 'start' }, 1995, 2026), null)
  assert.equal(parseLifeEvent({ year: 2020, month: 13, kind: 'start' }, 1995, 2026), null)
  assert.equal(parseLifeEvent({ year: 2020, kind: 'death' }, 1995, 2026), null)
  assert.deepEqual(parseLifeEvent({ year: 2020, month: 3, kind: 'move', note: 'x' }, 1995, 2026), { year: 2020, month: 3, kind: 'move' })
  const rec = toValidationRecord({ ...TIMELINE_V3_SAMPLES.nagoya_1995_female }, [{ year: 2020, kind: 'move' }])
  assert.deepEqual(Object.keys(rec).sort(), ['birthDate', 'birthTime', 'events', 'gender', 'prefecture', 'schema'])
  assert.equal(rec.prefecture, '愛知県')
})

test('couple: new pair lines do not duplicate the existing couple manuscript', async () => {
  const { pairParts } = await import('./couple.js')
  const old = new Set(strings(pairParts()))
  const P = depthParts().pair
  assert.deepEqual(strings([P.themeAdvice, P.themeReflection, P.themeApart]).filter(x => old.has(x)), [])
})

test('couple: parts complete and jargon-free', async () => {
  const { pairParts } = await import('./couple.js')
  const Q = pairParts()
  assert.deepEqual(strings(Q).filter(containsJargon), [])
  for (const k of ['both', 'self', 'partner', 'trust', 'quiet', 'friend']) { assert.equal(Q.leads[k].length, 3); assert.equal(Q.tails[k].length, 3); assert.equal(Q.advice[k].length, 3); for (const x of Q.leads[k]) assert.ok(x.endsWith('時期です。')) }
  for (const t of ['move', 'trust']) for (const st of ['partnered', 'married', 'crush', 'former']) { assert.equal(Q.manifestations[t][st].length, 9, `${t}.${st}`); assert.equal(new Set(Q.manifestations[t][st]).size, 9) }
  assert.equal(Q.manifestations.friend.length, 9); assert.equal(Q.manifestations.quiet.length, 9); assert.equal(Q.manifestations.meeting.length, 9)
  for (const st of ['crush', 'former']) assert.equal(Q.apart.manifestations[st].length, 9)
  assert.equal(Object.keys(Q.colorNoun).length, 10)
})

test('couple: timelines match fixtures and follow the rules', async () => {
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  const { COUPLE_SAMPLES } = await import('./samples.js')
  const summarize = (c: any) => ({ id: c.id, title: c.title, tags: c.tags, sections: c.sections.map((s: any) => ({ heading: s.heading, body: s.body })), evidence: c.evidence.map((e: any) => e.detail), decision: c.coupleV3Calculation.decision })
  for (const [name, c] of Object.entries(COUPLE_SAMPLES)) {
    const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style: 'detailed' })
    assert.ok(['ready', 'partial'].includes(r.status))
    for (const e of r.entries) {
      assert.ok(['year', 'label', 'contentStatus', 'card'].every(k => k in e))
      const card: any = e.card
      const display = [card.title, card.summary, ...card.sections.flatMap((s: any) => [s.heading, s.body])].join('\n')
      assert.equal(containsJargon(display), false, `${name} ${card.id}: ${findJargon(display)}`)
      for (const s of card.sections) assert.ok([...s.body].length <= 600, `${name} ${card.id} ${s.heading}`)
      // both adults and romantic: the pair depth sections are present; past years carry no advice-like pair sentence
      const heads = card.sections.map((s: any) => s.heading)
      const bothAdult = e.year - Number(c.self.birthDate!.slice(0, 4)) >= 18 && e.year - Number(c.partner.birthDate!.slice(0, 4)) >= 18
      if (bothAdult) assert.ok(heads.includes('ふたりのこの年の時期'), `${name} ${e.year} pair timing`)
      if (bothAdult && c.relationshipLabel !== '友人') assert.ok(heads.includes('二人の前後の年とのつながり'), `${name} ${e.year} pair continuity`)
      if (e.year < 2026) assert.ok(!/支え役になると|尊重し合えると/.test(card.sections.map((s: any) => s.body).join('')), `${name} ${e.year} advice in past`)
      assert.ok([...card.title].length <= 40, card.title)
      const d = card.coupleV3Calculation.decision
      if (d.marriage) { assert.ok(['partnered', 'engaged'].includes(r.relationshipStatus!)); assert.notEqual(e.year, c.meetingYear) }
      if (c.relationshipLabel === '友人') assert.ok(!card.tags.some((t: string) => /関係が動く|信頼|結びつき/.test(t)))
      if (!c.partner.birthTime && ['partnered', 'engaged', 'married', 'crush', 'former'].includes(r.relationshipStatus!)) assert.ok(card.sections.at(-1).body.includes('相手の出生時刻が分からない'))
      assert.equal(e.label, e.year === c.meetingYear ? '出会った年' : null)
      if (e.year === c.meetingYear && c.relationshipLabel !== '友人') assert.ok(!/区切り|それぞれの道|距離を取/.test(card.sections[1].body), `${name} meeting year reads as an ending: ${card.sections[1].body}`)
    }
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/couple_${name}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(JSON.parse(JSON.stringify({ ...r, entries: r.entries.map(e => ({ ...e, card: e.card && summarize(e.card) })) })), golden.timeline)
  }
})

test('movement quality: the leading direction of the possibilities follows the signals', async () => {
  const { movementQuality } = await import('./signals.js')
  assert.equal(movementQuality(['TL3-R1', 'TL3-R4']), 'grow')
  assert.equal(movementQuality(['TL3-R2']), 'shake')
  assert.equal(movementQuality(['TL3-R1', 'TL3-R2']), 'mixed')
  assert.equal(movementQuality(['TL3-R3', 'TL3-R4']), 'pull')
  const P = parts()
  for (const input of Object.values(TIMELINE_V3_SAMPLES)) {
    const ctx = timelineContext(input)!
    for (let y = 2010; y <= 2045; y++) {
      const { card, decision } = composeYear(ctx, y, 2026)
      const q = (card as any).timelineV3Calculation.decision.quality
      if (!q || decision.ageBand !== 'adult') continue
      const list: string[] = P.manifestations.relationship[y < 2026 ? 'unknown' : input.relationshipStatus ?? 'unknown']
      const first = card.sections![1].body.split(/(?<=。)/)[0]
      const lead = P.qualities[q].order[0]
      const allowed = [list[lead], list[lead + 3]].map(x => { const text = selfVoice(x.replace(/こともあります。$/, 'ことがあります。')); return y < 2026 ? pastizeAll(text) : text })
      assert.ok(allowed.includes(first), `${card.id} ${q}: first possibility "${first}" is not in direction ${lead}`)
      assert.ok(card.sections![0].body.includes(P.qualities[q].sentence[((y % 3) + 3) % 3].slice(0, -6)))
    }
  }
})

test('simple style: one paragraph per year, plain words, same judgement as the detailed cards', async () => {
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  const { COUPLE_SAMPLES } = await import('./samples.js')
  const { timelineV3CardIsValid } = await import('./index.js')
  const check = (name: string, c: any, adult: boolean, past: boolean) => {
    assert.equal(c.sections[0].body, c.summary)
    assert.ok(c.sections.length <= 2, `${name} ${c.id} sections`)
    const n = [...c.summary].length
    if (adult) assert.ok(n >= 120 && n <= 330, `${name} ${c.id} length ${n}`)
    assert.equal(containsJargon(c.summary), false, `${name} ${c.id}: ${findJargon(c.summary)}`)
    assert.ok(!/主題|今年/.test(c.summary), `${name} ${c.id}: wording`)
    assert.ok((c.summary.match(/ことがあります。/g) ?? []).length <= 1, `${name} ${c.id}: possibility endings`)
    if (past) assert.ok(!/(てください|大切に。)/.test(c.summary.replace(/思い出してみてください/g, '')), `${name} ${c.id}: advice in a past year`)
  }
  for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
    const cards = timelineV3Cards(input, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear, 'simple')
    const detailed = timelineV3Cards(input, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear)
    for (const [k, c] of cards.entries()) {
      const y = Number(c.id.slice(-4))
      check(name, c, y - Number(input.birthDate!.slice(0, 4)) >= 18, y < SAMPLE_RANGE.nowYear)
      // same title, tags and judgement as the detailed card; saved simple cards validate
      assert.ok([...c.title].length <= 14, `${name} ${c.id} title ${c.title}`); assert.deepEqual(c.tags, detailed[k].tags)
      assert.ok(timelineV3CardIsValid(c), `${name} ${c.id} simple card not reproducible`)
      assert.deepEqual(timelineV3Cards(input, y, y, SAMPLE_RANGE.nowYear, 'simple')[0], c)
    }
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/simple_${name}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(cards.map((c: any) => ({ id: c.id, title: c.title, tags: c.tags, summary: c.summary })), golden.cards)
  }
  for (const [name, cs] of Object.entries(COUPLE_SAMPLES)) {
    const r = buildCoupleTimelineV3({ ...cs, referenceYear: SAMPLE_RANGE.nowYear })
    for (const e of r.entries.filter(e => e.card)) {
      const adult = e.year - Number(cs.self.birthDate!.slice(0, 4)) >= 18 && e.year - Number(cs.partner.birthDate!.slice(0, 4)) >= 18
      check(`couple_${name}`, e.card, adult, e.year < SAMPLE_RANGE.nowYear)
    }
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/simple_couple_${name}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(r.entries.filter(e => e.card).map((e: any) => ({ id: e.card.id, title: e.card.title, tags: e.card.tags, summary: e.card.summary })), golden.cards)
  }
})

test('年表 (life events): wording only — same judgement, the event is restated, no hit claims, golden fixture', async () => {
  const { TIMELINE_V3_SAMPLES, SAMPLE_RANGE, SAMPLE_EVENTS } = await import('./samples.js')
  const { timelineV3Cards } = await import('./compose.js')
  for (const [name, input] of Object.entries(TIMELINE_V3_SAMPLES)) {
    const events = SAMPLE_EVENTS[name]
    if (!events) continue
    const withEv = timelineV3Cards({ ...input, lifeEvents: events as any }, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear, 'detailed') as any[]
    const without = timelineV3Cards(input, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear, 'detailed') as any[]
    // v2.16: events may change a judgement only through the life-stage window (years since a start / a marriage)
    const { timelineContext, lifeStage } = await import('./signals.js')
    const cA = timelineContext({ ...input, lifeEvents: events as any })!, cB = timelineContext(input)!
    withEv.forEach((c, k) => {
      const y = Number(c.id.slice(-4))
      if (JSON.stringify(lifeStage(cA, y)) === JSON.stringify(lifeStage(cB, y))) assert.deepEqual(c.timelineV3Calculation.decision, without[k].timelineV3Calculation.decision, `${name} ${c.id} decision changed by events`)
    })
    for (const e of events) {
      const c = withEv.find(x => x.id === `turning-year-${e.year}`)
      if (!c) continue
      const sec = c.sections.find((s: any) => s.heading === 'あなたの年表から')
      assert.ok(sec && sec.body.startsWith('あなたの年表では、この年'), `${name} ${e.year} restates the event`)
    }
    for (const c of withEv) for (const s of c.sections) assert.ok(!/的中|予想どおり|当たりました|当たっていました/.test(s.body), `${name} ${c.id} hit claim: ${s.body}`)
    const simple = timelineV3Cards({ ...input, lifeEvents: events as any }, SAMPLE_RANGE.from, SAMPLE_RANGE.to, SAMPLE_RANGE.nowYear, 'simple') as any[]
    for (const c of simple) { assert.ok([...c.summary].length <= 320, `${name} ${c.id} length ${[...c.summary].length}`); assert.ok(!containsJargon(c.summary), `${name} ${c.id} jargon`) }
    const golden = JSON.parse(readFileSync(new URL(`./fixtures/simple_life_${name}.json`, import.meta.url), 'utf8'))
    assert.deepEqual(simple.map((c: any) => ({ id: c.id, title: c.title, tags: c.tags, summary: c.summary })), golden.cards)
  }
})

test('couple × 年表: only your relationship events from the meeting year on, wording only, not for crush/friend', async () => {
  const { COUPLE_SAMPLES, SAMPLE_RANGE } = await import('./samples.js')
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  const events = [{ year: 2016, kind: 'breakup' }, { year: 2021, kind: 'encounter' }, { year: 2022, month: 5, kind: 'start' }, { year: 2025, kind: 'marriage' }]
  for (const [name, c] of Object.entries(COUPLE_SAMPLES)) {
    for (const style of ['simple', 'detailed'] as const) {
      const base = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style })
      const withEv = buildCoupleTimelineV3({ ...c, self: { ...c.self, lifeEvents: events as any }, referenceYear: SAMPLE_RANGE.nowYear, style })
      // v2.16: your 年表 may change a pair judgement only through the marriage-years window
      withEv.entries.forEach((e: any, k: number) => {
        const a = e.card && (e.card as any).coupleV3Calculation.decision, b0 = base.entries[k].card && (base.entries[k].card as any).coupleV3Calculation.decision
        if (a && b0 && JSON.stringify(a.stage) === JSON.stringify(b0.stage)) assert.deepEqual(a, b0, `${name} ${e.year} decision`)
      })
      const text = withEv.entries.filter((e: any) => e.card).map((e: any) => e.card.sections.map((s: any) => s.body).join('')).join('')
      assert.ok(!text.includes('2016年の'), `${name}: an event before the meeting year is used`)
      const used = /あなたの年表では/.test(text)
      if (['crush', 'friend'].includes(name)) assert.ok(!used, `${name}: 年表 used`)
      else if (c.meetingYear <= 2022) assert.ok(used, `${name}: 年表 not used`)
    }
  }
})

test('couple: 揺れやすい年 only for married couples (v2.21), on moving/trust years, never on the meeting or 婚期 year; no 別れ wording', async () => {
  const { COUPLE_SAMPLES, SAMPLE_RANGE } = await import('./samples.js')
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  let seen = 0
  for (const [name, c] of Object.entries(COUPLE_SAMPLES)) {
    const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style: 'detailed' })
    for (const e of r.entries) {
      const card: any = e.card
      if (!card) continue
      const d = card.coupleV3Calculation.decision
      const sway = card.tags.includes('#揺れやすい年')
      if (sway) {
        seen++
        assert.equal(card.coupleV3Calculation.status, 'married', `${name} ${e.year} status`)
        assert.ok(['both', 'self', 'partner', 'trust'].includes(d.theme) && !d.meeting && !d.marriage, `${name} ${e.year} theme`)
      }
      for (const s of card.sections) if (s.heading !== '根拠と期間') assert.ok(!/別れやすい|離婚しやすい/.test(s.body), `${name} ${e.year}: ${s.body}`)
    }
  }
  assert.ok(seen > 0, 'no 揺れやすい年 in the samples')
  // v2.22: with a 年表 marriage after the meeting, no 揺れやすい年 up to the marriage year
  const m = COUPLE_SAMPLES.married
  const wed = m.meetingYear + 3
  const r2 = buildCoupleTimelineV3({ ...m, self: { ...m.self, lifeEvents: [{ year: wed, kind: 'marriage' }] as any }, referenceYear: SAMPLE_RANGE.nowYear, style: 'simple' })
  for (const e of r2.entries) if (e.card && e.year <= wed) assert.ok(!e.card.tags.includes('#揺れやすい年'), `married ${e.year}: 揺れやすい年 before the marriage`)
})

test('v2.19/v2.25 partnerSince: the single timeline opens a dating window from the meeting year; 婚期 only by the regular condition (no guarantee); saved cards re-render with it', async () => {
  const { TIMELINE_V3_SAMPLES } = await import('./samples.js')
  const { decideYear, timelineContext } = await import('./signals.js')
  const { replaceTimelineV3, refreshSavedTimelineV3Cards } = await import('./index.js')
  let windowsWithout = 0
  for (const [name, base] of Object.entries(TIMELINE_V3_SAMPLES)) {
    const since = Number(base.birthDate!.slice(0, 4)) + 26
    const input = { ...base, relationshipStatus: 'partnered' as const, partnerSince: since }
    const ctx = timelineContext(input)!
    const win = [1, 2, 3].map(k => decideYear(ctx, since + k))
    win.forEach((d, k) => assert.equal(d.stage?.kind, 'dating', `${name} ${since + k + 1} stage`))
    // v2.25: no guaranteed 婚期 — a 婚期 year must be a relationship year that meets the regular condition
    for (const [k, d] of win.entries()) if (d.marriage) assert.equal(d.theme, 'relationship', `${name} ${since + k + 1}: 婚期 on a non-relationship year`)
    if (win[0].ageBand === 'adult' && !win.some(d => d.marriage)) windowsWithout++
    const report = replaceTimelineV3({ cards: [], reportText: '' } as any, input, 2026)
    const refreshed = refreshSavedTimelineV3Cards(report.cards, { ...input } as any, 2026, undefined, since)
    assert.deepEqual(refreshed.map(c => c.summary), report.cards.map(c => c.summary), `${name}: refresh with partnerSince`)
  }
  // the samples include dating windows with no 婚期 at all (the guarantee is gone)
  assert.ok(windowsWithout > 0, 'every dating window still has a 婚期: guarantee not removed?')
})

test('v2.21 couple dating window: 1年目 #出会いが深まる時期 (opens with the meeting line), 2〜3年目 #関係の分かれ道, 4年目 #関係の形が決まる時期; no guaranteed 婚期', async () => {
  const { COUPLE_SAMPLES, SAMPLE_RANGE } = await import('./samples.js')
  const { buildCoupleTimelineV3, pairBase, pairContexts, pairStatus } = await import('./couple.js')
  for (const name of ['partnered', 'engaged'] as const) {
    const c = COUPLE_SAMPLES[name]
    const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style: 'simple' })
    const [a, b] = pairContexts(c.self, c.partner, pairStatus(c.relationshipLabel), c.meetingYear)
    const expect: Record<number, string> = { 1: '#出会いが深まる時期', 2: '#関係の分かれ道', 3: '#関係の分かれ道', 4: '#関係の形が決まる時期' }
    for (const k of [1, 2, 3, 4]) {
      const e: any = r.entries.find((x: any) => x.year === c.meetingYear + k)
      if (!e?.card) continue
      assert.ok(e.card.tags.includes(expect[k]), `${name} k=${k}: ${e.card.tags}`)
      if (k === 1) assert.ok(e.card.summary.startsWith('出会ってまだ間もないこの年は'), `${name} k=1: ${e.card.summary.slice(0, 30)}`)
      const d = e.card.coupleV3Calculation.decision
      assert.equal(d.marriage, pairBase(a!, b!, pairStatus(c.relationshipLabel), e.year, c.meetingYear).d.marriage, `${name} ${e.year}: 婚期 only from the signals`)
    }
  }
})

test('v2.23 meeting year for every romantic label: crush / former / married windows with their own wording; single timeline partnerKind', async () => {
  const { COUPLE_SAMPLES, SAMPLE_RANGE, TIMELINE_V3_SAMPLES } = await import('./samples.js')
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  const { decideYear, timelineContext } = await import('./signals.js')
  const { timelineV3Cards } = await import('./compose.js')
  const { depthParts } = await import('./depth.js')
  const T = depthParts().stage.toned
  const has = (text: string, kind: string, n: number) => Object.values(T.body[kind] as Record<string, string[]>).some(v => text.includes(v[n].replace(/です。$/, '')))
  for (const name of ['crush', 'former', 'married'] as const) {
    const c = COUPLE_SAMPLES[name]
    const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style: 'simple' })
    for (const k of [1, 2, 3, 4]) {
      const e: any = r.entries.find((x: any) => x.year === c.meetingYear + k)
      if (!e?.card) continue
      assert.ok(e.card.tags.some((t: string) => ['#出会いが深まる時期', '#関係の分かれ道', '#関係の形が決まる時期', '#暮らしの形が固まる時期'].includes(t)), `${name} k=${k}: ${e.card.tags}`)
      assert.ok(has(e.card.summary, name, k === 1 ? 0 : 1), `${name} k=${k}: ${e.card.summary.slice(0, 80)}`)
      if (name === 'married') {
        assert.ok(!e.card.tags.includes('#揺れやすい年') && !e.card.tags.includes('#関係の分かれ道'), `married k=${k}: ${e.card.tags}`)
        if (k >= 2) assert.ok(!/結婚/.test(e.card.summary.split('。').find((x: string) => x.includes('出会いから')) ?? ''), `married k=${k}: 結婚 in the window line`)
      }
      if (name === 'former') assert.ok(!/一緒に歩む|距離が縮まり、相手/.test(e.card.summary), `former k=${k}: together wording`)
    }
  }
  const base = TIMELINE_V3_SAMPLES.nagoya_1995_female
  const since = 2021
  const input = { ...base, relationshipStatus: 'single' as const, partnerSince: since, partnerKind: 'crush' as const }
  const ctx = timelineContext(input)!
  for (const k of [1, 2, 3]) {
    const d = decideYear(ctx, since + k)
    assert.equal(d.stage?.kind, 'dating'); assert.equal(d.stage?.via, 'crush'); assert.equal(d.marriage, false)
  }
  const text = (timelineV3Cards(input, since + 1, since + 3, 2026, 'simple') as any[]).map(c => c.summary).join('')
  assert.ok(!/出会って|関係が始まって|二人/.test(text), 'self timeline must not narrate the selected relationship duration')
  assert.ok(Object.values(depthParts().stage.selfDating as Record<string, string[]>).flat().some(x => text.includes(x.replace(/です。$/, ''))))
  // without partnerKind, partnerSince still counts for partnered people only (v2.19)
  assert.notEqual(decideYear(timelineContext({ ...base, relationshipStatus: 'single', partnerSince: since })!, since + 1).stage?.kind, 'dating')
})

test('v2.24 the window line follows the year\'s fortune: forward / review / both / steady (single and couple)', async () => {
  const { TIMELINE_V3_SAMPLES, COUPLE_SAMPLES, SAMPLE_RANGE } = await import('./samples.js')
  const { decideYear, timelineContext, stageTone } = await import('./signals.js')
  const { composeYear } = await import('./compose.js')
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  const { depthParts } = await import('./depth.js')
  const T = depthParts().stage.toned
  const seen = new Set<string>()
  for (const [name, base] of Object.entries(TIMELINE_V3_SAMPLES)) {
    for (const since of [2016, 2019, 2022]) {
      const ctx = timelineContext({ ...base, relationshipStatus: 'partnered', partnerSince: since })!
      for (const k of [1, 2, 3]) {
        const d = decideYear(ctx, since + k)
        if (d.ageBand !== 'adult' || d.stage?.kind !== 'dating') continue
        const tone = stageTone(d, since + k < 2026)
        seen.add(tone)
        const r = composeYear(ctx, since + k, 2026)
        assert.ok(r.simple.includes(depthParts().stage.selfDating[tone][k === 1 ? 0 : 1].replace(/です。$/, '')), `${name} ${since + k}: ${tone}`)
      }
    }
  }
  assert.ok(seen.size >= 3, `tones seen: ${[...seen]}`)
  // couple: the 2〜3年目 hint matches the tone of the line
  const c = COUPLE_SAMPLES.partnered
  const r = buildCoupleTimelineV3({ ...c, referenceYear: SAMPLE_RANGE.nowYear, style: 'simple' })
  for (const k of [2, 3]) {
    const e: any = r.entries.find((x: any) => x.year === c.meetingYear + k)
    const tone = (Object.keys(T.body.partnered) as string[]).find(t => e.card.summary.includes(T.body.partnered[t][1].replace(/です。$/, '')))
    assert.ok(tone, `pair k=${k}: no toned line`)
    const hint = T.decision[tone!][e.year < SAMPLE_RANGE.nowYear ? 'reflection' : 'advice']
    assert.ok(e.card.summary.includes(hint), `pair k=${k}: hint does not follow the ${tone} line`)
  }
})

test('v2.24 with the partner\'s birth data, the single timeline\'s window line uses the same two-person tone as ふたりの時系列', async () => {
  const { COUPLE_SAMPLES } = await import('./samples.js')
  const { timelineContext } = await import('./signals.js')
  const { pairTone, pairContexts } = await import('./couple.js')
  const { composeYear } = await import('./compose.js')
  const { depthParts } = await import('./depth.js')
  const T = depthParts().stage.toned
  const { refreshSavedTimelineV3Cards, replaceTimelineV3, timelineV3CardIsValid } = await import('./index.js')
  for (const name of ['partnered', 'crush', 'former'] as const) {
    const c = COUPLE_SAMPLES[name]
    const kind = name
    const input = { ...c.self, partnerSince: c.meetingYear, partnerKind: kind, partnerBirth: c.partner as any }
    const ctx = timelineContext(input)!
    const [a, b] = pairContexts(c.self, c.partner, name, c.meetingYear)
    for (const k of [1, 2, 3]) {
      const y = c.meetingYear + k
      const r = composeYear(ctx, y, 2026)
      if (r.decision.stage?.kind !== 'dating' || r.decision.ageBand !== 'adult') continue
      const pt = pairTone(a!, b!, name, y, c.meetingYear)
      const tone = r.decision.marriage && pt === 'review' ? 'both' : r.decision.marriage && pt === 'steady' ? 'forward' : pt
      assert.ok(r.simple.includes(depthParts().stage.selfDating[tone][k === 1 ? 0 : 1].replace(/です。$/, '')), `${name} ${y}: expected ${tone}`)
    }
    const report = replaceTimelineV3({ cards: [], reportText: '' } as any, input, 2026)
    // the partner's birth data is not stored in the card; only the window tones are
    for (const card of report.cards as any[]) {
      const meta = card.timelineV3Calculation
      assert.ok(!('partnerBirth' in meta.input) && !JSON.stringify(meta).includes(c.partner.birthDate!), `${name}: partner birth stored`)
      assert.ok(timelineV3CardIsValid(card), `${name} ${card.id}: contract parity with stored tones`)
    }
    const refreshed = refreshSavedTimelineV3Cards(report.cards, { ...c.self } as any, 2026, undefined, c.meetingYear, kind, c.partner as any)
    assert.deepEqual(refreshed.map(x => x.summary), report.cards.map(x => x.summary), `${name}: refresh with partnerBirth`)
  }
})

test('self wording keeps the original judgement without narrating a selected relationship duration', () => {
  const base = TIMELINE_V3_SAMPLES.nagoya_1995_female
  for (const kind of ['partnered', 'crush', 'former', 'married'] as const) {
    const input = { ...base, partnerSince: 2023, partnerKind: kind, lifeEvents: [{ kind: 'marriage' as const, year: 2020 }] }
    const ctx = timelineContext(input)!
    for (let year = 2023; year <= 2030; year++) {
      const result = composeYear(ctx, year, 2026)
      assert.deepEqual(result.decision, decideYear(ctx, year), `${kind}/${year}: editorial changes must preserve decisions`)
      const text = [result.simple, result.simpleTitle, result.card.summary, ...result.card.sections!.map(s => s.body)].join('\n')
      assert.ok(!/出会って|関係が始まって|二人/.test(text), `${kind}/${year}: ${text}`)
    }
  }
})

test('past possibilities stay possibilities and long periods do not falsely end in the past', () => {
  assert.equal(pastizeAll('新しい縁につながることがあります。'), '新しい縁につながることがあったかもしれません。')
  assert.equal(pastizeAll('新しい縁につながることもあります。'), '新しい縁につながることもあったかもしれません。')
  const card = timelineV3Cards(TIMELINE_V3_SAMPLES.aichi_1995_female_married, 2025, 2025, 2026, 'simple')[0]
  assert.ok(!/こと(?:も|が)あります。|2年半ほど続きました/.test(card.summary))
  assert.ok(card.summary.includes('約2年半の時期に入りました'))
})

test('couple wording does not assign a personal marriage record to the selected partner', async () => {
  const { buildCoupleTimelineV3 } = await import('./couple.js')
  const { COUPLE_SAMPLES } = await import('./samples.js')
  for (const name of ['former', 'partnered'] as const) {
    const base = COUPLE_SAMPLES[name]
    const result = buildCoupleTimelineV3({ ...base, meetingYear: 2018, referenceYear: 2026, endYear: 2026, self: { ...base.self, lifeEvents: [{ kind: 'marriage', year: 2020 }] } })
    const text = result.entries.flatMap(e => e.card ? [e.card.summary, ...e.card.sections!.map(s => s.body)] : []).join('\n')
    assert.ok(text.includes('あなたの年表では、この年に結婚'))
    assert.ok(!/結婚のあったこの年の二人|結婚から\d+年|暮らしの役割分担/.test(text))
    assert.ok(text.includes('ご自身の年表にある結婚を、今はどう振り返りますか。'))
  }
})
