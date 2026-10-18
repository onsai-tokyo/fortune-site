/** Public build setting; must match the connected Supabase project's OTP length. */
export function parseEmailOtpLength(value?: string): number {
  if (value === undefined || value === '') return 8
  if (!/^(6|7|8|9|10)$/.test(value)) throw new Error('VITE_EMAIL_OTP_LENGTH must be an integer from 6 to 10')
  return Number(value)
}

export function isEmailOtp(code: string, length: number): boolean {
  return code.length === length && /^\d+$/.test(code)
}
