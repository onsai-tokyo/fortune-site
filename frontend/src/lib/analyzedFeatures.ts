// ユーザー別に鑑定済みフラグを管理
export function getAnalyzedFeatures(userId: string | undefined): string[] {
  if (!userId) return []
  try {
    const key = `analyzed_features_${userId}`
    return JSON.parse(localStorage.getItem(key) ?? '[]')
  } catch {
    return []
  }
}

export function addAnalyzedFeature(userId: string | undefined, feature: string): void {
  if (!userId) return
  const key = `analyzed_features_${userId}`
  const current = getAnalyzedFeatures(userId)
  if (!current.includes(feature)) {
    localStorage.setItem(key, JSON.stringify([...current, feature]))
  }
}

export function clearAnalyzedFeatures(userId: string | undefined): void {
  if (!userId) return
  const key = `analyzed_features_${userId}`
  localStorage.removeItem(key)
}
