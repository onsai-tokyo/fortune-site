import { createRequire } from 'node:module'
import type * as AstronomyTypes from 'astronomy-engine'

const Astronomy = createRequire(import.meta.url)('astronomy-engine') as typeof AstronomyTypes

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

export interface AstrologyProfile {
  available: boolean
  reason?: string
  method: string
  western?: { ascendant: ReturnType<typeof zodiac>; planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>; aspects: string[] }
  vedic?: { ayanamsha: number; ascendant: ReturnType<typeof zodiac>; planets: Array<{ name: string; longitude: number; sign: string; degree: number; retrograde: boolean }>; moonNakshatra: string; moonPada: number }
}

export function calcAstrology(year: number, month: number, day: number, hour: number | undefined, minute: number, birthplace?: string): AstrologyProfile {
  if (hour === undefined) return { available: false, reason: '西洋・インド占星術のアセンダント算出には出生時刻が必要です。', method: '出生時刻なし' }
  const [latitude, longitude] = CAPITALS[birthplace || '東京都'] ?? CAPITALS.東京都
  const date = new Date(Date.UTC(year, month - 1, day, hour - 9, minute))
  const previous = new Date(date.getTime() - 12 * 60 * 60 * 1000)
  const ayanamsha = lahiriAyanamsha(date)
  const planets = PLANETS.map(([name, body]) => {
    const tropicalLongitude = Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon
    const previousLongitude = Astronomy.Ecliptic(Astronomy.GeoVector(body, previous, true)).elon
    return { name, longitude: tropicalLongitude, ...zodiac(tropicalLongitude), retrograde: signedDelta(tropicalLongitude, previousLongitude) < 0 }
  })
  const westernAsc = tropicalAscendant(date, latitude, longitude)
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
    method: `出生地${birthplace || '東京都'}の都道府県庁代表座標・日本標準時（JST）`,
    western: { ascendant: zodiac(westernAsc), planets, aspects: aspects.slice(0, 12) },
    vedic: { ayanamsha, ascendant: zodiac(westernAsc - ayanamsha), planets: siderealPlanets, moonNakshatra: NAKSHATRAS[nakshatraIndex], moonPada },
  }
}
