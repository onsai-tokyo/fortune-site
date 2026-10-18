import { createHash } from 'node:crypto'
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}'
}
export function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex') }
