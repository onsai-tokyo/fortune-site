import { astro as iztro } from 'iztro'
import { calcAstrology } from '../lib/astrology.js'
import { Astronomy } from '../lib/astronomyEngineAdapter.js'
import { calcShichu, calcTenGod } from '../lib/divination/index.js'
import { assertFateLabZiweiConfig, timeIndex } from '../lib/ziwei.js'
import { assertTimingEvidenceBirthInput, type TimingEvidenceBirthInput } from '../lib/report/timingEvidencePipeline.js'
import { buildWesternTimingEvidence } from '../lib/report/timingWesternEvidence.js'
import { diagnoseVimshottariInterval } from './vimshottariDiagnostic.js'
import { composeEventPatterns, type EventFact, type EventTheme } from './eventPatternRules.js'

const DAY = 86_400_000
const JST = 9 * 3_600_000
const SIGNS = ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座']
const RULERS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']
const JA: Record<string, string> = { Mars: '火星', Venus: '金星', Mercury: '水星', Moon: '月', Sun: '太陽', Jupiter: '木星', Saturn: '土星', Rahu: 'ラーフ', Ketu: 'ケートゥ' }
const BODIES = [['木星', Astronomy.Body.Jupiter], ['土星', Astronomy.Body.Saturn], ['天王星', Astronomy.Body.Uranus], ['海王星', Astronomy.Body.Neptune], ['冥王星', Astronomy.Body.Pluto]] as const
const PERSONAL = [['太陽', Astronomy.Body.Sun], ['水星', Astronomy.Body.Mercury], ['金星', Astronomy.Body.Venus], ['火星', Astronomy.Body.Mars]] as const
const dist = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const longitude = (body: Parameters<typeof Astronomy.GeoVector>[0], date: Date) => Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon
const isoDay = (time: number) => new Date(time + JST).toISOString().slice(0, 10)
const pair = (a: string, b: string, pairs: string[]) => pairs.some(p => p.includes(a) && p.includes(b) && a !== b)

export interface EventStudyWindow { from: string; until: string }
export function eventWindowDays(window: EventStudyWindow): string[] {
  const parse = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new RangeError('Expected YYYY-MM-DD window')
    const t = Date.parse(`${s}T00:00:00+09:00`)
    if (!Number.isFinite(t) || isoDay(t) !== s) throw new RangeError('Invalid calendar date')
    return t
  }
  const start = parse(window.from), end = parse(window.until)
  if (end <= start || end - start > 366 * DAY) throw new RangeError('Window must be positive and at most 366 days')
  return Array.from({ length: (end - start) / DAY }, (_, i) => isoDay(start + i * DAY))
}

/** Houses are a declared whole-sign research interpretation, not a production rule. */
export function housesForLord(ascendantSign: number, lord: string): number[] {
  if (!Number.isInteger(ascendantSign) || ascendantSign < 0 || ascendantSign > 11) throw new RangeError('Invalid ascendant sign')
  return Array.from({ length: 12 }, (_, i) => i + 1).filter(h => RULERS[(ascendantSign + h - 1) % 12] === lord)
}
export function themesForHouses(houses: readonly number[]): EventTheme[] {
  const themes: EventTheme[] = []
  if (houses.includes(5) || houses.includes(7)) themes.push('relationship.contact')
  if (houses.includes(7)) themes.push('relationship.structure')
  if (houses.includes(6) || houses.includes(10)) themes.push('career.activity')
  if (houses.includes(2) || houses.includes(11)) themes.push('money.conditions')
  if (houses.includes(4)) themes.push('home.establish')
  if (houses.includes(5) || houses.includes(9)) themes.push('education.activity')
  return themes
}
function westernThemes(aspect: { transit: typeof BODIES[number][0]; natal: string; aspect: 0 | 60 | 90 | 120 | 180; orb: number }, known: boolean): EventTheme[] {
  const angle = ['ASC', 'DESC', 'MC', 'IC'].includes(aspect.natal)
  const rows = buildWesternTimingEvidence([{ year: 2000, aspects: angle ? [] : [aspect], angleAspects: angle ? [aspect] : [] }], { hasBirthTime: known, personalPlanetsAvailable: true }).get(2000)!
  const map: Partial<Record<typeof rows[number]['scoreKey'], EventTheme>> = {
    relationship_activation: 'relationship.contact', relationship_binding: 'relationship.structure',
    relationship_disruption: 'relationship.review', relationship_secrecy: 'relationship.review',
    relationship_idealization: 'relationship.review', marriage_legalization: 'relationship.structure',
    career_activation: 'career.activity', career_change: 'career.activity', career_expansion: 'career.activity',
    money_status: 'money.conditions', home_family: 'home.establish', education_activation: 'education.activity',
    education_disruption: 'pressure', emotional_stress: 'pressure', identity_reset: 'identity.change', relocation: 'identity.change',
  }
  const themes = rows.filter(r => r.matched && r.available && r.support > 0 && (r.polarity ?? 1) > 0).flatMap(r => map[r.scoreKey] ? [map[r.scoreKey]!] : [])
  // Research proposal P07: soft Uranus/Venus contacts were absent from the old contact adapter.
  if (aspect.transit === '天王星' && aspect.natal === '金星' && [60, 120].includes(aspect.aspect) && aspect.orb < 3) themes.push('relationship.contact')
  return [...new Set(themes)]
}

/** Birth + interval only. Observations, names, notes and expected outcomes cannot choose a rule. */
export function buildEventPatternStudy(birth: TimingEvidenceBirthInput, window: EventStudyWindow) {
  const days = eventWindowDays(window)
  const input: TimingEvidenceBirthInput = { birthYear: birth.birthYear, birthMonth: birth.birthMonth, birthDay: birth.birthDay,
    birthHour: birth.birthHour, birthMinute: birth.birthMinute, birthplace: birth.birthplace, gender: birth.gender }
  assertTimingEvidenceBirthInput(input)
  const birthDay = `${input.birthYear}-${String(input.birthMonth).padStart(2, '0')}-${String(input.birthDay).padStart(2, '0')}`
  if (window.from <= birthDay || Number(window.until.slice(0, 4)) > input.birthYear + 119) throw new RangeError('Study window must follow birth and be within 119 years')
  const known = input.birthHour !== undefined
  const natal = calcShichu(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0)
  const dayStable = known || [0, 23].every(hour => calcShichu(input.birthYear, input.birthMonth, input.birthDay, hour, 59).day.kanshi === natal.day.kanshi)
  const chart = calcAstrology(input.birthYear, input.birthMonth, input.birthDay, input.birthHour, input.birthMinute ?? 0, input.birthplace)
  const conditions: string[] = ['研究候補。出来事の結末・人物の同一性・初回かどうかは未判定。', '西洋はJST正午の日次サンプル。干支の節入り日と紫微の年界は別々に計算。', '角度とハウスは県庁代表座標。近似Lahiri・365.25日/年方式。独立オラクル未検証。']
  const birthInstant = known ? new Date(Date.UTC(input.birthYear, input.birthMonth - 1, input.birthDay, input.birthHour! - 9, input.birthMinute ?? 0)) : null
  const asc = chart.vedic?.ascendant
  const ascendantSign = asc ? SIGNS.indexOf(asc.sign) : null
  let housesStable = ascendantSign !== null && ascendantSign >= 0
  if (birthInstant && asc) {
    // Explicit diagnostic perturbation, not a claim about the user's actual time error.
    const signs = [-5, 5].map(minutes => {
      const shifted = new Date(birthInstant.getTime() + JST + minutes * 60_000)
      return calcAstrology(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), shifted.getUTCHours(), shifted.getUTCMinutes(), input.birthplace).vedic?.ascendant?.sign
    })
    housesStable = signs.every(s => s === asc.sign)
    if (!housesStable) conditions.push('±5分の感度診断でインドASC星座が変わるため、支配室による本文の採用を保留。ダシャー区間自体は残す。')
  }
  if (!known) conditions.push('出生時刻不明。月・角度・ハウス・インドの期間・紫微は未判定。西洋の他の個人天体はJST仮定の24時刻サンプルで共通する配置のみ。')
  if (!input.birthplace) conditions.push('出生地・タイムゾーン未確認。JST仮定の結果として扱う。')
  if (!dayStable) conditions.push('出生日内で日柱が安定しないため、日支・通変星による採用を保留。')
  const natalSets = known ? [chart.western!.planets.filter(p => ['太陽', '月', '水星', '金星', '火星'].includes(p.name))]
    : Array.from({ length: 24 }, (_, hour) => PERSONAL.map(([name, body]) => ({ name, longitude: longitude(body, new Date(Date.UTC(input.birthYear, input.birthMonth - 1, input.birthDay, hour - 9))) })))
  const angles: Array<{ name: string; longitude: number }> = []
  if (known) for (const [angle, name, opposite] of [[chart.western?.ascendant, 'ASC', 'DESC'], [chart.western?.midheaven, 'MC', 'IC']] as const) {
    if (angle) { const lon = SIGNS.indexOf(angle.sign) * 30 + angle.degree; angles.push({ name, longitude: lon }, { name: opposite, longitude: (lon + 180) % 360 }) }
  }
  const moon = known ? chart.vedic?.planets.find(p => p.name === '月')?.longitude ?? null : null
  const dasha = diagnoseVimshottariInterval({ birthInstant: birthInstant?.toISOString() ?? null, siderealMoonLongitude: moon,
    sourceRef: 'existing calcAstrology approximate Lahiri', from: `${window.from}T00:00:00+09:00`, until: `${window.until}T00:00:00+09:00` })
  assertFateLabZiweiConfig()
  const ziwei = known ? iztro.bySolar(birthDay, timeIndex(input.birthHour!), input.gender, true, 'ja-JP') : null
  const facts = new Map<string, EventFact>()
  const add = (id: string, fact: Omit<EventFact, 'id' | 'days'>, day: string) => {
    const old = facts.get(id)
    if (old) {
      if (!old.days.includes(day)) old.days.push(day)
      if (fact.minimumOrb !== undefined) old.minimumOrb = Math.min(old.minimumOrb!, fact.minimumOrb)
      old.themes = [...new Set([...old.themes, ...fact.themes])]
    } else facts.set(id, { ...fact, id, days: [day] })
  }
  for (const day of days) {
    const date = new Date(`${day}T12:00:00+09:00`)
    const [year, month, dom] = day.split('-').map(Number)
    const current = calcShichu(year, month, dom, 12, 0)
    if (dayStable) for (const scope of ['year', 'month'] as const) {
      const pillar = current[scope], branch = natal.day.branch
      const relation = pair(branch, pillar.branch, ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']) ? '冲'
        : pair(branch, pillar.branch, ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌']) ? '破'
          : pair(branch, pillar.branch, ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']) ? '六合' : null
      // A pair can be both 六合 and 破; preserve both instead of choosing a favorable reading.
      const relations = [...new Set([relation, pair(branch, pillar.branch, ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']) ? '六合' : null])].filter((r): r is string => r !== null)
      for (const r of relations) {
        const id = `calendar:${scope}:${pillar.kanshi}:day-${branch}:${r}`
        add(id, { system: '四柱推命・算命学', group: 'stem_branch_calendar', kind: 'calendar_relation', lineage: id,
          detail: `${scope === 'year' ? '年' : '月'}柱${pillar.kanshi}と日支${branch}：${r}`, themes: [r === '六合' ? 'relationship.structure' : 'relationship.review'] }, day)
      }
      const god = calcTenGod(natal.day.stemIdx, pillar.stemIdx)
      if ((input.gender === 'female' ? ['偏官', '正官'] : ['偏財', '正財']).includes(god)) {
        const id = `calendar:${scope}:${pillar.kanshi}:relationship-role`
        add(id, { system: '四柱推命・算命学', group: 'stem_branch_calendar', kind: 'calendar_relation', lineage: `calendar:${scope}:${pillar.kanshi}:stem`,
          detail: `${scope === 'year' ? '年' : '月'}干${pillar.stem}：${god}。伝統的な関係領域の候補で、交際や婚姻の確定ではない。`, themes: ['relationship.structure'] }, day)
      }
    }
    for (const [transit, body] of BODIES) {
      const lon = longitude(body, date), limit = transit === '木星' ? 5 : transit === '土星' ? 4 : 3
      const allowed: readonly (0 | 60 | 90 | 120 | 180)[] = transit === '木星' ? [0, 60, 120] : transit === '土星' ? [0, 90, 180] : [0, 60, 90, 120, 180]
      for (const n of [...natalSets[0], ...angles]) for (const aspect of allowed) {
        const values = angles.includes(n) ? [Math.abs(dist(lon, n.longitude) - aspect)] : natalSets.map(set => Math.abs(dist(lon, set.find(p => p.name === n.name)!.longitude) - aspect))
        const orb = Math.max(...values)
        if (orb > limit) continue
        const id = `western:${transit}:${n.name}:${aspect}`
        add(id, { system: '西洋占星術', group: 'astronomical_ephemeris', kind: 'western_transit', lineage: id,
          detail: `${transit}→出生${n.name} ${aspect}°`, transit, natal: n.name, aspect, minimumOrb: orb,
          themes: westernThemes({ transit, natal: n.name, aspect, orb }, known) }, day)
      }
    }
    for (const period of dasha.periods.filter(p => Date.parse(p.start) <= date.getTime() && date.getTime() < Date.parse(p.end))) {
      const houses = housesStable && ascendantSign !== null ? housesForLord(ascendantSign, period.minor) : []
      const id = `vedic:${period.major}:${period.minor}:${period.start}`
      add(id, { system: 'インド占星術', group: 'astronomical_ephemeris', kind: 'vedic_period', lineage: id,
        detail: `${JA[period.major]}／${JA[period.minor]}期。副期星の支配室：${houses.join('・') || '未採用'}`, houses,
        period, themes: themesForHouses(houses) }, day)
    }
    if (ziwei) {
      const yearly = ziwei.horoscope(day, 6).yearly
      const palace = String(ziwei.palaces[yearly.index]?.name ?? '').replace('祿', '禄').replace(/宮$/, '')
      const topics = (name: string): EventTheme[] => name === '夫妻' ? ['relationship.structure'] : name === '田宅' ? ['home.establish']
        : name === '官禄' ? ['career.activity'] : name === '財帛' ? ['money.conditions'] : ['命', '遷移'].includes(name) ? ['identity.change'] : []
      const id = `ziwei:${yearly.heavenlyStem}${yearly.earthlyBranch}:life:${palace}`
      add(id, { system: '紫微斗数', group: 'ziwei_chart', kind: 'ziwei_palace', lineage: id, palace,
        detail: `流年${yearly.heavenlyStem}${yearly.earthlyBranch}の命宮→本命${palace}宮`, themes: topics(palace) }, day)
      yearly.mutagen.forEach((star, i) => {
        const owners = ziwei.palaces.filter(p => [...p.majorStars, ...p.minorStars].some(s => s.name === star))
        if (owners.length !== 1) return
        const name = String(owners[0].name).replace('祿', '禄').replace(/宮$/, ''), mutagen = ['化禄', '化権', '化科', '化忌'][i]
        const mid = `ziwei:${yearly.heavenlyStem}${yearly.earthlyBranch}:${star}:${mutagen}:${name}`
        add(mid, { system: '紫微斗数', group: 'ziwei_chart', kind: 'ziwei_mutagen', lineage: mid, palace: name, mutagen,
          detail: `${star}${mutagen}→本命${name}宮。領域の活性化と制約を扱い、結末は確定しない。`,
          themes: [...topics(name), ...(mutagen === '化忌' && name === '夫妻' ? ['relationship.review' as const] : [])] }, day)
      })
    }
  }
  return { input, window: { from: window.from, until: window.until }, conditions, housesStable, ascendant: asc ?? null,
    dasha, ...composeEventPatterns([...facts.values()]) }
}
