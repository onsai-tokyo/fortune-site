const key = 'fl-guide-birthdate-draft'
const lifetimeMs = 30 * 60 * 1000

function readingGender(value) {
  return value === 'female' || value === 'male' ? value : null
}

export function saveGuideBirthDate(birthDate, gender) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ birthDate, gender: readingGender(gender), issuedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}

export function readGuideBirthDate() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    const age = Date.now() - draft?.issuedAt
    if (age >= 0 && age < lifetimeMs && typeof draft.birthDate === 'string') {
      return { birthDate: draft.birthDate, gender: readingGender(draft.gender) }
    }
  } catch { /* The regular form is still available when storage is unavailable. */ }
  return null
}

export function clearGuideBirthDate() {
  try {
    sessionStorage.removeItem(key)
  } catch { /* Embedded browsers can deny storage. */ }
}
