/** Web-only endpoints are isolated from the existing iOS API contracts. */
export function webApiPath(path: string): string {
  if (!path.startsWith('/api/') || path.startsWith('/api/web/')) return path
  return `/api/web/${path.slice(5)}`
}
