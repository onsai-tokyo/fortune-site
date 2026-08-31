import type * as AstronomyTypes from 'astronomy-engine'
import { Astronomy } from './astronomyEngineAdapter.js'

const SIGNS = ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座']
const NAKSHATRAS = ['アシュヴィニー', 'バラニー', 'クリッティカー', 'ローヒニー', 'ムリガシーラ', 'アールドラー', 'プナルヴァス', 'プシャ', 'アーシュレーシャ', 'マガー', 'プールヴァ・パールグニー', 'ウッタラ・パールグニー', 'ハスタ', 'チトラー', 'スヴァーティ', 'ヴィシャーカー', 'アヌラーダー', 'ジェーシュタ', 'ムーラ', 'プールヴァ・アーシャーダー', 'ウッタラ・アーシャーダー', 'シュラヴァナ', 'ダニシュター', 'シャタビシャー', 'プールヴァ・バードラパダー', 'ウッタラ・バードラパダー', 'レーヴァティー']

const CAPITALS: Record<string, [number, number]> = {
  北海道: [43.06, 141.35], 青森県: [40.82, 140.74], 岩手県: [39.70, 141.15], 宮城県: [38.27, 140.87], 秋田県: [39.72, 140.10], 山形県: [38.24, 140.36], 福島県: [37.75, 140.47],
  茨城県: [36.34, 140.45], 栃木県: [36.57, 139.88], 群馬県: [36.39, 139.06], 埼玉県: [35.86, 139.65], 千葉県: [35.61, 140.12], 東京都: [35.68, 139.77], 神奈川県: [35.45, 139.64],
  新潟県: [37.90, 139.02], 富山県: [36.70, 137.21], 石川県: [36.59, 136.63], 福井県: [36.07, 136.22], 山梨県: [35.66, 138.57], 長野県: [36.65, 138.18], 岐阜県: [35.39, 136.72], 静岡県: [34.98, 138.38], 愛知県: [35.18, 136.91],
  三重県: [34.73, 136.51], 滋賀県: [35.00, 135.87], 京都府: [35.02, 135.76], 大阪府: [34.69, 135.52], 兵庫県: [34.69, 135.18], 奈良県: [34.69, 135.83], 和歌山県: [34.23, 135.17],
  鳥取県: [35.50, 134.24], 島根県: [35.47, 133.05], 岡山県: [34.66, 133.93], 広島県: [34.40, 132.46], 山口県: [34.19, 131.47], 徳島県: [34.07, 134.56], 香川県: [34.34, 134.05], 愛媛県: [33.84, 132.77], 高知県: [33.56, 133.53],
  福岡県: [33.59, 130.40], 佐賀県: [33.25, 130.30], 長崎県: [32.75, 129.88], 熊本県: [32.79, 130.74], 大分県: [33.24, 131.61], 宮崎県: [31.91, 131.42], 鹿児島県: [31.56, 130.56], 沖縄県: [26.21, 127.68],
}

function resolveCapital(birthplace?: string): { name: string; coordinates: [number, number] } | null {
  const normalized = birthplace?.trim().replace(/[\s　]+/g, '')
  if (!normalized) return null
  const name = Object.keys(CAPITALS).find(candidate => {
    if (normalized === candidate) return true
    if (!normalized.startsWith(candidate)) return false
    // 都道府県名を含む否定文・説明文を住所と誤認しない。後続に市区町村郡がある住所だけを許可する。
    const locality = normalized.slice(candidate.length)
    if (/(?:ではない|でない|じゃない|以外|不明|未定|付近|近く|出生|在住)|[,，。]/.test(locality)) return false
    return /^[一-龯々ヶヵぁ-んァ-ヶー]+(?:市|区|町|村|郡)/.test(locality)
  })
  return name ? { name, coordinates: CAPITALS[name]! } : null
}

const PLANETS: Array<[string, AstronomyTypes.Body]> = [
  ['太陽', Astronomy.Body.Sun], ['月', Astronomy.Body.Moon], ['水星', Astronomy.Body.Mercury], ['金星', Astronomy.Body.Venus], ['火星', Astronomy.Body.Mars], ['木星', Astronomy.Body.Jupiter], ['土星', Astronomy.Body.Saturn], ['天王星', Astronomy.Body.Uranus], ['海王星', Astronomy.Body.Neptune], ['冥王星', Astronomy.Body.Pluto],
]

const normalize = (angle: number) => ((angle % 360) + 360) % 360
const signedDelta = (a: number, b: number) => ((a - b + 540) % 360) - 180
const zodiac = (longitude: number) => ({ sign: SIGNS[Math.floor(normalize(longitude) / 30)], degree: normalize(longitude) % 30 })

function lahiriAyanamsha(date: Date) {
  const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 31_556_952_000
  return 23.85675 + years * (50.290966 / 3600)
}

function tropicalAscendant(date: Date, latitude: number, longitude: number) {
  const theta = normalize(Astronomy.SiderealTime(date) * 15 + longitude) * Math.PI / 180
  const phi = latitude * Math.PI / 180
  const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 31_556_952_000
  const epsilon = (23.439291 - 0.00000036 * years) * Math.PI / 180
  return normalize(Math.atan2(-Math.cos(theta), Math.sin(epsilon) * Math.tan(phi) + Math.cos(epsilon) * Math.sin(theta)) * 180 / Math.PI + 180)
}

function tropicalMidheaven(date: Date, longitude: number) {
  const theta = normalize(Astronomy.SiderealTime(date) * 15 + longitude) * Math.PI / 180
  const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 31_556_952_000
  const epsilon = (23.439291 - 0.00000036 * years) * Math.PI / 180
  return normalize(Math.atan2(Math.sin(theta) / Math.cos(epsilon), Math.cos(theta)) * 180 / Math.PI)
}

export interface AstrologyProfile {
  available: boolean
  anglesAvailable?: boolean
  reason?: string
  method: string
  western?: { ascendant?: ReturnType<typeof zodiac>; midheaven?: ReturnType<typeof zodiac>; planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>; aspects: string[] }
  vedic?: { ayanamsha: number; ascendant?: ReturnType<typeof zodiac>; midheaven?: ReturnType<typeof zodiac>; planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>; moonNakshatra: string; moonPada: number }
  annual?: Array<{ year: number; western: string[]; westernAspects: WesternAnnualAspect[]; vedic: string[]; dashaLord: string; signals: string[]; months: Array<{ month: number; signals: string[]; details: string[] }> }>
}

export interface WesternAnnualAspect {
  transit: '木星' | '土星' | '天王星' | '海王星' | '冥王星'
  natal: string
  aspect: 0 | 60 | 90 | 120 | 180
  orb: number
}

function westernAnnualAspects(date: Date, planets: readonly { name: string; longitude: number }[]): WesternAnnualAspect[] {
  const transitLongitude = (body: AstronomyTypes.Body) => Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon
  const transits = [
    ['木星', Astronomy.Body.Jupiter], ['土星', Astronomy.Body.Saturn], ['天王星', Astronomy.Body.Uranus],
    ['海王星', Astronomy.Body.Neptune], ['冥王星', Astronomy.Body.Pluto],
  ] as const
  const result: WesternAnnualAspect[] = []
  for (const [transit, body] of transits) for (const natal of planets.filter(planet => ['太陽', '月', '水星', '金星', '火星', 'ASC', 'DESC', 'MC', 'IC'].includes(planet.name))) {
    const distance = Math.abs(signedDelta(transitLongitude(body), natal.longitude))
    const angles: readonly (0 | 60 | 90 | 120 | 180)[] = transit === '木星' ? [0, 60, 120] : transit === '土星' ? [0, 90, 180] : [0, 60, 90, 120, 180]
    const orbLimit = transit === '木星' ? 5 : transit === '土星' ? 4 : 3
    const angle = angles.find(candidate => Math.abs(distance - candidate) <= orbLimit)
    if (angle !== undefined) result.push({ transit, natal: natal.name, aspect: angle, orb: Math.abs(distance - angle) })
  }
  return result
}

/** 出生時刻を使わず、個人天体への年運トランジットだけを算出する。 */
export function calcTimeIndependentWesternAnnualAspects(year: number, month: number, day: number): Array<{ year: number; aspects: WesternAnnualAspect[] }> {
  const natalDate = new Date(Date.UTC(year, month - 1, day, 3, 0))
  const natalPlanets = PLANETS.filter(([name]) => ['太陽', '月', '水星', '金星', '火星'].includes(name)).map(([name, body]) => ({
    name, longitude: Astronomy.Ecliptic(Astronomy.GeoVector(body, natalDate, true)).elon,
  }))
  return Array.from({ length: 43 }, (_, offset) => {
    const targetYear = year + 18 + offset
    const date = new Date(Date.UTC(targetYear, month - 1, day, 3, 0))
    return { year: targetYear, aspects: westernAnnualAspects(date, natalPlanets) }
  })
}

const DASHA_LORDS = ['ケートゥ', '金星', '太陽', '月', '火星', 'ラーフ', '木星', '土星', '水星']
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17]
const DASHA_SIGNALS: Record<string, string[]> = {
  ケートゥ: ['transformation', 'insight'], 金星: ['harmony', 'care'], 太陽: ['initiative', 'responsibility'],
  月: ['care', 'harmony'], 火星: ['initiative', 'transformation'], ラーフ: ['exploration', 'transformation'],
  木星: ['exploration', 'practicality'], 土星: ['responsibility', 'stability'], 水星: ['communication', 'insight'],
}

export interface VedicAnnualDasha {
  year: number
  available: boolean
  mahadashaLord?: string
  antardashaLord?: string
  mahadashaTransition: boolean
  house5Lord?: string
  house7Lord?: string
  house8Lord?: string
  house10Lord?: string
}

const VEDIC_SIGN_RULERS = ['火星', '金星', '水星', '月', '太陽', '水星', '金星', '火星', '木星', '土星', '土星', '木星'] as const
const vedicHouseLord = (ascendantSign: number, house: number) => VEDIC_SIGN_RULERS[(ascendantSign + house - 1) % 12]!

function vedicAnnualDashaFromMoon(
  year: number, natalMoon: number, available: boolean,
  houses: Pick<VedicAnnualDasha, 'house5Lord' | 'house7Lord' | 'house8Lord' | 'house10Lord'> = {},
): VedicAnnualDasha[] {
  const nakLength = 360 / 27
  const lordStart = Math.floor(natalMoon / nakLength) % 9
  const elapsedFraction = (natalMoon % nakLength) / nakLength
  return Array.from({ length: 43 }, (_, offset) => {
    const targetYear = year + 18 + offset
    const current = vimshottariAtAge(lordStart, elapsedFraction, targetYear - year)
    const previous = vimshottariAtAge(lordStart, elapsedFraction, targetYear - year - 1)
    return { year: targetYear, available, ...(available ? { ...current, ...houses } : {}), mahadashaTransition: available && current.mahadashaLord !== previous.mahadashaLord }
  })
}

function vimshottariAtAge(lordStart: number, elapsedFraction: number, age: number) {
  let mahaIndex = lordStart
  let elapsed = age + DASHA_YEARS[lordStart]! * elapsedFraction
  while (elapsed >= DASHA_YEARS[mahaIndex]!) {
    elapsed -= DASHA_YEARS[mahaIndex]!
    mahaIndex = (mahaIndex + 1) % 9
  }
  let antarIndex = mahaIndex
  let remaining = elapsed
  for (let count = 0; count < 9; count += 1) {
    const duration = DASHA_YEARS[mahaIndex]! * DASHA_YEARS[antarIndex]! / 120
    if (remaining < duration) break
    remaining -= duration
    antarIndex = (antarIndex + 1) % 9
  }
  return { mahadashaLord: DASHA_LORDS[mahaIndex]!, antardashaLord: DASHA_LORDS[antarIndex]! }
}

/** 厳密な分境界判定がないため、時刻不明のダシャーは一律で利用不可にする。 */
export function calcTimeIndependentVedicAnnualDasha(year: number, month: number, day: number): VedicAnnualDasha[] {
  const moonLongitude = (date: Date) => normalize(Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, date, true)).elon - lahiriAyanamsha(date))
  const localMidnightUtc = Date.UTC(year, month - 1, day - 1, 15, 0)
  // 25点サンプリングは「一日中系列が不変」の証明にならない。
  // 分境界の厳密判定を導入するまでは、時刻不明のダシャーを安全側で利用不可にする。
  return vedicAnnualDashaFromMoon(year, moonLongitude(new Date(localMidnightUtc + 12 * 60 * 60_000)), false)
}

/** 出生時刻がある場合は、その瞬間の月位置からダシャーを常に確定する。 */
export function calcVedicAnnualDasha(year: number, month: number, day: number, hour: number, minute = 0, birthplace?: string): VedicAnnualDasha[] {
  const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute))
  const moon = normalize(Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Moon, date, true)).elon - lahiriAyanamsha(date))
  const capital = resolveCapital(birthplace)
  if (!capital) return vedicAnnualDashaFromMoon(year, moon, true)
  const [latitude, longitude] = capital.coordinates
  const ascendant = normalize(tropicalAscendant(date, latitude, longitude) - lahiriAyanamsha(date))
  const ascendantSign = Math.floor(ascendant / 30)
  return vedicAnnualDashaFromMoon(year, moon, true, {
    house5Lord: vedicHouseLord(ascendantSign, 5),
    house7Lord: vedicHouseLord(ascendantSign, 7),
    house8Lord: vedicHouseLord(ascendantSign, 8),
    house10Lord: vedicHouseLord(ascendantSign, 10),
  })
}

function annualAstrology(
  natalDate: Date,
  planets: AstrologyProfile['western'] extends infer W ? any[] : never,
  siderealPlanets: any[],
  ayanamsha: number,
  angles: readonly { name: string; longitude: number }[] = [],
  localBirthDate = { year: natalDate.getUTCFullYear(), month: natalDate.getUTCMonth() + 1, day: natalDate.getUTCDate() },
) {
  const birthYear = localBirthDate.year
  const natalMoonSidereal = siderealPlanets.find(planet => planet.name === '月')?.longitude ?? 0
  const nakLength = 360 / 27
  const nakIndex = Math.floor(natalMoonSidereal / nakLength)
  const lordStart = nakIndex % 9
  const elapsedFraction = (natalMoonSidereal % nakLength) / nakLength
  const firstRemaining = DASHA_YEARS[lordStart] * (1 - elapsedFraction)
  const relevantNatal = planets.filter(planet => ['太陽', '月', '金星', '火星'].includes(planet.name))
  return Array.from({ length: 43 }, (_, offset) => {
    const year = birthYear + 18 + offset
    const date = new Date(Date.UTC(year, localBirthDate.month - 1, localBirthDate.day, 3, 0))
    const transit = (body: AstronomyTypes.Body) => Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon
    const jupiter = transit(Astronomy.Body.Jupiter)
    const saturn = transit(Astronomy.Body.Saturn)
    const western: string[] = []
    const westernAspects = westernAnnualAspects(date, [...relevantNatal, ...angles])
    const signals: string[] = []
    for (const natal of relevantNatal) {
      const jDistance = Math.abs(signedDelta(jupiter, natal.longitude))
      if ([0, 60, 120].some(angle => Math.abs(jDistance - angle) <= 5)) {
        western.push(`木星が出生時の${natal.name}を後押し`)
        signals.push(natal.name === '金星' || natal.name === '月' ? 'harmony' : 'exploration')
      }
      const sDistance = Math.abs(signedDelta(saturn, natal.longitude))
      if ([0, 90, 180].some(angle => Math.abs(sDistance - angle) <= 4)) {
        western.push(`土星が出生時の${natal.name}へ節目を形成`)
        signals.push('responsibility', natal.name === '金星' || natal.name === '月' ? 'transformation' : 'stability')
      }
    }
    const siderealJupiterSign = Math.floor(normalize(jupiter - lahiriAyanamsha(date)) / 30)
    const siderealSaturnSign = Math.floor(normalize(saturn - lahiriAyanamsha(date)) / 30)
    const moonSign = Math.floor(natalMoonSidereal / 30)
    const jHouse = ((siderealJupiterSign - moonSign + 12) % 12) + 1
    const sHouse = ((siderealSaturnSign - moonSign + 12) % 12) + 1
    const vedic: string[] = []
    if ([2, 5, 7, 9, 11].includes(jHouse)) { vedic.push(`木星が月から第${jHouse}室`); signals.push(jHouse === 7 ? 'harmony' : 'exploration') }
    if ([12, 1, 2].includes(sHouse)) { vedic.push('土星が月の前後を通過'); signals.push('responsibility', 'transformation') }
    const age = year - birthYear
    let remaining = age - firstRemaining
    let lordIndex = lordStart
    if (remaining >= 0) {
      lordIndex = (lordIndex + 1) % 9
      while (remaining >= DASHA_YEARS[lordIndex]) { remaining -= DASHA_YEARS[lordIndex]; lordIndex = (lordIndex + 1) % 9 }
    }
    const dashaLord = DASHA_LORDS[lordIndex]
    signals.push(...(DASHA_SIGNALS[dashaLord] ?? []))
    const months = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthDate = new Date(Date.UTC(year, monthIndex, 15, 3, 0))
      const monthTransit = (body: AstronomyTypes.Body) => Astronomy.Ecliptic(Astronomy.GeoVector(body, monthDate, true)).elon
      const monthJupiter = monthTransit(Astronomy.Body.Jupiter)
      const monthSaturn = monthTransit(Astronomy.Body.Saturn)
      const monthSignals: string[] = []
      const details: string[] = []
      for (const natal of relevantNatal) {
        const jDistance = Math.abs(signedDelta(monthJupiter, natal.longitude))
        if ([0, 60, 120].some(angle => Math.abs(jDistance - angle) <= 3)) {
          monthSignals.push(natal.name === '金星' || natal.name === '月' ? 'harmony' : 'exploration')
          details.push(`木星が出生時の${natal.name}を後押し`)
        }
        const sDistance = Math.abs(signedDelta(monthSaturn, natal.longitude))
        if ([0, 90, 180].some(angle => Math.abs(sDistance - angle) <= 2.5)) {
          monthSignals.push('responsibility', natal.name === '金星' || natal.name === '月' ? 'transformation' : 'stability')
          details.push(`土星が出生時の${natal.name}へ節目を形成`)
        }
      }
      return { month: monthIndex + 1, signals: [...new Set(monthSignals)], details: [...new Set(details)] }
    }).filter(month => month.signals.length > 0)
    return { year, western: [...new Set(western)], westernAspects, vedic, dashaLord, signals: [...new Set(signals)], months }
  })
}

export function calcAstrology(year: number, month: number, day: number, hour: number | undefined, minute: number, birthplace?: string): AstrologyProfile {
  if (hour === undefined) return { available: false, reason: '西洋・インド占星術のアセンダント算出には出生時刻が必要です。', method: '出生時刻なし' }
  const capital = resolveCapital(birthplace)
  const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute))
  const previous = new Date(date.getTime() - 12 * 60 * 60 * 1000)
  const ayanamsha = lahiriAyanamsha(date)
  const planets = PLANETS.map(([name, body]) => {
    const tropicalLongitude = Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon
    const previousLongitude = Astronomy.Ecliptic(Astronomy.GeoVector(body, previous, true)).elon
    return { name, longitude: tropicalLongitude, ...zodiac(tropicalLongitude), retrograde: signedDelta(tropicalLongitude, previousLongitude) < 0 }
  })
  const [latitude, longitude] = capital?.coordinates ?? [undefined, undefined]
  const westernAsc = latitude === undefined || longitude === undefined ? undefined : tropicalAscendant(date, latitude, longitude)
  const westernMc = longitude === undefined ? undefined : tropicalMidheaven(date, longitude)
  const aspectAngles: Array<[number, string, number]> = [[0, 'コンジャンクション', 7], [60, 'セクスタイル', 5], [90, 'スクエア', 6], [120, 'トライン', 6], [180, 'オポジション', 7]]
  const aspects: string[] = []
  for (let i = 0; i < planets.length; i++) for (let j = i + 1; j < planets.length; j++) {
    const distance = Math.abs(signedDelta(planets[i].longitude, planets[j].longitude))
    const aspect = aspectAngles.find(([angle, , orb]) => Math.abs(distance - angle) <= orb)
    if (aspect) aspects.push(`${planets[i].name}と${planets[j].name}の${aspect[1]}（オーブ${Math.abs(distance - aspect[0]).toFixed(1)}°）`)
  }
  const siderealPlanets = planets.map(planet => ({ ...planet, longitude: normalize(planet.longitude - ayanamsha), ...zodiac(planet.longitude - ayanamsha) }))
  const siderealMoon = siderealPlanets.find(planet => planet.name === '月')!
  const nakshatraIndex = Math.floor(siderealMoon.longitude / (360 / 27))
  const moonPada = Math.floor((siderealMoon.longitude % (360 / 27)) / (360 / 108)) + 1
  return {
    available: true,
    anglesAvailable: capital !== null,
    ...(capital ? {} : { reason: '出生地を都道府県へ解決できないため角度・ハウスのみ算出していません。' }),
    method: capital ? `出生地${capital.name}の都道府県庁代表座標・日本標準時（JST）` : '出生時刻による個人天体のみ・出生地未解決',
    western: { ...(westernAsc === undefined ? {} : { ascendant: zodiac(westernAsc) }), ...(westernMc === undefined ? {} : { midheaven: zodiac(westernMc) }), planets, aspects: aspects.slice(0, 12) },
    vedic: { ayanamsha, ...(westernAsc === undefined ? {} : { ascendant: zodiac(westernAsc - ayanamsha) }), ...(westernMc === undefined ? {} : { midheaven: zodiac(westernMc - ayanamsha) }), planets: siderealPlanets, moonNakshatra: NAKSHATRAS[nakshatraIndex], moonPada },
    annual: annualAstrology(date, planets, siderealPlanets, ayanamsha, [
      ...(westernAsc === undefined ? [] : [{ name: 'ASC', longitude: westernAsc }, { name: 'DESC', longitude: normalize(westernAsc + 180) }]),
      ...(westernMc === undefined ? [] : [{ name: 'MC', longitude: westernMc }, { name: 'IC', longitude: normalize(westernMc + 180) }]),
    ], { year, month, day }),
  }
}
