export const MAX_PARTNER_PROFILES = 2

export const relationshipGroups: Record<string, 'romantic' | 'friend' | 'family'> = {
  '片思い': 'romantic', 'お付き合い中': 'romantic', '婚約中': 'romantic', '夫婦': 'romantic', '復縁希望': 'romantic', '元恋人': 'romantic',
  '友人': 'friend', '親友': 'friend', '会社の同僚': 'friend', '上司': 'friend', '部下': 'friend', '取引先': 'friend', 'その他': 'friend',
  '親': 'family', '子': 'family', '兄弟姉妹': 'family', '配偶者の家族': 'family',
}

export function normalizeRelationship(label: unknown, legacyType?: unknown) {
  const relationshipLabel = typeof label === 'string' && relationshipGroups[label]
    ? label : legacyType === 'friend' ? '友人' : legacyType === 'family' ? '親' : 'お付き合い中'
  return { relationshipLabel, relationshipType: relationshipGroups[relationshipLabel] }
}

export function assertPartnerCapacity(currentCount: number) {
  if (currentCount >= MAX_PARTNER_PROFILES) {
    const error = new Error(`登録できる相手は${MAX_PARTNER_PROFILES}人までです。既存の相手を削除してから登録してください。`)
    Object.assign(error, { statusCode: 409 })
    throw error
  }
}

export function validatePartnerProfile(value: Record<string, unknown>) {
  const displayName = typeof value.displayName === 'string' ? value.displayName.trim().slice(0, 40) : ''
  const birthDate = typeof value.birthDate === 'string' ? value.birthDate : ''
  const birthTime = value.birthTime == null || value.birthTime === '' ? null : value.birthTime
  const [year, month, day] = birthDate.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  if (!validDate || (birthTime !== null && (typeof birthTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime)))) {
    throw Object.assign(new Error('実在する生年月日と正しい出生時刻を入力してください'), { statusCode: 400 })
  }
  const birthplace = typeof value.birthplace === 'string' ? value.birthplace.trim().slice(0, 80) : ''
  const gender = value.gender === 'male' || value.gender === 'female' ? value.gender : null
  const { relationshipLabel, relationshipType } = normalizeRelationship(value.relationshipLabel, value.relationshipType)
  if (!displayName || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !birthplace || !gender) {
    throw Object.assign(new Error('表示名・生年月日・出生地・性別を正しく入力してください'), { statusCode: 400 })
  }
  return { display_name: displayName, birth_date: birthDate, birth_time: birthTime, birthplace, gender, relationship_type: relationshipType, relationship_label: relationshipLabel }
}
