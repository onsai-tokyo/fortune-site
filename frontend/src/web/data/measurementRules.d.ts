export type Source = 'threads' | 'tiktok' | 'instagram' | 'x' | 'other_campaign' | 'organic_search' | 'site_guide' | 'direct'
export type Attribution = {
  source?: Source
  landing_path?: string
  referrer_path?: string
  campaign_name: string
}
export function classifySource(url: URL, referrer: string): Source
export function sanitizeLandingPath(path: string): string
export function sanitizeAttribution(input: Record<string, unknown>): Attribution
export const attributionLifetime: number
export function rememberGuideEntry(url: URL, referrer: string, storage: Storage, now: number): void
export function attributionFromGuide(storage: Storage, now: number): Attribution | undefined
