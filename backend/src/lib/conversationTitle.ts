export function personalReadingTitle(_date = new Date()) {
  return 'あなたについて'
}

export function compatibilityReadingTitle(displayName: unknown, _date = new Date()) {
  const name = String(displayName ?? '').trim().slice(0, 40) || 'お相手'
  return `${name}との相性`
}
