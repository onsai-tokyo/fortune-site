export function personalReadingTitle(_date = new Date()) {
  return 'あなたについて'
}

export function compatibilityReadingTitle(selfName: unknown, partnerName: unknown, _date = new Date()) {
  const self = String(selfName ?? '').trim().slice(0, 40) || 'あなた'
  const partner = String(partnerName ?? '').trim().slice(0, 40) || 'お相手'
  return `${self}と${partner}の相性`
}

export function chatReadingTitle(question: unknown) {
  const value = String(question ?? '').replace(/\s+/g, ' ').trim()
  return value.slice(0, 40) || '鑑定についての対話'
}
