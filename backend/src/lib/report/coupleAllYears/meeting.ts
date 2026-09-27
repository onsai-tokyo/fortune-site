import type { composeYear } from './composer.js'

// Editorial framing of the existing annual themes, not a new astrological score.
export function meetingIntroduction(reading: ReturnType<typeof composeYear>, relationshipType: unknown): string {
  const text = reading.paragraphs.join('')
  const adult = reading.ages.A.band === 'adult' && reading.ages.B.band === 'adult'
  if (!adult) return 'この年、ふたりの接点が生まれています。当時の年齢や生活に合った日常の関わりが、相手を知るきっかけになったのかもしれません。今の関係につながる最初の交流として、この年を読むことができます。'
  const contact = /仕事|職場|役割|責任/.test(text)
    ? '仕事や役割を通じたやり取りが、相手の考え方や人柄を知るきっかけになった可能性があります。'
    : /学び|学ぶ|趣味|表現/.test(text)
      ? '学びや好きなことを共有する時間が、会話を始めるきっかけになった可能性があります。'
      : '身近な交流や会話の積み重ねが、相手の存在を意識するきっかけになった可能性があります。'
  const development = relationshipType === 'romantic'
    ? /恋愛|交際|恋人|惹かれ/.test(text)
      ? '互いへの関心が高まり、二人で会う機会や気持ちを伝える場面を通じて、恋愛関係へ進んだのかもしれません。まず友人や知人として親しくなり、その後に特別な相手へ変わっていく始まりとも読めます。'
      : '最初は友人や知人、身近な相談相手として関わっていたのかもしれません。会話や助け合いを重ねるうちに安心感が生まれ、後に恋愛関係へつながる土台をつくった年とも読めます。'
    : '日々の会話や協力を通じて相手を知り、少しずつ親しさや信頼を育てる始まりとも読めます。'
  return 'この年、ふたりの縁が具体的な関わりとして始まっています。'+contact+development
}
