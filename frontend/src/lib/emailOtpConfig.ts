import { parseEmailOtpLength } from './emailOtp'

export const EMAIL_OTP_LENGTH = parseEmailOtpLength(import.meta.env.VITE_EMAIL_OTP_LENGTH)
