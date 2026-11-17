const key = 'fl-guide-birthdate-draft'
const lifetimeMs = 30 * 60 * 1000

export function saveGuideBirthDate(birthDate) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ birthDate, issuedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}

export function readGuideBirthDate() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    const age = Date.now() - draft?.issuedAt
    if (age >= 0 && age < lifetimeMs && typeof draft.birthDate === 'string') return draft.birthDate
  } catch { /* The regular form is still available when storage is unavailable. */ }
  return ''
}

export function clearGuideBirthDate() {
  try {
    sessionStorage.removeItem(key)
  } catch { /* Embedded browsers can deny storage. */ }
}
