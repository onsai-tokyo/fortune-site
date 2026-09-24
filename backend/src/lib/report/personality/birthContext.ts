/** App birthplace selections are Japanese prefectures. Unknown free text is not a timezone. */
const PREFECTURES = new Set('北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' '))

export const SPOUSE_BIRTH_CONTEXT_VERSION = 'japan-prefecture-or-nagoya:1'

export function resolveSpouseTimeZone(input: { birthTimeZone?: string; birthplace?: string }): string | undefined {
  // An explicit unsupported value must reach the calculation gate, not fall back to Japan.
  if (input.birthTimeZone !== undefined) return typeof input.birthTimeZone === 'string' ? input.birthTimeZone : undefined
  if (typeof input.birthplace !== 'string') return undefined
  const place = input.birthplace.trim().replace(/[\s　]+/g, '')
  if (PREFECTURES.has(place) || place === '名古屋' || place === '名古屋市') return 'Asia/Tokyo'
  // Full-string matching rejects negations, mixed countries and explanatory text.
  const prefecture = [...PREFECTURES].find(name => place.startsWith(name))
  if (!prefecture) return undefined
  const locality = place.slice(prefecture.length)
  if (/(?:ではない|じゃない|でない|以外|不明|未定|付近|近く|出生|在住|海外)/.test(locality)) return undefined
  return /^(?:[一-龯々ヶヵぁ-んァ-ヶー]+(?:市|区|町|村|郡))+$/.test(locality) ? 'Asia/Tokyo' : undefined
}
