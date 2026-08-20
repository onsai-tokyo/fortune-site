export const MAX_PARTNER_PROFILES = 2

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
  const birthTime = typeof value.birthTime === 'string' && /^\d{2}:\d{2}$/.test(value.birthTime) ? value.birthTime : null
  const birthplace = typeof value.birthplace === 'string' ? value.birthplace.trim().slice(0, 80) : ''
  const gender = value.gender === 'male' || value.gender === 'female' ? value.gender : null
  const relationshipType = value.relationshipType === 'friend' ? 'friend' : 'romantic'
  if (!displayName || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !birthplace || !gender) {
    throw Object.assign(new Error('表示名・生年月日・出生地・性別を正しく入力してください'), { statusCode: 400 })
  }
  return { display_name: displayName, birth_date: birthDate, birth_time: birthTime, birthplace, gender, relationship_type: relationshipType }
}
