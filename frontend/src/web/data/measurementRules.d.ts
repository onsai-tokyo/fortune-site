export type Source = 'threads' | 'tiktok' | 'instagram' | 'x' | 'other_campaign' | 'organic_search' | 'site_guide' | 'direct'
export type Attribution = {
  fl_search_engine?: string
  source?: Source
  landing_path?: string
  referrer_path?: string
  campaign_name: string
}
export function classifySource(url: URL, referrer: string): Source
export function sanitizeLandingPath(path: string): string
export function sanitizeAttribution(input: Record<string, unknown>): Attribution
export const attributionLifetime: number
export const measurementSessionKey: string
export const measurementClientIdPattern: RegExp
export function isMeasurementTest(url: URL, now?: number): boolean
export function rememberGuideEntry(url: URL, referrer: string, storage: Storage, now: number): void
export function attributionFromGuide(storage: Storage, now: number): Attribution | undefined

export const productionOrigin: string
export function arrivalAttribution(url: URL, referrer: string): Attribution
export function safeCampaignQuery(input: Record<string, unknown>): URLSearchParams
