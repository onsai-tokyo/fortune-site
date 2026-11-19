import type { Attribution } from './measurementRules.js'
export function resetEngagement(): void
export function readTagIdentity(tag?: Function): void
export function announceArrival(): void
export function sendMeasurement(event: string, fields?: Record<string, unknown>): void
export function measurementSession(): (Attribution & { clientId: string; sessionId: number; test: boolean }) | undefined
export function resultPage(path: string): string | undefined
