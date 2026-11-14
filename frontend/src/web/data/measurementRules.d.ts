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
