function diagnosisDate(date: Date) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}年${value('month')}月${value('day')}日`
}

export function personalReadingTitle(date = new Date()) {
  return `あなたについて　診断日 ${diagnosisDate(date)}`
}

export function compatibilityReadingTitle(displayName: unknown, date = new Date()) {
  const name = String(displayName ?? '').trim().slice(0, 40) || 'お相手'
  return `${name}との相性　診断日 ${diagnosisDate(date)}`
}
