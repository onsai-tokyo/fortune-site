export const attributionKey: string
export const attributionTtl: number
export function publicPage(path: unknown): string | undefined
export function contentId(path: unknown): string | undefined
export function captureBrowserVisit(): void
export function observeContent(path: string): void
export function browserAttributionFields(): Record<string, string>
export function landingCampaignFields(): Record<string, string>
