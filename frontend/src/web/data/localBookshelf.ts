import type { ReadingSnapshot } from './readingSnapshot'

const key = 'fatelab-web-saved-readings-v1'

export function readLocalBookshelf(): ReadingSnapshot[] {
  try {
    const rows: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(rows) ? rows.filter(row => typeof row?.id === 'string' && Array.isArray(row?.payload?.sections)) : []
  } catch {
    return []
  }
}

export function writeLocalBookshelf(rows: ReadingSnapshot[]) {
  window.localStorage.setItem(key, JSON.stringify(rows))
}
