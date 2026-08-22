type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function pick(source: JsonRecord, keys: string[]): JsonRecord {
  return Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]))
}

export function compactCompatibilityPerson(calculatedData: unknown): JsonRecord {
  const data = record(calculatedData)
  const ziwei = record(data.ziwei)
  const astrology = record(data.astrology)
  const western = record(astrology.western)
  const vedic = record(astrology.vedic)
  const relevantPalaces = new Set(['命宮', '命', '夫妻宮', '夫妻', '福徳宮', '福徳', '福德宮', '福德'])
  const palaces = Array.isArray(ziwei.palaces)
    ? ziwei.palaces.map(record).filter(palace => relevantPalaces.has(String(palace.name))).map(palace => pick(palace, ['name', 'majorStars', 'minorStars']))
    : []
  return {
    ...pick(data, ['gender', 'shichuYear', 'shichuMonth', 'shichuDay', 'shichuHour', 'fourPillars', 'elementBalance', 'nayin', 'sanmeiStar', 'chusatsu', 'sukuyo', 'lifePathNumber', 'numerologyProfile', 'honmeiName', 'kyuseiProfile', 'sanmeiRelations']),
    ziwei: { ...pick(ziwei, ['available', 'reason', 'soul', 'body', 'fiveElementsClass']), palaces },
    astrology: {
      ...pick(astrology, ['available', 'reason', 'method']),
      western: pick(western, ['ascendant', 'midheaven', 'planets', 'aspects']),
      vedic: pick(vedic, ['ascendant', 'midheaven', 'moonNakshatra', 'moonPada', 'planets']),
    },
  }
}

export function compactCompatibilityContext(selfData: unknown, partnerData: unknown, relationshipType: 'romantic' | 'friend') {
  return {
    self: compactCompatibilityPerson(selfData),
    partner: compactCompatibilityPerson(partnerData),
    relationshipType,
  }
}
