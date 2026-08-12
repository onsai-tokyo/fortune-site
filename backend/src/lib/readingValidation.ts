export type QuestionValidation =
  | { ok: true; value: string }
  | { ok: false; status: number; error: string }

const MAX_QUESTION_LENGTH = 1200

export function validateReadingQuestion(input: unknown): QuestionValidation {
  if (typeof input !== 'string') return { ok: false, status: 400, error: '質問を入力してください' }
  const value = input.replace(/\r\n/g, '\n').trim()
  if (!value) return { ok: false, status: 400, error: '質問を入力してください' }
  if (value.length > MAX_QUESTION_LENGTH) return { ok: false, status: 413, error: `質問は${MAX_QUESTION_LENGTH}文字以内で入力してください` }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    return { ok: false, status: 400, error: '質問に使用できない文字が含まれています' }
  }
  return { ok: true, value }
}

export function validateConversationTitle(input: unknown) {
  if (typeof input !== 'string') return null
  const value = input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return value ? value.slice(0, 80) : null
}
