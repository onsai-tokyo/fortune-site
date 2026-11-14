/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_PAYMENTS_ENABLED?: string
  readonly VITE_EMAIL_OTP_LENGTH?: string
  readonly VITE_ROUTER?: string
  readonly VITE_A8_COCONALA_PHONE_HTML?: string
  readonly VITE_A8_SPACIA_PHONE_HTML?: string
  readonly VITE_A8_MIROR_PHONE_HTML?: string
  readonly VITE_A8_MIROR_CHAT_HTML?: string
  readonly VITE_A8_BRILLANTE_CHAT_HTML?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
